import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, email, name, role, store, status, securityLevel, password, shiftStatus } = body;

    if (!id && !email) {
      return NextResponse.json({ success: false, error: 'User ID or Email is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (store) updateData.storeScope = store;
    if (status) updateData.status = status;
    if (securityLevel !== undefined) updateData.securityLevel = securityLevel;
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

    return NextResponse.json({
      success: true,
      message: 'User profile updated in MySQL database successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
