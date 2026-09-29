import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signSessionToken, hashToken, SessionUser, isValidAuthOrigin } from '@/lib/auth';
import { authenticateRequest } from '@/lib/authPipeline';

/**
 * POST /api/auth/update-profile
 * Updates user profile (name, phone, avatar)
 * Secure authoritative update tied to DB session.
 */
export async function POST(req: NextRequest) {
  if (!isValidAuthOrigin(req)) {
    return NextResponse.json(
      { success: false, message: 'Forbidden: Invalid request origin' },
      { status: 403 }
    );
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth.user || !auth.user.id) {
      return NextResponse.json(
        { success: false, message: auth.error || 'Unauthorized' },
        { status: auth.status }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: 'Invalid request payload' },
        { status: 400 }
      );
    }

    const { name, phone, avatarUrl } = body;

    if (name && !name.trim()) {
      return NextResponse.json(
        { success: false, message: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.userAccount.update({
      where: { id: auth.user.id },
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
      allowedStores: auth.user.allowedStores,
      avatar: updatedUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2),
      avatarUrl: updatedUser.avatarUrl || undefined,
      sessionId: auth.user.sessionId,
    };

    const newToken = signSessionToken(updatedSessionUser, auth.user.sessionId);

    // Update DB session token hash if applicable
    if (auth.user.sessionId && auth.user.sessionId !== 'jwt-only') {
      try {
        const newTokenHash = hashToken(newToken);
        await prisma.userSession.update({
          where: { id: auth.user.sessionId },
          data: { tokenHash: newTokenHash },
        });
      } catch (err) {
        console.warn('Could not update session token hash:', err);
      }
    }

    const response = NextResponse.json({
      success: true,
      user: updatedSessionUser,
      message: 'Profile updated successfully',
    });

    // Refresh JWT session cookie (30-day lifetime)
    response.cookies.set('cosko_session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
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
