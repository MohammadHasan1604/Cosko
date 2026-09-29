/**
 * COSKO — Activity Calculation Service
 *
 * Single source of truth for all work activity & attendance duration calculations.
 * Backed by authoritative AttendanceDay model with UTC timestamps.
 * Used by dashboard, detail view, and export APIs.
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

/**
 * Calculate activity summary for a single user over a date range.
 */
export async function calculateUserActivitySummary(
  userId: string,
  startDate: string,
  endDate: string,
  _timezone: string = 'Asia/Kolkata'
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
  const attendanceDays = await prisma.attendanceDay.findMany({
    where: {
      userId,
      localDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { shiftStartUtc: 'asc' },
  });

  const now = new Date();
  let totalActiveSeconds = 0;
  let firstLogin: Date | null = null;
  let lastLogout: Date | null = null;
  const anomalies: string[] = [];

  for (const day of attendanceDays) {
    let dur = day.totalSeconds;
    if (day.status === 'ACTIVE') {
      dur = Math.max(0, Math.floor((now.getTime() - new Date(day.shiftStartUtc).getTime()) / 1000));
    }
    totalActiveSeconds += dur;

    if (!firstLogin || day.shiftStartUtc < firstLogin) {
      firstLogin = day.shiftStartUtc;
    }
    const end = day.shiftEndUtc || (day.status === 'ACTIVE' ? now : day.shiftStartUtc);
    if (!lastLogout || end > lastLogout) {
      lastLogout = end;
    }

    if (dur > 16 * 3600) {
      anomalies.push(`Shift on ${day.localDate} exceeded 16 hours (${formatHHMMSS(dur)})`);
    }
  }

  return {
    sessions: attendanceDays,
    dailyRecords: attendanceDays,
    events: [],
    totalActiveSeconds,
    totalIdleSeconds: 0,
    totalAuthenticatedSeconds: totalActiveSeconds,
    firstLogin,
    lastLogout,
    sessionCount: attendanceDays.length,
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
  _timezone: string = 'Asia/Kolkata'
): Promise<UserActivitySummary[]> {
  const userIds = users.map((u) => u.id);

  // Batch fetch attendance records in date range
  const allAttendanceDays = await prisma.attendanceDay.findMany({
    where: {
      userId: { in: userIds },
      localDate: { gte: startDate, lte: endDate },
    },
    orderBy: { shiftStartUtc: 'desc' },
  });

  const now = new Date();

  return users.map((u) => {
    const userDays = allAttendanceDays.filter((d) => d.userId === u.id);
    const hasActiveShift = userDays.some((d) => d.status === 'ACTIVE');

    let totalActiveSeconds = 0;
    let firstLogin: Date | null = null;
    let lastLogout: Date | null = null;
    const anomalies: string[] = [];

    const dailyBreakdown: DailyBreakdown[] = userDays.map((d) => {
      let dur = d.totalSeconds;
      if (d.status === 'ACTIVE') {
        dur = Math.max(0, Math.floor((now.getTime() - new Date(d.shiftStartUtc).getTime()) / 1000));
      }
      totalActiveSeconds += dur;

      if (!firstLogin || d.shiftStartUtc < firstLogin) firstLogin = d.shiftStartUtc;
      const shiftEnd = d.shiftEndUtc || (d.status === 'ACTIVE' ? now : d.shiftStartUtc);
      if (!lastLogout || shiftEnd > lastLogout) lastLogout = shiftEnd;

      if (dur > 16 * 3600) {
        anomalies.push(`Shift on ${d.localDate} exceeded 16 hours`);
      }

      return {
        date: d.localDate,
        activeSeconds: dur,
        idleSeconds: 0,
        breakSeconds: 0,
        foregroundSeconds: dur,
        totalSeconds: dur,
        firstLogin: d.shiftStartUtc,
        lastActivity: d.shiftEndUtc || (d.status === 'ACTIVE' ? now : d.shiftStartUtc),
        sessionsCount: 1,
        formattedActive: formatHHMMSS(dur),
        formattedTotal: formatHHMMSS(dur),
      };
    });

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      storeScope: u.storeScope,
      avatarUrl: u.avatarUrl,
      accountStatus: u.status,
      liveStatus: hasActiveShift ? 'ONLINE' : 'OFFLINE',
      totalAuthenticatedSeconds: totalActiveSeconds,
      totalActiveSeconds,
      totalIdleSeconds: 0,
      totalBreakSeconds: 0,
      totalForegroundSeconds: totalActiveSeconds,
      firstLogin,
      lastLogout,
      sessionCount: userDays.length,
      workingDays: userDays.length,
      anomalies,
      dailyBreakdown,
    };
  });
}
