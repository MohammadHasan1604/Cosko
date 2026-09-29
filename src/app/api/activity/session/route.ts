import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    if (action === 'status') {
      const activeShift = await prisma.attendanceDay.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
      });
      return NextResponse.json({
        success: true,
        hasActiveShift: !!activeShift,
        shift: activeShift,
      });
    }

    if (action === 'close') {
      const activeShift = await prisma.attendanceDay.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
      });
      if (activeShift) {
        const now = new Date();
        const durationSeconds = Math.max(
          0,
          Math.floor((now.getTime() - new Date(activeShift.shiftStartUtc).getTime()) / 1000)
        );
        await prisma.attendanceDay.update({
          where: { id: activeShift.id },
          data: {
            shiftEndUtc: now,
            totalSeconds: durationSeconds,
            status: 'COMPLETED',
          },
        });
      }
      return NextResponse.json({ success: true, message: 'Shift ended' });
    }

    return NextResponse.json({ success: true, message: 'Acknowledged' });
  } catch (err: any) {
    console.error('API /api/activity/session error:', err);
    return NextResponse.json({ error: err.message || 'Session error' }, { status: 500 });
  }
}
