import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
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

    const newUser = await prisma.userAccount.create({
      data: {
        email: cleanEmail,
        passwordHash: hashedPassword,
        name,
        phone: phone || null,
        role: role || 'Employee',
        securityLevel: level,
        storeScope: store || 'BLR',
        status: status || 'Active',
        shiftStatus: 'On Shift',
      },
    });

    if (store) {
      await prisma.userStoreAssignment.create({
        data: {
          userId: newUser.id,
          storeCode: store,
        },
      });
    }

    return NextResponse.json({
      success: true,
      userId: newUser.id,
      message: 'User provisioned in MySQL database successfully',
    });
  } catch (error: any) {
    console.error('API /api/users/create error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
