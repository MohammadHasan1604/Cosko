import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';
import { prisma } from '@/lib/db';

function formatHHMM(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHHMMSS(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    const { searchParams } = new URL(req.url);
    const filterDate = searchParams.get('date');
    const filterStore = searchParams.get('storeCode');
    const filterUserId = searchParams.get('userId');

    // 🔒 Attendance Management is SUPER ADMIN ONLY (Requirement G)
    if (user.role !== 'Super Admin' || user.securityLevel < 100) {
      return NextResponse.json(
        { error: 'Forbidden: Attendance management records are restricted to Super Admin only.' },
        { status: 403 }
      );
    }

    const where: any = {};
    if (filterStore && filterStore !== 'All Stores') {
      where.storeCode = filterStore;
    }
    if (filterUserId) {
      where.userId = filterUserId;
    }

    if (filterDate) {
      where.localDate = filterDate;
    }

    const records = await (prisma as any).attendanceDay.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        shiftStartUtc: 'desc',
      },
    });

    const now = new Date();

    const formattedRecords = records.map((r: any) => {
      let activeSeconds = r.totalSeconds;
      if (r.status === 'ACTIVE') {
        activeSeconds = Math.max(
          0,
          Math.floor((now.getTime() - new Date(r.shiftStartUtc).getTime()) / 1000)
        );
      }

      return {
        id: r.id,
        userId: r.userId,
        employeeName: r.user.name,
        employeeEmail: r.user.email,
        role: r.user.role,
        avatarUrl: r.user.avatarUrl,
        store: r.storeCode,
        date: r.localDate,
        shiftStart: r.shiftStartUtc.toISOString(),
        shiftEnd: r.shiftEndUtc ? r.shiftEndUtc.toISOString() : null,
        totalSeconds: activeSeconds,
        totalHHMM: formatHHMM(activeSeconds),
        totalHHMMSS: formatHHMMSS(activeSeconds),
        status: r.status,
        createdAt: r.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      count: formattedRecords.length,
      records: formattedRecords,
    });
  } catch (err: any) {
    console.error('API /api/attendance error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
