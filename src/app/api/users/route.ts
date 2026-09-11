import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/users - Retrieve user accounts list with store assignments (excludes Suspended/Inactive by default)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.status = { notIn: ['Inactive', 'Suspended'] };
    }

    const users = await prisma.userAccount.findMany({
      where: whereClause,
      include: {
        storeAssignments: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const safeUsers = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      securityLevel: u.securityLevel,
      store: u.storeAssignments?.[0]?.storeCode || (u.role === 'Super Admin' ? 'All Stores' : 'CENTRAL'),
      status: u.status,
      assignedStores: u.storeAssignments.map((a: any) => a.storeCode),
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    }));

    return NextResponse.json(
      { success: true, users: safeUsers },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('API /api/users GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}
