import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

function getLocalDateString(date: Date, timezone?: string): string {
  try {
    const tz = timezone || 'Asia/Kolkata';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { sessionId, isIdle = false, activeDeltaSeconds = 30, timezone = 'Asia/Kolkata' } = body;
    const now = new Date();
    const todayStr = getLocalDateString(now, timezone);

    // If no sessionId provided, locate or create current active session for this user
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
    }

    if (isIdle) {
      // User is idle: update lastActiveAt (heartbeat received) and accumulate idleSeconds, but DO NOT accumulate active working seconds
      const safeIdleDelta = Math.min(Math.max(1, Number(activeDeltaSeconds) || 30), 60);

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
      });
    }

    // User is actively working:
    // Calculate server-side time delta to prevent double counting or multi-tab over-reporting
    const lastActiveMs = new Date(session.lastActiveAt).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastActiveMs) / 1000));

    let safeActiveDelta = 0;
    if (elapsedSeconds <= 0) {
      safeActiveDelta = 0;
    } else if (elapsedSeconds > 120) {
      // There was an inactivity / sleep gap greater than 2 minutes.
      // Cap addition to at most the client-verified active slice (default 30s)
      safeActiveDelta = Math.min(Math.max(0, Number(activeDeltaSeconds) || 30), 30);
    } else {
      // Normal continuous usage: cap delta to min of reported delta, elapsed seconds, and 60s
      safeActiveDelta = Math.min(Number(activeDeltaSeconds) || 30, Math.min(elapsedSeconds, 60));
    }

    const updatedSession = await prisma.userWorkSession.update({
      where: { id: session.id },
      data: {
        lastActiveAt: now,
        activeSeconds: { increment: safeActiveDelta },
      },
    });

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
      totalMinutes: Math.floor(updatedSession.activeSeconds / 60),
    });
  } catch (err: any) {
    console.error('API /api/activity/heartbeat error:', err);
    return NextResponse.json({ error: err.message || 'Heartbeat error' }, { status: 500 });
  }
}
