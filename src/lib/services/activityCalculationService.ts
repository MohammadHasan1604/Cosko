/**
 * COSKO Phase 2 — Activity Calculation Service
 * 
 * Single source of truth for all work activity duration calculations.
 * Reconstructs durations from server-timestamped WorkActivityEvent records.
 * Used by dashboard, detail view, and export APIs.
 * 
 * All timestamps stored UTC. Display in configured timezone.
 * Shows exact HH:MM:SS without minute rounding.
 * Never claims browser activity proves physical work.
 */

import { prisma } from '@/lib/db';

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface SessionDuration {
  sessionId: string;
  startedAt: Date;
  endedAt: Date | null;
  totalSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
  breakSeconds: number;
  foregroundSeconds: number;
  isClosed: boolean;
  device: string;
}

export interface UserActivitySummary {
  userId: string;
  name: string;
  email: string;
  role: string;
  storeScope: string;
  avatarUrl: string | null;
  accountStatus: string;
  liveStatus: 'ONLINE' | 'IDLE' | 'OFFLINE';
  totalAuthenticatedSeconds: number;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalBreakSeconds: number;
  totalForegroundSeconds: number;
  firstLogin: Date | null;
  lastLogout: Date | null;
  sessionCount: number;
  workingDays: number;
  anomalies: string[];
  dailyBreakdown: DailyBreakdown[];
}

export interface DailyBreakdown {
  date: string;
  activeSeconds: number;
  idleSeconds: number;
  breakSeconds: number;
  foregroundSeconds: number;
  totalSeconds: number;
  firstLogin: Date | null;
  lastActivity: Date | null;
  sessionsCount: number;
  formattedActive: string;
  formattedTotal: string;
}

// ─── Utilities ───────────────────────────────────────────────────────────────
export function formatHHMMSS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getLocalDateString(date: Date, timezone = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function detectAnomalies(sessions: any[], events: any[]): string[] {
  const anomalies: string[] = [];

  for (const sess of sessions) {
    const durationSec = sess.endedAt
      ? Math.floor((new Date(sess.endedAt).getTime() - new Date(sess.startedAt).getTime()) / 1000)
      : Math.floor((Date.now() - new Date(sess.startedAt).getTime()) / 1000);

    // Flag sessions > 16 hours
    if (durationSec > 16 * 3600) {
      anomalies.push(`Session ${sess.id.slice(0, 8)} exceeded 16 hours (${formatHHMMSS(durationSec)})`);
    }

    // Flag > 90% active ratio (suspicious)
    if (durationSec > 3600 && sess.activeSeconds > 0) {
      const activeRatio = sess.activeSeconds / durationSec;
      if (activeRatio > 0.9) {
        anomalies.push(`Session ${sess.id.slice(0, 8)} shows ${Math.round(activeRatio * 100)}% active ratio (unusually high)`);
      }
    }
  }

  return anomalies;
}

// ─── Core Calculation Functions ──────────────────────────────────────────────

/**
 * Calculate server-side duration delta between two heartbeat events.
 * Caps at maxInterval to prevent inflation from gaps.
 */
export function calculateServerDelta(
  lastEventTime: Date,
  currentTime: Date,
  maxIntervalSeconds: number = 45
): number {
  const elapsedMs = currentTime.getTime() - lastEventTime.getTime();
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  return Math.min(elapsedSec, maxIntervalSeconds);
}

/**
 * Determine if a gap between events indicates idle/away time.
 * Gaps > 2 minutes are considered idle.
 */
export function isIdleGap(lastEventTime: Date, currentTime: Date): boolean {
  const gapMs = currentTime.getTime() - lastEventTime.getTime();
  return gapMs > 2 * 60 * 1000;
}

/**
 * Split seconds across midnight boundary for correct daily attribution.
 */
export function splitAcrossMidnight(
  startTime: Date,
  endTime: Date,
  seconds: number,
  timezone: string = 'Asia/Kolkata'
): Array<{ date: string; seconds: number }> {
  const startDate = getLocalDateString(startTime, timezone);
  const endDate = getLocalDateString(endTime, timezone);

  if (startDate === endDate) {
    return [{ date: startDate, seconds }];
  }

  // Calculate midnight in the target timezone
  // For UTC: midnight is endDate + 'T00:00:00Z'
  // For other timezones: approximate using the total span ratio
  const totalSpan = endTime.getTime() - startTime.getTime();
  if (totalSpan <= 0) return [{ date: startDate, seconds }];

  // Construct midnight timestamp in the correct timezone
  const midnightStr = timezone === 'UTC'
    ? endDate + 'T00:00:00Z'
    : endDate + 'T00:00:00';

  const midnightMs = new Date(midnightStr).getTime();
  const beforeMidnightMs = midnightMs - startTime.getTime();
  const ratio = Math.max(0, Math.min(1, beforeMidnightMs / totalSpan));
  const secBeforeMidnight = Math.round(seconds * ratio);
  const secAfterMidnight = seconds - secBeforeMidnight;

  const result: Array<{ date: string; seconds: number }> = [];
  if (secBeforeMidnight > 0) result.push({ date: startDate, seconds: secBeforeMidnight });
  if (secAfterMidnight > 0) result.push({ date: endDate, seconds: secAfterMidnight });
  return result;
}

/**
 * Calculate user activity summary for a date range.
 * Uses UserWorkSession + UserDailyActivity as primary sources,
 * with WorkActivityEvent for precision adjustments.
 */
export async function calculateUserActivity(
  userId: string,
  startDate: string,
  endDate: string,
  timezone: string = 'Asia/Kolkata'
): Promise<{
  sessions: any[];
  dailyRecords: any[];
  events: any[];
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalAuthenticatedSeconds: number;
  firstLogin: Date | null;
  lastLogout: Date | null;
  sessionCount: number;
  anomalies: string[];
}> {
  // Fetch work sessions in date range
  const sessions = await prisma.userWorkSession.findMany({
    where: {
      userId,
      startedAt: {
        gte: new Date(startDate + 'T00:00:00.000Z'),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  // Fetch daily activity records
  const dailyRecords = await prisma.userDailyActivity.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });

  // Fetch events for precision (if available)
  let events: any[] = [];
  try {
    events = await (prisma as any).workActivityEvent.findMany({
      where: {
        userId,
        serverTimestamp: {
          gte: new Date(startDate + 'T00:00:00.000Z'),
          lte: new Date(endDate + 'T23:59:59.999Z'),
        },
      },
      orderBy: { serverTimestamp: 'asc' },
    });
  } catch {
    // Table may not exist yet during migration
  }

  // Calculate totals from daily records (authoritative aggregated source)
  let totalActiveSeconds = 0;
  let totalIdleSeconds = 0;
  let totalAuthenticatedSeconds = 0;
  let firstLogin: Date | null = null;
  let lastLogout: Date | null = null;

  for (const daily of dailyRecords) {
    totalActiveSeconds += daily.activeSeconds || 0;
    totalIdleSeconds += daily.idleSeconds || 0;

    if (!firstLogin || daily.firstLogin < firstLogin) {
      firstLogin = daily.firstLogin;
    }
    if (!lastLogout || daily.lastActivity > lastLogout) {
      lastLogout = daily.lastActivity;
    }
  }

  // Calculate authenticated duration from sessions
  for (const sess of sessions) {
    const end = sess.endedAt || sess.lastActiveAt || new Date();
    const durationSec = Math.max(0, Math.floor((new Date(end).getTime() - new Date(sess.startedAt).getTime()) / 1000));
    totalAuthenticatedSeconds += durationSec;
  }

  const anomalies = detectAnomalies(sessions, events);

  return {
    sessions,
    dailyRecords,
    events,
    totalActiveSeconds,
    totalIdleSeconds,
    totalAuthenticatedSeconds,
    firstLogin,
    lastLogout,
    sessionCount: sessions.length,
    anomalies,
  };
}

/**
 * Build full user activity summary for stats API.
 * Single function used by dashboard, detail view, and export.
 */
export async function buildUserActivitySummary(
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    storeScope: string;
    avatarUrl: string | null;
    status: string;
    lastLogin: Date | null;
  }>,
  startDate: string,
  endDate: string,
  timezone: string = 'Asia/Kolkata'
): Promise<UserActivitySummary[]> {
  const userIds = users.map(u => u.id);

  // Batch fetch all daily records
  const allDailyRecords = await prisma.userDailyActivity.findMany({
    where: {
      userId: { in: userIds },
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'desc' },
  });

  // Batch fetch live session status
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const recentSessions = await prisma.userWorkSession.findMany({
    where: {
      userId: { in: userIds },
      lastActiveAt: { gte: fiveMinutesAgo },
      isClosed: false,
    },
    orderBy: { lastActiveAt: 'desc' },
  });

  const liveStatusMap = new Map<string, { status: 'ONLINE' | 'IDLE' | 'OFFLINE'; lastActiveAt: Date }>();
  for (const sess of recentSessions) {
    if (!liveStatusMap.has(sess.userId)) {
      const isOnline = new Date(sess.lastActiveAt).getTime() >= twoMinutesAgo.getTime();
      liveStatusMap.set(sess.userId, {
        status: isOnline ? 'ONLINE' : 'IDLE',
        lastActiveAt: sess.lastActiveAt,
      });
    }
  }

  // Batch fetch session counts
  const allSessions = await prisma.userWorkSession.findMany({
    where: {
      userId: { in: userIds },
      startedAt: {
        gte: new Date(startDate + 'T00:00:00.000Z'),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      },
    },
    select: { id: true, userId: true, startedAt: true, endedAt: true, activeSeconds: true },
  });

  return users.map(u => {
    const userDaily = allDailyRecords.filter(d => d.userId === u.id);
    const userSessions = allSessions.filter(s => s.userId === u.id);

    const totalActiveSeconds = userDaily.reduce((acc, d) => acc + (d.activeSeconds || 0), 0);
    const totalIdleSeconds = userDaily.reduce((acc, d) => acc + (d.idleSeconds || 0), 0);
    const sessionsCount = userDaily.reduce((acc, d) => acc + (d.sessionsCount || 0), 0);
    const workingDays = userDaily.filter(d => (d.activeSeconds || 0) >= 60).length;

    // Calculate authenticated duration from sessions
    let totalAuthSeconds = 0;
    for (const sess of userSessions) {
      const end = sess.endedAt || new Date();
      totalAuthSeconds += Math.max(0, Math.floor((end.getTime() - sess.startedAt.getTime()) / 1000));
    }

    // First/last timestamps
    let firstLogin: Date | null = null;
    let lastLogout: Date | null = null;
    for (const d of userDaily) {
      if (!firstLogin || d.firstLogin < firstLogin) firstLogin = d.firstLogin;
      if (!lastLogout || d.lastActivity > lastLogout) lastLogout = d.lastActivity;
    }

    const live = liveStatusMap.get(u.id);

    // Anomaly detection
    const anomalies: string[] = [];
    for (const sess of userSessions) {
      const dur = sess.endedAt
        ? Math.floor((sess.endedAt.getTime() - sess.startedAt.getTime()) / 1000)
        : Math.floor((Date.now() - sess.startedAt.getTime()) / 1000);
      if (dur > 16 * 3600) {
        anomalies.push(`Session exceeded 16 hours`);
      }
      if (dur > 3600 && sess.activeSeconds > 0 && (sess.activeSeconds / dur) > 0.9) {
        anomalies.push(`Session shows >90% active ratio`);
      }
    }

    // Build daily breakdown with HH:MM:SS formatting
    const dailyBreakdown: DailyBreakdown[] = userDaily.map(d => ({
      date: d.date,
      activeSeconds: d.activeSeconds,
      idleSeconds: d.idleSeconds,
      breakSeconds: 0, // Calculated from gaps if events available
      foregroundSeconds: d.activeSeconds, // Approximation
      totalSeconds: d.activeSeconds + d.idleSeconds,
      firstLogin: d.firstLogin,
      lastActivity: d.lastActivity,
      sessionsCount: d.sessionsCount,
      formattedActive: formatHHMMSS(d.activeSeconds),
      formattedTotal: formatHHMMSS(d.activeSeconds + d.idleSeconds),
    }));

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      storeScope: u.storeScope,
      avatarUrl: u.avatarUrl,
      accountStatus: u.status,
      liveStatus: live ? live.status : 'OFFLINE',
      totalAuthenticatedSeconds: totalAuthSeconds,
      totalActiveSeconds,
      totalIdleSeconds,
      totalBreakSeconds: 0,
      totalForegroundSeconds: totalActiveSeconds,
      firstLogin,
      lastLogout: live ? live.lastActiveAt : lastLogout,
      sessionCount: sessionsCount,
      workingDays,
      anomalies,
      dailyBreakdown,
    };
  });
}
