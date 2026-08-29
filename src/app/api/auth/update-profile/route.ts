import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifySessionToken, signSessionToken, SessionUser } from '@/lib/auth';

/**
 * POST /api/auth/update-profile
 * Updates user profile (name, phone, avatar)
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('cosko_session')?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session || !session.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, avatarUrl } = body;

    if (name && !name.trim()) {
      return NextResponse.json({ success: false, message: 'Name cannot be empty' }, { status: 400 });
    }

    const updatedUser = await prisma.userAccount.update({
      where: { id: session.id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      },
    });

    const updatedSessionUser: SessionUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role as SessionUser['role'],
      securityLevel: updatedUser.securityLevel,
      store: updatedUser.storeScope,
      avatar: updatedUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2),
      avatarUrl: updatedUser.avatarUrl || undefined,
      shiftStatus: (updatedUser.shiftStatus as 'On Shift' | 'On Leave') || 'On Shift',
    };

    const response = NextResponse.json({
      success: true,
      user: updatedSessionUser,
      message: 'Profile updated successfully',
    });

    // Refresh JWT session cookie
    const newToken = signSessionToken(updatedSessionUser);
    response.cookies.set('cosko_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update profile', error: error.message },
      { status: 500 }
    );
  }
}
