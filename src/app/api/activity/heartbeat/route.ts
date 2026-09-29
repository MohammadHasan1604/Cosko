import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';
import { formatHHMMSS } from '@/lib/services/activityCalculationService';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const activeShift = await prisma.attendanceDay.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    if (!activeShift) {
      return NextResponse.json({
        success: true,
        active: false,
        message: 'No active shift in progress',
      });
    }

    const now = new Date();
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - new Date(activeShift.shiftStartUtc).getTime()) / 1000)
    );

    return NextResponse.json({
      success: true,
      active: true,
      shiftId: activeShift.id,
      elapsedSeconds,
      formattedElapsed: formatHHMMSS(elapsedSeconds),
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    console.error('API /api/activity/heartbeat error:', err);
    return NextResponse.json({ error: err.message || 'Heartbeat error' }, { status: 500 });
  }
}
