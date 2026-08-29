import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySessionToken, comparePassword, hashPassword } from '@/lib/auth';

/**
 * POST /api/auth/change-password
 * Secure password change for currently authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('cosko_session')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Active session required' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ success: false, message: 'All password fields are required' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, message: 'New password and confirmation do not match' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Lookup user in MySQL
    const user = await prisma.userAccount.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'User account not found' }, { status: 404 });
    }

    // Verify current password against salted hash
    const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json({ success: false, message: 'Incorrect current password' }, { status: 400 });
    }

    // Hash new password with salted bcrypt (work factor 12)
    const newPasswordHash = await hashPassword(newPassword);

    await prisma.userAccount.update({
      where: { id: session.id },
      data: { passwordHash: newPasswordHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Your new credentials are now active.',
    });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to change password', error: error.message },
      { status: 500 }
    );
  }
}
