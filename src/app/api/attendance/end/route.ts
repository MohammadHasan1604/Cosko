import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuditLog } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatHHMMSS(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    // Find the currently active shift
    const activeShift = await prisma.attendanceDay.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    if (!activeShift) {
      return NextResponse.json(
        {
          error:
            'No active shift found to end. Your shift may have already been ended or not started.',
          code: 'NO_ACTIVE_SHIFT',
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(activeShift.shiftStartUtc).getTime()) / 1000)
    );

    const completedShift = await prisma.attendanceDay.update({
      where: { id: activeShift.id },
      data: {
        shiftEndUtc: now,
        totalSeconds: durationSeconds,
        status: 'COMPLETED',
      },
    });

    const formattedDuration = formatHHMMSS(durationSeconds);
    const storeCode = activeShift.storeCode;

    // Update presence
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
        lastSeen: now,
      },
    });

    await createAuditLog(
      auth.user,
      'Attendance',
      'End Shift',
      `User ${user.name} completed shift (Date: ${activeShift.localDate}, Duration: ${formattedDuration}, Total Seconds: ${durationSeconds})`
    );

    // Broadcast realtime notifications across devices
    await broadcastRealtimeEvent(
      `store-${storeCode}`,
      'ATTENDANCE_ENDED',
      {
        eventType: 'ATTENDANCE_ENDED',
        shiftId: completedShift.id,
        userId: user.id,
        employeeName: user.name,
        storeCode,
        shiftStartUtc: activeShift.shiftStartUtc.toISOString(),
        shiftEndUtc: now.toISOString(),
        totalSeconds: durationSeconds,
        formattedDuration,
        date: activeShift.localDate,
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
        hasActiveShift: false,
        shiftStartUtc: null,
        elapsedSeconds: 0,
        todayDurationSeconds: durationSeconds,
        formattedTodayDuration: formattedDuration,
        lastSeen: now.toISOString(),
        timestamp: now.toISOString(),
      },
      { storeCode }
    );

    return NextResponse.json({
      success: true,
      message: `Shift ended successfully. Total duration: ${formattedDuration}`,
      shift: completedShift,
      totalSeconds: durationSeconds,
      formattedDuration,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    console.error('API /api/attendance/end error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
