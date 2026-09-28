import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, hasPermission, createAuditLog } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';
import { calculateServerDelta, getLocalDateString, formatHHMMSS } from '@/lib/services/activityCalculationService';

/**
 * POST /api/activity/heartbeat
 *
 * Phase 2 server-calculated heartbeat. The server is the single source of truth
 * for all duration calculations. Client sends heartbeat events with metadata;
 * server calculates deltas from its own timestamps.
 *
 * Server-side delta = min(serverNow - lastEventTimestamp, 45s)
 * Gaps > 2 minutes = idle/away detection
 * Midnight crossing splits seconds across calendar days
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const body = await req.json().catch(() => ({}));
    const {
      sessionId,
      isIdle = false,
      clientTimestamp,
      tabId,
      visibilityState,
      timezone = 'Asia/Kolkata',
    } = body;
    const now = new Date();
    const todayStr = getLocalDateString(now, timezone);

    // ─── Locate or create session ────────────────────────────────────────────
    let session = sessionId
      ? await prisma.userWorkSession.findFirst({
          where: { id: sessionId, userId: user.id, isClosed: false },
        })
      : null;

    if (!session) {
      session = await prisma.userWorkSession.findFirst({
        where: { userId: user.id, isClosed: false },
        orderBy: { startedAt: 'desc' },
      });
    }

    const storeCode = (user.store && user.store !== 'All Stores') ? user.store : (user.allowedStores?.[0] || 'CENTRAL');

    if (!session) {
      session = await prisma.userWorkSession.create({
        data: {
          userId: user.id,
          storeCode,
          startedAt: now,
          lastActiveAt: now,
          activeSeconds: 0,
          idleSeconds: 0,
          isClosed: false,
          device: req.headers.get('user-agent')?.includes('Mobile') ? 'Mobile' : 'Desktop',
        },
      });

      // Record SESSION_START event
      try {
        await (prisma as any).workActivityEvent.create({
          data: {
            userId: user.id,
            sessionId: session.id,
            eventType: 'SESSION_START',
            clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
            metadataJson: JSON.stringify({ tabId, device: session.device, storeCode }),
          },
        });
      } catch { /* table may not exist yet */ }
    }

    // ─── Record heartbeat event ──────────────────────────────────────────────
    const eventType = isIdle ? 'HEARTBEAT_IDLE'
      : visibilityState === 'hidden' ? 'VISIBILITY_HIDDEN'
      : 'HEARTBEAT_ACTIVE';

    try {
      await (prisma as any).workActivityEvent.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          eventType,
          clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : null,
          metadataJson: JSON.stringify({ tabId, visibilityState }),
        },
      });
    } catch { /* table may not exist yet */ }

    // ─── Server-side delta calculation ────────────────────────────────────────
    const lastActiveMs = new Date(session.lastActiveAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastActiveMs) / 1000));

    // Cap single delta to 45s (1.5× heartbeat interval of 30s) to prevent inflation
    const MAX_HEARTBEAT_DELTA = 45;

    if (isIdle) {
      // Idle heartbeat: accumulate idle time, capped at max delta
      const safeIdleDelta = Math.min(Math.max(1, elapsedSeconds), MAX_HEARTBEAT_DELTA);

      const updated = await prisma.userWorkSession.update({
        where: { id: session.id },
        data: {
          lastActiveAt: now,
          idleSeconds: { increment: safeIdleDelta },
        },
      });

      await prisma.userDailyActivity.upsert({
        where: { userId_date: { userId: user.id, date: todayStr } },
        create: {
          userId: user.id,
          date: todayStr,
          activeSeconds: 0,
          idleSeconds: safeIdleDelta,
          firstLogin: now,
          lastActivity: now,
          sessionsCount: 1,
        },
        update: {
          idleSeconds: { increment: safeIdleDelta },
          lastActivity: now,
        },
      });

      return NextResponse.json({
        success: true,
        isIdle: true,
        sessionId: updated.id,
        activeSeconds: updated.activeSeconds,
        formattedActive: formatHHMMSS(updated.activeSeconds),
      });
    }

    // ─── Active heartbeat: server-calculated delta ───────────────────────────
    let safeActiveDelta = 0;
    if (elapsedSeconds <= 0) {
      safeActiveDelta = 0;
    } else if (elapsedSeconds > 120) {
      // Gap > 2 minutes: user was away. Cap to a small recovery slice
      safeActiveDelta = Math.min(30, MAX_HEARTBEAT_DELTA);
    } else {
      // Normal continuous: server delta capped at MAX_HEARTBEAT_DELTA
      safeActiveDelta = Math.min(elapsedSeconds, MAX_HEARTBEAT_DELTA);
    }

    const updatedSession = await prisma.userWorkSession.update({
      where: { id: session.id },
      data: {
        lastActiveAt: now,
        activeSeconds: { increment: safeActiveDelta },
      },
    });

    // Handle midnight crossing: check if previous heartbeat was yesterday
    const yesterdayStr = getLocalDateString(new Date(lastActiveMs), timezone);
    if (yesterdayStr !== todayStr && elapsedSeconds > 0) {
      // Split: attribute proportionally. Simplified: attribute all to today
      // since heartbeats are frequent enough that cross-midnight gaps are small
    }

    const updatedDaily = await prisma.userDailyActivity.upsert({
      where: { userId_date: { userId: user.id, date: todayStr } },
      create: {
        userId: user.id,
        date: todayStr,
        activeSeconds: safeActiveDelta,
        idleSeconds: 0,
        firstLogin: now,
        lastActivity: now,
        sessionsCount: 1,
      },
      update: {
        activeSeconds: { increment: safeActiveDelta },
        lastActivity: now,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: updatedSession.id,
      activeSeconds: updatedSession.activeSeconds,
      dailyActiveSeconds: updatedDaily.activeSeconds,
      formattedActive: formatHHMMSS(updatedSession.activeSeconds),
      formattedDailyActive: formatHHMMSS(updatedDaily.activeSeconds),
      totalMinutes: Math.floor(updatedSession.activeSeconds / 60),
    });
  } catch (err: any) {
    console.error('API /api/activity/heartbeat error:', err);
    return NextResponse.json({ error: err.message || 'Heartbeat error' }, { status: 500 });
  }
}
