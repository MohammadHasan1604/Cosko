import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getClientIp } from '@/lib/rateLimit';

function getLocalDateString(date: Date, timezone?: string): string {
  try {
    const tz = timezone || 'Asia/Kolkata';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // Returns YYYY-MM-DD
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
    const action = body.action || 'start';
    const clientTimezone = body.timezone || 'Asia/Kolkata';
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const now = new Date();
    const todayStr = getLocalDateString(now, clientTimezone);

    if (action === 'start') {
      const storeCode = (user.store && user.store !== 'All Stores') ? user.store : (user.allowedStores?.[0] || 'CENTRAL');

      // 1. Close any abandoned sessions older than 10 minutes for this user
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.userWorkSession.updateMany({
        where: {
          userId: user.id,
          isClosed: false,
          lastActiveAt: { lt: tenMinutesAgo },
        },
        data: {
          isClosed: true,
          endedAt: now,
        },
      });

      // 2. Check if there is already an active session within the last 5 minutes
      let activeSession = await prisma.userWorkSession.findFirst({
        where: {
          userId: user.id,
          isClosed: false,
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!activeSession) {
        // Create new work session
        activeSession = await prisma.userWorkSession.create({
          data: {
            userId: user.id,
            storeCode,
            startedAt: now,
            lastActiveAt: now,
            activeSeconds: 0,
            idleSeconds: 0,
            isClosed: false,
            ipAddress: clientIp,
            userAgent: userAgent.slice(0, 255),
            device: userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
          },
        });

        // Upsert Daily Activity Record
        await prisma.userDailyActivity.upsert({
          where: {
            userId_date: {
              userId: user.id,
              date: todayStr,
            },
          },
          create: {
            userId: user.id,
            date: todayStr,
            activeSeconds: 0,
            idleSeconds: 0,
            firstLogin: now,
            lastActivity: now,
            sessionsCount: 1,
          },
          update: {
            lastActivity: now,
            sessionsCount: { increment: 1 },
          },
        });
      } else {
        // Update lastActiveAt
        activeSession = await prisma.userWorkSession.update({
          where: { id: activeSession.id },
          data: { lastActiveAt: now },
        });
      }

      return NextResponse.json({
        success: true,
        sessionId: activeSession.id,
        startedAt: activeSession.startedAt,
        activeSeconds: activeSession.activeSeconds,
      });
    }

    if (action === 'close') {
      const sessionId = body.sessionId;
      if (sessionId) {
        await prisma.userWorkSession.updateMany({
          where: { id: sessionId, userId: user.id },
          data: {
            isClosed: true,
            endedAt: now,
            lastActiveAt: now,
          },
        });
      } else {
        await prisma.userWorkSession.updateMany({
          where: { userId: user.id, isClosed: false },
          data: {
            isClosed: true,
            endedAt: now,
          },
        });
      }

      return NextResponse.json({ success: true, message: 'Session closed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('API /api/activity/session error:', err);
    return NextResponse.json({ error: err.message || 'Session error' }, { status: 500 });
  }
}
