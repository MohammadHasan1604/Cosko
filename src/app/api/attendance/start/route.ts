import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuditLog } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getLocalDateString(date: Date, timezone: string = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    // Determine store and store timezone
    let storeTimezone = 'Asia/Kolkata';
    const storeCode = user.store && user.store !== 'All Stores' ? user.store : 'BLR';
    const storeHub = await prisma.storeHub.findUnique({
      where: { code: storeCode },
      select: { timezone: true },
    });
    if (storeHub?.timezone) {
      storeTimezone = storeHub.timezone;
    }

    const now = new Date();
    const todayStr = getLocalDateString(now, storeTimezone);

    // 🔒 Rule: A worker can complete only ONE shift per local date
    const existing = await prisma.attendanceDay.findUnique({
      where: {
        userId_localDate: {
          userId: user.id,
          localDate: todayStr,
        },
      },
    });

    if (existing) {
      if (existing.status === 'ACTIVE') {
        return NextResponse.json(
          {
            error: 'You already have an active shift in progress for today.',
            code: 'SHIFT_ALREADY_ACTIVE',
            shift: existing,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            'Your shift for today has already been completed. Only one shift per day is allowed.',
          code: 'SHIFT_ALREADY_COMPLETED',
          shift: existing,
        },
        { status: 409 }
      );
    }

    // Create today's authoritative attendance shift
    const shift = await prisma.attendanceDay.create({
      data: {
        userId: user.id,
        localDate: todayStr,
        storeCode,
        shiftStartUtc: now,
        status: 'ACTIVE',
      },
    });

    // Update live presence to ONLINE
    await (prisma as any).userPresence.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: 'ONLINE',
        lastHeartbeat: now,
        lastSeen: now,
        currentStore: storeCode,
      },
      update: {
        status: 'ONLINE',
        lastHeartbeat: now,
        lastSeen: now,
        currentStore: storeCode,
      },
    });

    await createAuditLog(
      auth.user,
      'Attendance',
      'Start Shift',
      `User ${user.name} started shift at store ${storeCode} (Date: ${todayStr}, UTC: ${now.toISOString()})`
    );

    // Broadcast realtime notifications across devices
    await broadcastRealtimeEvent(
      `store-${storeCode}`,
      'ATTENDANCE_STARTED',
      {
        eventType: 'ATTENDANCE_STARTED',
        shiftId: shift.id,
        userId: user.id,
        employeeName: user.name,
        storeCode,
        shiftStartUtc: now.toISOString(),
        date: todayStr,
        timestamp: now.toISOString(),
      },
      { storeCode }
    );

    await broadcastRealtimeEvent(
      'work-activity',
      'WORK_ACTIVITY_UPDATED',
      {
        eventType: 'WORK_ACTIVITY_UPDATED',
        userId: user.id,
        name: user.name,
        role: user.role,
        storeCode,
        status: 'ONLINE',
        hasActiveShift: true,
        shiftStartUtc: now.toISOString(),
        elapsedSeconds: 0,
        lastSeen: now.toISOString(),
        timestamp: now.toISOString(),
      },
      { storeCode }
    );

    return NextResponse.json({
      success: true,
      message: 'Shift started successfully',
      shift,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    console.error('API /api/attendance/start error:', err);
    // Handle Prisma unique constraint race condition
    if (err.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'A shift has already been started for today.',
          code: 'SHIFT_ALREADY_EXISTS',
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
