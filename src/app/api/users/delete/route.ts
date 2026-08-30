import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = getAuthUserFromRequest(request);

    if (!session || session.role !== 'Super Admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized: Only Super Admin can deactivate or delete users' }, { status: 403 });
    }

    const { id, email, permanent } = await request.json();

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

      return NextResponse.json({
        success: true,
        mode: 'archived',
        hasHistory,
        message: hasHistory
          ? `User "${target.name}" has business audit logs (${auditCount} logs, ${salesCount} sales) and was deactivated safely.`
          : `User "${target.name}" deactivated successfully.`,
      });
    }

    // Hard-delete if 0 history
    await prisma.userStoreAssignment.deleteMany({ where: { userId: target.id } });
    await prisma.userAccount.delete({ where: { id: target.id } });

    return NextResponse.json({
      success: true,
      mode: 'deleted',
      message: `User account "${target.name}" permanently deleted from MySQL database.`,
    });
  } catch (error: any) {
    console.error('API /api/users/delete error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

