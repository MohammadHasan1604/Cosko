import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/audit-logs - Retrieve audit logs
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.securityLevel < 80) {
      return NextResponse.json({ error: 'Forbidden: Audit log access requires security level 80+' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const module = searchParams.get('module');

    const whereClause: any = {};
    if (module) {
      whereClause.module = module;
    }

    const logs = await (prisma as any).auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(
      { success: true, logs },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/audit-logs GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit logs' }, { status: 500 });
  }
}

/**
 * POST /api/audit-logs - Create audit log entry
 */
export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.module || !body.action) {
      return NextResponse.json({ error: 'Module and action are required' }, { status: 400 });
    }

    const log = await (prisma as any).auditLog.create({
      data: {
        module: body.module,
        action: body.action,
        details: body.details || '',
        userEmail: body.userEmail || user.email || user.name,
        userRole: body.userRole || user.role,
        storeCode: body.storeCode || 'CENTRAL',
      },
    });

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/audit-logs POST error:', error);
    return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
  }
}
