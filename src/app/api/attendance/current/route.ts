import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

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

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    // Determine store timezone
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

    // Find shift record for today
    const shift = await prisma.attendanceDay.findUnique({
      where: {
        userId_localDate: {
          userId: user.id,
          localDate: todayStr,
        },
      },
    });

    if (!shift) {
      return NextResponse.json({
        status: 'NOT_STARTED',
        canStart: true,
        localDate: todayStr,
        storeTimezone,
        serverTime: now.toISOString(),
      });
    }

    if (shift.status === 'ACTIVE') {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now.getTime() - new Date(shift.shiftStartUtc).getTime()) / 1000)
      );
      return NextResponse.json({
        status: 'ACTIVE',
        canStart: false,
        canEnd: true,
        shiftId: shift.id,
        localDate: shift.localDate,
        shiftStartUtc: shift.shiftStartUtc,
        elapsedSeconds,
        storeTimezone,
        serverTime: now.toISOString(),
      });
    }

    return NextResponse.json({
      status: 'COMPLETED',
      canStart: false,
      canEnd: false,
      shiftId: shift.id,
      localDate: shift.localDate,
      shiftStartUtc: shift.shiftStartUtc,
      shiftEndUtc: shift.shiftEndUtc,
      totalSeconds: shift.totalSeconds,
      storeTimezone,
      serverTime: now.toISOString(),
    });
  } catch (err: any) {
    console.error('API /api/attendance/current error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
