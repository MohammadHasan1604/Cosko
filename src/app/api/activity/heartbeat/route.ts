import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';
import { formatHHMMSS } from '@/lib/services/activityCalculationService';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/activity/heartbeat
 *
 * Lightweight liveness and operational presence telemetry.
 * Called every 15-20 seconds by authenticated clients.
 *
 * Rules:
 * - Does NOT write every second (efficient presence tracking).
 * - Server timestamps are authoritative.
 * - Records ONLINE or IDLE based on client activity state.
 * - Broadcasts live presence updates to the work-activity channel.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const body = await req.json().catch(() => ({}));
    const isIdle = body.isIdle === true;
    const now = new Date();
    const status = isIdle ? 'IDLE' : 'ONLINE';
    const userStore = user.store && user.store !== 'All Stores' ? user.store : 'BLR';
    const deviceInfo = req.headers.get('user-agent')?.substring(0, 128) || 'Web Browser';

    // 1. Authoritatively persist presence state in MySQL
    await (prisma as any).userPresence.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status,
        lastHeartbeat: now,
        lastSeen: now,
        currentStore: userStore,
        deviceInfo,
      },
      update: {
        status,
        lastHeartbeat: now,
        lastSeen: now,
        currentStore: userStore,
        deviceInfo,
      },
    });

    // 2. Check active shift status
    const activeShift = await (prisma as any).attendanceDay.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    const elapsedSeconds = activeShift
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(activeShift.shiftStartUtc).getTime()) / 1000)
        )
      : 0;

    // 3. Broadcast presence change to work-activity channel (skips outbox to avoid DB bloat)
    await broadcastRealtimeEvent(
      'work-activity',
      'WORK_ACTIVITY_UPDATED',
      {
        eventType: 'WORK_ACTIVITY_UPDATED',
        userId: user.id,
        name: user.name,
        role: user.role,
        storeCode: userStore,
        status,
        isIdle,
        hasActiveShift: !!activeShift,
        shiftStartUtc: activeShift?.shiftStartUtc || null,
        elapsedSeconds,
        lastSeen: now.toISOString(),
        timestamp: now.toISOString(),
      },
      { skipOutbox: true, storeCode: userStore }
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      active: !!activeShift,
      isIdle,
      status,
      shiftId: activeShift?.id || null,
      elapsedSeconds,
      formattedElapsed: formatHHMMSS(elapsedSeconds),
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    console.error('API /api/activity/heartbeat error:', err);
    return NextResponse.json({ error: err.message || 'Heartbeat error' }, { status: 500 });
  }
}
