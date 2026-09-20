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

    if (user.role !== 'Super Admin') {
      const userAllowed = user.allowedStores && user.allowedStores.length > 0 ? user.allowedStores : [user.store];
      whereClause.OR = [
        { storeScope: { in: userAllowed } },
        { storeAssignments: { some: { storeCode: { in: userAllowed } } } },
      ];
      whereClause.role = { not: 'Super Admin' };
    }

    const users = await prisma.userAccount.findMany({
      where: whereClause,
      include: {
        storeAssignments: true,
        permissionOverrides: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const safeUsers = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      securityLevel: u.securityLevel,
      store: u.storeScope || u.storeAssignments?.[0]?.storeCode || (u.role === 'Super Admin' ? 'All Stores' : 'CENTRAL'),
      status: u.status,
      shiftStatus: u.shiftStatus || 'On Shift',
      assignedStores: u.storeAssignments?.map((a: any) => a.storeCode) || [],
      allowedStores: u.storeAssignments?.map((a: any) => a.storeCode) || [u.storeScope || 'CENTRAL'],
      overrides: u.permissionOverrides?.map((o: any) => ({
        permissionCode: o.permissionCode,
        overrideType: o.overrideType,
      })) || [],
      avatarUrl: u.avatarUrl,
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

    // 🔒 STRICT SUPER ADMIN SINGLETON: No user can create another Super Admin
    if (role === 'Super Admin' || Number(securityLevel) === 100) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: System enforces exactly ONE protected Super Admin. Creating additional Super Admin accounts is prohibited.' },
        { status: 403 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const level = securityLevel || (role === 'Store Manager' ? 80 : role === 'Inventory Auditor' ? 60 : role === 'Sales Executive' ? 40 : 20);

    const existing = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    // Assigned stores resolution (single source of truth)
    const rawStores: string[] = Array.isArray(body.assignedStores) && body.assignedStores.length > 0
      ? body.assignedStores
      : Array.isArray(body.allowedStores) && body.allowedStores.length > 0
      ? body.allowedStores
      : [store || 'BLR'];

    const validHubs = await prisma.storeHub.findMany({ select: { code: true } });
    const validCodes = new Set(validHubs.map((s) => s.code));
    const targetAssignedStores = rawStores.filter((c: string) => validCodes.has(c));

    if (targetAssignedStores.length === 0) {
      return NextResponse.json({ success: false, error: 'User must be assigned to at least one valid store' }, { status: 400 });
    }

    // Non-Super-Admin callers can only assign stores they have access to
    if (authUser.role !== 'Super Admin') {
      const callerAllowed = authUser.allowedStores && authUser.allowedStores.length > 0 ? authUser.allowedStores : [authUser.store];
      const hasInvalidAssignment = targetAssignedStores.some((s) => !callerAllowed.includes(s));
      if (hasInvalidAssignment) {
        return NextResponse.json({ success: false, error: 'Forbidden: You can only assign users to stores you are authorized for' }, { status: 403 });
      }
    }

    const hashedPassword = await hashPassword(password);
    const primaryStore = targetAssignedStores[0];

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await (tx.userAccount as any).create({
        data: {
          email: cleanEmail,
          passwordHash: hashedPassword,
          name: name.trim(),
          phone: phone || null,
          role: role || 'Store Manager',
          securityLevel: level,
          storeScope: primaryStore,
          status: status || 'Active',
          shiftStatus: 'On Shift',
          mustChangePassword: true,
        } as any,
      });

      for (const sCode of targetAssignedStores) {
        await tx.userStoreAssignment.create({
          data: {
            userId: user.id,
            storeCode: sCode,
          },
        });
      }

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
      assignedStores: targetAssignedStores,
      allowedStores: targetAssignedStores,
      createdAt: newUser.createdAt,
      shiftStatus: newUser.shiftStatus,
      mustChangePassword: true,
    };

    broadcastRealtimeEvent('users', 'USER_CREATED', { userId: newUser.id, email: newUser.email, stores: targetAssignedStores });

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
    const {
      id,
      email,
      name,
      role,
      store,
      status,
      securityLevel,
      password,
      shiftStatus,
      allowedStores,
      assignedStores,
      overrides,
    } = body;

    const targetUser = await prisma.userAccount.findFirst({
      where: id ? { id } : { email: email.toLowerCase().trim() },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User account not found' }, { status: 404 });
    }

    // 🔒 STRICT SUPER ADMIN SINGLETON: Cannot promote any user to Super Admin
    if (targetUser.role !== 'Super Admin' && (role === 'Super Admin' || Number(securityLevel) === 100)) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: System enforces exactly ONE protected Super Admin. Promoting accounts to Super Admin is prohibited.',
      }, { status: 403 });
    }

    if (authUser.role !== 'Super Admin') {
      if (targetUser.role === 'Super Admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Only Super Admin can modify Super Admin accounts' }, { status: 403 });
      }
      const callerAllowed = authUser.allowedStores && authUser.allowedStores.length > 0 ? authUser.allowedStores : [authUser.store];
      if (targetUser.storeScope && !callerAllowed.includes(targetUser.storeScope)) {
        return NextResponse.json({ success: false, error: 'Forbidden: You cannot modify users outside your assigned stores' }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (role && targetUser.role !== 'Super Admin') updateData.role = role;
    if (status) updateData.status = status;
    if (securityLevel !== undefined && targetUser.role !== 'Super Admin') updateData.securityLevel = Number(securityLevel);
    if (shiftStatus) updateData.shiftStatus = shiftStatus;

    // 🔒 Protected Super Admin preserves role and All Stores scope unconditionally
    if (targetUser.role === 'Super Admin') {
      updateData.role = 'Super Admin';
      updateData.securityLevel = 100;
      updateData.storeScope = 'All Stores';
    }

    if (password) {
      updateData.passwordHash = await hashPassword(password);
    }

    const isSuperAdmin = targetUser.role === 'Super Admin';

    // Resolve assigned stores
    const rawStoresToSync: string[] | null = Array.isArray(assignedStores)
      ? assignedStores
      : Array.isArray(allowedStores)
      ? allowedStores
      : store
      ? [store]
      : null;

    let targetStores: string[] | null = null;
    if (rawStoresToSync && !isSuperAdmin) {
      const validHubs = await prisma.storeHub.findMany({ select: { code: true } });
      const validCodes = new Set(validHubs.map((s) => s.code));
      targetStores = rawStoresToSync.filter((c: string) => validCodes.has(c));
      if (targetStores.length > 0) {
        updateData.storeScope = targetStores[0];
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = id
        ? await tx.userAccount.update({ where: { id }, data: updateData })
        : await tx.userAccount.update({ where: { email: email.toLowerCase().trim() }, data: updateData });

      if (targetStores && targetStores.length > 0 && !isSuperAdmin) {
        await tx.userStoreAssignment.deleteMany({
          where: { userId: user.id, storeCode: { notIn: targetStores } },
        });
        for (const sCode of targetStores) {
          await tx.userStoreAssignment.upsert({
            where: { userId_storeCode: { userId: user.id, storeCode: sCode } },
            create: { userId: user.id, storeCode: sCode },
            update: {},
          });
        }
      }

      if (Array.isArray(overrides) && !isSuperAdmin) {
        await tx.userPermissionOverride.deleteMany({
          where: { userId: user.id },
        });
        for (const ov of overrides) {
          if (ov.permissionCode && (ov.overrideType === 'ALLOW' || ov.overrideType === 'DENY')) {
            await tx.userPermissionOverride.create({
              data: {
                userId: user.id,
                permissionCode: ov.permissionCode,
                overrideType: ov.overrideType,
              },
            });
          }
        }
      }

      return user;
    });

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

    // 🔒 STRICT SUPER ADMIN SINGLETON: Protected account cannot be deleted or deactivated
    if (target.role === 'Super Admin') {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: The protected Super Admin root account cannot be deleted or deactivated.',
      }, { status: 403 });
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
