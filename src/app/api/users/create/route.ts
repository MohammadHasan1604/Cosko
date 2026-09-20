import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, getAuthUserFromRequest } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function POST(request: Request) {
  try {
    const authUser = getAuthUserFromRequest(request);
    // Ensure caller is Super Admin or authorized manager
    if (authUser && authUser.role !== 'Super Admin' && authUser.securityLevel < 80) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Only Super Admin or Store Managers can create users' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, store, phone, status, securityLevel } = body;

    if (!email || !name) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required to provision a new account' }, { status: 400 });
    }

    // 🔒 STRICT SUPER ADMIN SINGLETON: Prohibit creating new Super Admin
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

    // Resolve assigned stores (single source of truth)
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
    if (authUser && authUser.role !== 'Super Admin') {
      const callerAllowed = authUser.allowedStores && authUser.allowedStores.length > 0 ? authUser.allowedStores : [authUser.store];
      const hasInvalidAssignment = targetAssignedStores.some((s) => !callerAllowed.includes(s));
      if (hasInvalidAssignment) {
        return NextResponse.json({ success: false, error: 'Forbidden: You can only assign users to stores you are authorized for' }, { status: 403 });
      }
    }

    const hashedPassword = await hashPassword(password);
    const primaryStore = targetAssignedStores[0];

    // Execute atomic transaction for user and store assignments
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
          mustChangePassword: true, // Force password change on first login
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

    // Broadcast SSE realtime event
    broadcastRealtimeEvent('users', 'USER_CREATED', { userId: newUser.id, email: newUser.email, stores: targetAssignedStores });

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
      userId: newUser.id,
      message: `User "${newUser.name}" provisioned in MySQL database successfully. Temporary password must be changed on first login.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('API /api/users/create error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
