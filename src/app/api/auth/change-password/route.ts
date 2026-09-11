import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySessionToken, comparePassword, hashPassword, signSessionToken, isValidAuthOrigin } from '@/lib/auth';

/**
 * POST /api/auth/change-password
 * Secure password change for currently authenticated user
 */
export async function POST(req: NextRequest) {
  if (!isValidAuthOrigin(req)) {
    return NextResponse.json({ success: false, message: 'Forbidden: Invalid request origin' }, { status: 403 });
  }

  try {
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('cosko_session')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

    const session = token ? verifySessionToken(token) : null;

    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Active session required' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request payload' }, { status: 400 });
    }

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

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: 'New password cannot be the same as current password' },
        { status: 400 }
      );
    }

    // Lookup user in MySQL
    const user = await prisma.userAccount.findUnique({
      where: { id: session.id },
      include: { storeAssignments: true },
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

    // Commit new password and reset mustChangePassword flag
    const updatedUser = await prisma.userAccount.update({
      where: { id: session.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    // Issue updated token
    const allowedStores = user.storeAssignments.map((a) => a.storeCode);
    const updatedSessionUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as any,
      securityLevel: updatedUser.securityLevel,
      store: updatedUser.storeScope,
      allowedStores: allowedStores.length > 0 ? allowedStores : (updatedUser.role === 'Super Admin' ? ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'] : [updatedUser.storeScope]),
      avatar: updatedUser.name.substring(0, 2).toUpperCase(),
      shiftStatus: updatedUser.shiftStatus as any,
      avatarUrl: updatedUser.avatarUrl || undefined,
      mustChangePassword: false,
    };

    const newToken = signSessionToken(updatedSessionUser);

    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully. Your new credentials are now active.',
      token: newToken,
      user: updatedSessionUser,
    });

    // Update HttpOnly cookie with new token
    response.cookies.set('cosko_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to change password. Database temporarily unavailable.' },
      { status: 500 }
    );
  }
}
