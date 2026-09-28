import { NextRequest, NextResponse } from 'next/server';
import { getRawTokenFromRequest, hashToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/authPipeline';

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const rawToken = getRawTokenFromRequest(req);

    // Revoke database-backed session by token hash
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

    // Also revoke by session ID from auth pipeline
    if (auth.user?.sessionId && auth.user.sessionId !== 'jwt-only') {
      try {
        await (prisma as any).userSession.update({
          where: { id: auth.user.sessionId },
          data: { revokedAt: new Date() },
        });
      } catch {}
    }

    // Close work sessions
    if (auth.user?.id) {
      await prisma.userWorkSession.updateMany({
        where: {
          userId: auth.user.id,
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
