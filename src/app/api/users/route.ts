import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';

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

/**
 * POST /api/users - Create/Provision a new user account
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(req);
    if (!authUser || (authUser.role !== 'Super Admin' && authUser.securityLevel < 80)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Only Super Admin or Store Managers can create users' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role, store, phone, status, securityLevel } = body;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required to provision a new account' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const level = securityLevel || (role === 'Super Admin' ? 100 : role === 'Store Manager' ? 80 : role === 'Inventory Auditor' ? 60 : role === 'Sales Executive' ? 40 : 20);

    const existing = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const storeCode = (store && store !== 'All Stores' && store !== 'ALL') ? store : 'CENTRAL';

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await (tx.userAccount as any).create({
        data: {
          email: cleanEmail,
          passwordHash: hashedPassword,
          name: name.trim(),
          phone: phone || null,
          role: role || 'Store Manager',
          securityLevel: level,
          storeScope: storeCode,
          status: status || 'Active',
          shiftStatus: 'On Shift',
          mustChangePassword: true,
        } as any,
      });

      await tx.userStoreAssignment.create({
        data: {
          userId: user.id,
          storeCode: storeCode,
        },
      });

      return user;
    });

    const sanitizedUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      securityLevel: newUser.securityLevel,
      store: newUser.storeScope,
      status: newUser.status,
      assignedStores: [storeCode],
      createdAt: newUser.createdAt,
      shiftStatus: newUser.shiftStatus,
      mustChangePassword: true,
    };

    broadcastRealtimeEvent('users', 'USER_CREATED', { userId: newUser.id, email: newUser.email, store: storeCode });

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
      userId: newUser.id,
      message: `User "${newUser.name}" provisioned in MySQL database successfully.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/users POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

/**
 * PUT /api/users - Update user account details
 */
export async function PUT(req: NextRequest) {
  try {
    const authUser = getAuthUserFromRequest(req);
    if (!authUser || (authUser.role !== 'Super Admin' && authUser.securityLevel < 80)) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Only Super Admin or Store Managers can modify users' }, { status: 403 });
    }

    const body = await req.json();
    const { id, email, name, role, store, status, securityLevel, password, shiftStatus } = body;

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'User ID or Email is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (store) updateData.storeScope = store;
    if (status) updateData.status = status;
    if (securityLevel !== undefined) updateData.securityLevel = Number(securityLevel);
    if (shiftStatus) updateData.shiftStatus = shiftStatus;

    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    const updatedUser = id
      ? await prisma.userAccount.update({ where: { id }, data: updateData })
      : await prisma.userAccount.update({ where: { email: email.toLowerCase().trim() }, data: updateData });

    if (store && updatedUser.id) {
      await prisma.userStoreAssignment.upsert({
        where: { userId_storeCode: { userId: updatedUser.id, storeCode: store } },
        create: { userId: updatedUser.id, storeCode: store },
        update: {},
      });
    }

    broadcastRealtimeEvent('users', 'USER_UPDATED', { userId: updatedUser.id, email: updatedUser.email, action: 'updated' });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: 'User profile updated in MySQL database successfully',
    });
  } catch (error: any) {
    console.error('API /api/users PUT error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/users - Safe deactivate or delete user account
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = getAuthUserFromRequest(req);

    if (!session || session.role !== 'Super Admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Only Super Admin can deactivate or delete users' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    let id = idParam;
    let email: string | undefined = undefined;

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
      email = body.email;
    }

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'User ID or Email is required' }, { status: 400 });
    }

    let target = id ? await prisma.userAccount.findUnique({ where: { id } }) : null;
    if (!target && email) {
      target = await prisma.userAccount.findUnique({ where: { email: email.toLowerCase().trim() } });
    }

    if (!target) {
      return NextResponse.json({ success: true, message: 'User already removed or non-existent' });
    }

    if (target.email === session.email) {
      return NextResponse.json({ success: false, error: 'You cannot delete or deactivate your own logged-in account' }, { status: 400 });
    }

    // Check if user has audit logs or sales orders
    const [auditCount, salesCount] = await Promise.all([
      prisma.auditLog.count({ where: { userEmail: target.email } }),
      prisma.salesOrder.count({ where: { cashierName: target.name } }),
    ]);

    const hasHistory = auditCount > 0 || salesCount > 0;

    if (hasHistory || !permanent) {
      await prisma.userAccount.update({
        where: { id: target.id },
        data: { status: 'Inactive' },
      });

      broadcastRealtimeEvent('users', 'USER_UPDATED', { userId: target.id, email: target.email, action: 'deactivated' });

      return NextResponse.json({
        success: true,
        mode: 'archived',
        hasHistory,
        message: hasHistory
          ? `User "${target.name}" has business records (${auditCount} logs, ${salesCount} sales) and was deactivated safely.`
          : `User "${target.name}" deactivated successfully.`,
      });
    }

    // Hard-delete if 0 history
    await prisma.userStoreAssignment.deleteMany({ where: { userId: target.id } });
    await prisma.userAccount.delete({ where: { id: target.id } });

    broadcastRealtimeEvent('users', 'USER_UPDATED', { userId: target.id, email: target.email, action: 'deleted' });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `User account "${target.name}" permanently deleted from MySQL database.`,
    });
  } catch (error: any) {
    console.error('API /api/users DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
