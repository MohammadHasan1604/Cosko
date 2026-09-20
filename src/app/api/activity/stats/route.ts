import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

function getLocalDateString(date: Date, timezone = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

function computeDateRange(range: string, customStart?: string, customEnd?: string, timezone = 'Asia/Kolkata') {
  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);

  if (range === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (range === 'yesterday') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yStr = getLocalDateString(yesterday, timezone);
    return { startDate: yStr, endDate: yStr };
  }

  if (range === 'this_week') {
    // Current week starting Monday
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ...
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now.getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    return {
      startDate: getLocalDateString(monday, timezone),
      endDate: todayStr,
    };
  }

  if (range === 'this_month') {
    const startOfMonth = todayStr.substring(0, 8) + '01';
    return {
      startDate: startOfMonth,
      endDate: todayStr,
    };
  }

  if (range === 'custom') {
    return {
      startDate: customStart || todayStr,
      endDate: customEnd || todayStr,
    };
  }

  // 'all_time'
  return {
    startDate: '2020-01-01',
    endDate: '2099-12-31',
  };
}

export async function GET(req: NextRequest) {
  try {
    const caller = getAuthUserFromRequest(req);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'today';
    const customStart = searchParams.get('startDate') || undefined;
    const customEnd = searchParams.get('endDate') || undefined;
    const reqUserId = searchParams.get('userId') || undefined;
    const reqStore = searchParams.get('storeCode') || undefined;
    const timezone = searchParams.get('timezone') || 'Asia/Kolkata';

    const isSuperAdmin = caller.role === 'Super Admin' || caller.securityLevel >= 100;

    // RBAC: Non-admin users are strictly forced to their own userId and store
    if (!isSuperAdmin) {
      if (reqUserId && reqUserId !== caller.id) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view other staff activity records' },
          { status: 403 }
        );
      }
      if (reqStore && reqStore !== 'All Stores' && reqStore !== caller.store) {
        return NextResponse.json(
          { error: 'Forbidden: You do not have permission to view activity records for another store' },
          { status: 403 }
        );
      }
      if (reqStore === 'All Stores') {
        return NextResponse.json(
          { error: 'Forbidden: Consolidated view across all stores is restricted to Super Admin only' },
          { status: 403 }
        );
      }
    }

    const targetUserId = isSuperAdmin ? reqUserId : caller.id;

    const { startDate, endDate } = computeDateRange(range, customStart, customEnd, timezone);

    // Fetch relevant users
    const userWhere: any = {};
    if (targetUserId) {
      userWhere.id = targetUserId;
    } else if (reqStore && reqStore !== 'All Stores') {
      userWhere.storeScope = reqStore;
    }

    const users = await prisma.userAccount.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeScope: true,
        avatarUrl: true,
        status: true,
        lastLogin: true,
      },
      orderBy: { name: 'asc' },
    });

    const userIds = users.map((u) => u.id);

    // Fetch Daily Activity records for the date range
    const dailyRecords = await prisma.userDailyActivity.findMany({
      where: {
        userId: { in: userIds },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    // Fetch recent live sessions to determine live status (online / idle / offline)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const recentSessions = await prisma.userWorkSession.findMany({
      where: {
        userId: { in: userIds },
        lastActiveAt: { gte: fiveMinutesAgo },
        isClosed: false,
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    const liveStatusMap = new Map<string, { status: 'ONLINE' | 'IDLE' | 'OFFLINE'; lastActiveAt: Date }>();

    for (const sess of recentSessions) {
      if (!liveStatusMap.has(sess.userId)) {
        const isOnline = new Date(sess.lastActiveAt).getTime() >= twoMinutesAgo.getTime();
        liveStatusMap.set(sess.userId, {
          status: isOnline ? 'ONLINE' : 'IDLE',
          lastActiveAt: sess.lastActiveAt,
        });
      }
    }

    // Build user stats
    const userStats = users.map((u) => {
      const userDaily = dailyRecords.filter((d) => d.userId === u.id);
      const totalActiveSeconds = userDaily.reduce((acc, curr) => acc + (curr.activeSeconds || 0), 0);
      const totalIdleSeconds = userDaily.reduce((acc, curr) => acc + (curr.idleSeconds || 0), 0);
      const sessionsCount = userDaily.reduce((acc, curr) => acc + (curr.sessionsCount || 0), 0);

      // Working days = count of distinct days where activeSeconds > 60s
      const workingDays = userDaily.filter((d) => (d.activeSeconds || 0) >= 60).length;

      // First login in range
      const firstLogin = userDaily.length > 0
        ? userDaily.reduce((earliest, curr) => curr.firstLogin < earliest ? curr.firstLogin : earliest, userDaily[0].firstLogin)
        : u.lastLogin;

      // Last activity in range
      const lastActivity = userDaily.length > 0
        ? userDaily.reduce((latest, curr) => curr.lastActivity > latest ? curr.lastActivity : latest, userDaily[0].lastActivity)
        : u.lastLogin;

      const live = liveStatusMap.get(u.id);

      const dailyBreakdown = userDaily.map((d) => ({
        date: d.date,
        activeSeconds: d.activeSeconds,
        activeMinutes: Math.floor(d.activeSeconds / 60),
        activeHours: (d.activeSeconds / 3600).toFixed(1),
        idleMinutes: Math.floor(d.idleSeconds / 60),
        firstLogin: d.firstLogin,
        lastActivity: d.lastActivity,
        sessionsCount: d.sessionsCount,
      }));

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        storeScope: u.storeScope,
        avatarUrl: u.avatarUrl,
        accountStatus: u.status,
        liveStatus: live ? live.status : 'OFFLINE',
        totalActiveSeconds,
        totalWorkingMinutes: Math.floor(totalActiveSeconds / 60),
        totalWorkingHours: (totalActiveSeconds / 3600).toFixed(1),
        totalIdleMinutes: Math.floor(totalIdleSeconds / 60),
        workingDays,
        firstLogin,
        lastActivity: live ? live.lastActiveAt : lastActivity,
        sessionsCount,
        dailyBreakdown,
      };
    });

    // Compute aggregate summary metrics
    const totalTeamActiveSeconds = userStats.reduce((acc, u) => acc + u.totalActiveSeconds, 0);
    const totalTeamSessions = userStats.reduce((acc, u) => acc + u.sessionsCount, 0);
    const activeStaffTodayCount = userStats.filter((u) => u.liveStatus === 'ONLINE').length;
    const totalWorkingDaysAllUsers = userStats.reduce((acc, u) => acc + u.workingDays, 0);
    const averageDailyHours = totalWorkingDaysAllUsers > 0
      ? (totalTeamActiveSeconds / 3600 / totalWorkingDaysAllUsers).toFixed(1)
      : '0.0';

    return NextResponse.json({
      success: true,
      range,
      filter: { startDate, endDate, timezone },
      summary: {
        totalWorkingMinutes: Math.floor(totalTeamActiveSeconds / 60),
        totalWorkingHours: (totalTeamActiveSeconds / 3600).toFixed(1),
        totalSessions: totalTeamSessions,
        activeStaffOnline: activeStaffTodayCount,
        averageDailyHours,
        totalUsersCount: userStats.length,
      },
      users: userStats,
      isSuperAdmin,
    });
  } catch (err: any) {
    console.error('API /api/activity/stats error:', err);
    return NextResponse.json({ error: err.message || 'Stats error' }, { status: 500 });
  }
}
