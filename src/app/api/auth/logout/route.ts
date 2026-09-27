import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, getRawTokenFromRequest, hashToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = getAuthUserFromRequest(req);
    const rawToken = getRawTokenFromRequest(req);

    // Revoke database-backed session
    if (rawToken) {
      const tokenDigest = hashToken(rawToken);
      try {
        await (prisma as any).userSession.updateMany({
          where: { tokenHash: tokenDigest, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch (err) {
        console.warn('Could not revoke DB session:', err);
      }
    }

    // Also revoke by session ID from JWT
    if (user?.sessionId) {
      try {
        await (prisma as any).userSession.update({
          where: { id: user.sessionId },
          data: { revokedAt: new Date() },
        });
      } catch {}
    }

    // Close work sessions
    if (user?.id) {
      await prisma.userWorkSession.updateMany({
        where: {
          userId: user.id,
          isClosed: false,
        },
        data: {
          isClosed: true,
          endedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.warn('Could not close user work session on logout:', err);
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set('cosko_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    expires: new Date(0),
    path: '/',
  });
  return response;
}
