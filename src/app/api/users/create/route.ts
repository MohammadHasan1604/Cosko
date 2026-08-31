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

    const cleanEmail = email.toLowerCase().trim();
    const level = securityLevel || (role === 'Super Admin' ? 100 : role === 'Store Manager' ? 80 : role === 'Inventory Auditor' ? 60 : role === 'Sales Executive' ? 40 : 20);

    const existing = await prisma.userAccount.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: 'User with this email already exists' }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const storeCode = store || 'BLR';

    // Execute atomic transaction for user and store assignments
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.userAccount.create({
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
          mustChangePassword: true, // Force password change on first login
        },
      });

      if (storeCode && storeCode !== 'All Stores') {
        await tx.userStoreAssignment.create({
          data: {
            userId: user.id,
            storeCode: storeCode,
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
      assignedStores: [storeCode],
      createdAt: newUser.createdAt,
      shiftStatus: newUser.shiftStatus,
      mustChangePassword: true,
    };

    // Broadcast SSE realtime event
    broadcastRealtimeEvent('users', 'USER_CREATED', { userId: newUser.id, email: newUser.email, store: storeCode });

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
