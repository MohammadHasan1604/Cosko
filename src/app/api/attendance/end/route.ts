import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, createAuditLog } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

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

    await createAuditLog(
      auth.user,
      'Attendance',
      'End Shift',
      `User ${user.name} completed shift (Date: ${activeShift.localDate}, Duration: ${formattedDuration}, Total Seconds: ${durationSeconds})`
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
