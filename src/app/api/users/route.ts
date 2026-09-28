import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { authenticateRequest, createAuditLog, invalidateUserSessions, hasPermission, generateSecureTemporaryPassword } from '@/lib/authPipeline';
import { ROLE_SECURITY_LEVELS, SUPER_ADMIN_PROTECTED_PERMISSIONS, type UserRole } from '@/lib/rbacEngine';

// Whitelist allowed roles and map to security levels — prevent mass assignment
const ROLE_LEVEL_MAP: Record<string, number> = {
  'Store Manager': 80,
  'Inventory Manager': 60,
  'Sales Executive': 40,
  'POS Cashier': 20,
  'Restricted Employee': 10,
};

/**
 * GET /api/users - Retrieve user accounts list with store assignments
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const user = auth.user;

    if (!hasPermission(user, 'users.view')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to view users' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const whereClause: any = {};
    if (!includeInactive) {
      whereClause.status = { notIn: ['Inactive', 'Suspended'] };
    }

    if (user.role !== 'Super Admin') {
      const userAllowed = user.allowedStores.length > 0 ? user.allowedStores : [user.store];
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
      lastLoginAt: u.lastLogin,
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
 * POST /api/users - Create/Provision a new user account (AUTHORITATIVE ENDPOINT)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const authUser = auth.user;

    if (!hasPermission(authUser, 'users.create')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to create users' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, phone, store, status } = body;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json({ success: false, error: 'Password is required (minimum 8 characters)' }, { status: 400 });
    }

    const requestedRole = body.role || 'POS Cashier';
    const requestedLevel = body.securityLevel !== undefined ? Number(body.securityLevel) : undefined;

    // 🔒 STRICT SUPER ADMIN SINGLETON: No user can create another Super Admin
    if (requestedRole === 'Super Admin' || requestedLevel === 100) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: System enforces exactly ONE protected Super Admin. Creating additional Super Admin accounts is prohibited.' },
        { status: 403 }
      );
    }

    // Validate role is in the allowed set
    if (!ROLE_LEVEL_MAP[requestedRole]) {
      return NextResponse.json(
        { success: false, error: `Invalid role: "${requestedRole}". Allowed roles: ${Object.keys(ROLE_LEVEL_MAP).join(', ')}` },
        { status: 400 }
      );
    }

    // 🔒 securityLevel derived server-side from role - client value ignored
    const targetLevel = ROLE_LEVEL_MAP[requestedRole];

    // 🔒 LEVEL CEILING: Caller cannot create users at or above their own level
    if (authUser.role !== 'Super Admin' && targetLevel >= authUser.securityLevel) {
      return NextResponse.json(
        { success: false, error: `Forbidden: You cannot create users at or above your own security level (${authUser.securityLevel}).` },
        { status: 403 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const existing = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    // Resolve assigned stores
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

    // 🔒 Non-Super-Admin callers can only assign stores they have access to
    if (authUser.role !== 'Super Admin') {
      const callerAllowed = authUser.allowedStores.length > 0 ? authUser.allowedStores : [authUser.store];
      const hasInvalidAssignment = targetAssignedStores.some((s) => !callerAllowed.includes(s));
      if (hasInvalidAssignment) {
        return NextResponse.json({ success: false, error: 'Forbidden: You can only assign users to stores you are authorized for' }, { status: 403 });
      }
    }

    // 🔒 Check protected permission overrides
    if (Array.isArray(body.overrides)) {
      for (const ov of body.overrides) {
        if (ov.overrideType === 'ALLOW' && SUPER_ADMIN_PROTECTED_PERMISSIONS.includes(ov.permissionCode) && targetLevel < 100) {
          return NextResponse.json({ success: false, error: `Cannot grant protected permission "${ov.permissionCode}" to roles below Level 100` }, { status: 403 });
        }
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
          role: requestedRole,
          securityLevel: targetLevel,
          storeScope: primaryStore,
          status: status || 'Active',
          shiftStatus: 'On Shift',
          mustChangePassword: true,
        } as any,
      });

      for (const sCode of targetAssignedStores) {
        await tx.userStoreAssignment.create({
          data: { userId: user.id, storeCode: sCode },
        });
      }

      // Create permission overrides if provided
      if (Array.isArray(body.overrides)) {
        for (const ov of body.overrides) {
          if (ov.permissionCode && (ov.overrideType === 'ALLOW' || ov.overrideType === 'DENY')) {
            await tx.userPermissionOverride.create({
              data: { userId: user.id, permissionCode: ov.permissionCode, overrideType: ov.overrideType },
            });
          }
        }
      }

      return user;
    });

    // Audit log
    await createAuditLog(authUser, 'Users', 'User Created', 
      `Created user "${newUser.name}" (${newUser.email}) with role ${requestedRole} at stores [${targetAssignedStores.join(', ')}]`);

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
      message: `User "${newUser.name}" provisioned successfully.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/users POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

/**
 * PUT /api/users - Update user account details (AUTHORITATIVE ENDPOINT)
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const authUser = auth.user;

    if (!hasPermission(authUser, 'users.edit')) {
      return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions to modify users' }, { status: 403 });
    }

    const body = await req.json();
    const { id, email, name, store, status, password, shiftStatus, allowedStores, assignedStores, overrides } = body;

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'User ID or Email is required' }, { status: 400 });
    }

    const targetUser = await prisma.userAccount.findFirst({
      where: id ? { id } : { email: email?.toLowerCase().trim() },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User account not found' }, { status: 404 });
    }

    const requestedRole = body.role;
    const requestedLevel = body.securityLevel !== undefined ? Number(body.securityLevel) : undefined;

    // 🔒 STRICT SUPER ADMIN SINGLETON: Cannot promote any user to Super Admin
    if (targetUser.role !== 'Super Admin' && (requestedRole === 'Super Admin' || requestedLevel === 100)) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: System enforces exactly ONE protected Super Admin. Promoting accounts to Super Admin is prohibited.',
      }, { status: 403 });
    }

    // 🔒 Super Admin cannot be demoted/deleted/deactivated
    if (targetUser.role === 'Super Admin') {
      if (requestedRole && requestedRole !== 'Super Admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Super Admin cannot be demoted' }, { status: 403 });
      }
      if (status === 'Inactive' || status === 'Suspended') {
        return NextResponse.json({ success: false, error: 'Forbidden: Super Admin cannot be deactivated or suspended' }, { status: 403 });
      }
    }

    if (authUser.role !== 'Super Admin') {
      if (targetUser.role === 'Super Admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: Only Super Admin can modify Super Admin accounts' }, { status: 403 });
      }
      // Store scope check
      const callerAllowed = authUser.allowedStores.length > 0 ? authUser.allowedStores : [authUser.store];
      if (targetUser.storeScope && !callerAllowed.includes(targetUser.storeScope)) {
        return NextResponse.json({ success: false, error: 'Forbidden: You cannot modify users outside your assigned stores' }, { status: 403 });
      }
      // Level ceiling
      if (requestedRole && ROLE_LEVEL_MAP[requestedRole] !== undefined) {
        if (ROLE_LEVEL_MAP[requestedRole] >= authUser.securityLevel) {
          return NextResponse.json({ success: false, error: `Forbidden: Cannot assign role "${requestedRole}" at or above your own level.` }, { status: 403 });
        }
      }
      // Cannot edit users at equal or higher level
      if (targetUser.securityLevel >= authUser.securityLevel) {
        return NextResponse.json({ success: false, error: 'Forbidden: Cannot modify users at equal or higher security level' }, { status: 403 });
      }
      // Validate store assignments are within caller's scope
      const rawStoresToCheck = Array.isArray(assignedStores) ? assignedStores : Array.isArray(allowedStores) ? allowedStores : null;
      if (rawStoresToCheck) {
        const hasInvalidAssignment = rawStoresToCheck.some((s: string) => !callerAllowed.includes(s));
        if (hasInvalidAssignment) {
          return NextResponse.json({ success: false, error: 'Forbidden: You can only assign stores you are authorized for' }, { status: 403 });
        }
      }
    }

    // 🔒 Check protected permission overrides
    if (Array.isArray(overrides)) {
      const effectiveTargetLevel = (requestedRole && ROLE_LEVEL_MAP[requestedRole]) || targetUser.securityLevel;
      for (const ov of overrides) {
        if (ov.overrideType === 'ALLOW' && SUPER_ADMIN_PROTECTED_PERMISSIONS.includes(ov.permissionCode) && effectiveTargetLevel < 100) {
          return NextResponse.json({ success: false, error: `Cannot grant protected permission "${ov.permissionCode}" to roles below Level 100` }, { status: 403 });
        }
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (requestedRole && targetUser.role !== 'Super Admin') {
      if (ROLE_LEVEL_MAP[requestedRole]) {
        updateData.role = requestedRole;
        updateData.securityLevel = ROLE_LEVEL_MAP[requestedRole]; // Server-derived
      }
    }
    if (status) updateData.status = status;
    if (shiftStatus) updateData.shiftStatus = shiftStatus;

    // 🔒 Protected Super Admin preserves role and scope unconditionally
    if (targetUser.role === 'Super Admin') {
      updateData.role = 'Super Admin';
      updateData.securityLevel = 100;
      updateData.storeScope = 'All Stores';
    }

    if (password) {
      if (password.length < 8) {
        return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
      }
      updateData.passwordHash = await hashPassword(password);
      updateData.mustChangePassword = true;
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
      const user = await tx.userAccount.update({
        where: { id: targetUser.id },
        data: updateData,
      });

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
        await tx.userPermissionOverride.deleteMany({ where: { userId: user.id } });
        for (const ov of overrides) {
          if (ov.permissionCode && (ov.overrideType === 'ALLOW' || ov.overrideType === 'DENY')) {
            await tx.userPermissionOverride.create({
              data: { userId: user.id, permissionCode: ov.permissionCode, overrideType: ov.overrideType },
            });
          }
        }
      }

      return user;
    });

    // 🔒 Invalidate sessions on status change or password reset
    if (status === 'Inactive' || status === 'Suspended' || password) {
      await invalidateUserSessions(targetUser.id);
    }

    // Audit log
    const changes: string[] = [];
    if (name) changes.push(`name="${name}"`);
    if (body.role) changes.push(`role=${body.role}`);
    if (status) changes.push(`status=${status}`);
    if (password) changes.push('password=reset');
    if (targetStores) changes.push(`stores=[${targetStores.join(',')}]`);
    await createAuditLog(authUser, 'Users', 'User Updated',
      `Updated user "${targetUser.name}" (${targetUser.email}): ${changes.join(', ')}`);

    broadcastRealtimeEvent('users', 'USER_UPDATED', { userId: updatedUser.id, email: updatedUser.email, action: 'updated' });

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        securityLevel: updatedUser.securityLevel,
        store: updatedUser.storeScope,
        status: updatedUser.status,
      },
      message: 'User profile updated successfully',
    });
  } catch (error: any) {
    console.error('API /api/users PUT error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/users - Safe deactivate or delete user account (AUTHORITATIVE ENDPOINT)
 */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const session = auth.user;

    if (session.role !== 'Super Admin') {
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

    // 🔒 Invalidate all sessions for the target user
    await invalidateUserSessions(target.id);

    if (hasHistory || !permanent) {
      await prisma.userAccount.update({
        where: { id: target.id },
        data: { status: 'Inactive' },
      });

      await createAuditLog(session, 'Users', 'User Deactivated',
        `Deactivated user "${target.name}" (${target.email}). History: ${auditCount} audit logs, ${salesCount} sales`);

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
    await prisma.$transaction(async (tx: any) => {
      await tx.userPermissionOverride.deleteMany({ where: { userId: target.id } });
      await tx.userStoreAssignment.deleteMany({ where: { userId: target.id } });
      await tx.userSession.deleteMany({ where: { userId: target.id } });
      await tx.userAccount.delete({ where: { id: target.id } });
    });

    await createAuditLog(session, 'Users', 'User Deleted',
      `Permanently deleted user "${target.name}" (${target.email})`);

    broadcastRealtimeEvent('users', 'USER_UPDATED', { userId: target.id, email: target.email, action: 'deleted' });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `User account "${target.name}" permanently deleted from database.`,
    });
  } catch (error: any) {
    console.error('API /api/users DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
