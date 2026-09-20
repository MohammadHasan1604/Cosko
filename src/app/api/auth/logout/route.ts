import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, revokeSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cookieToken = req.cookies.get('cosko_session')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;
    if (token) {
      revokeSession(token);
    }

    const user = getAuthUserFromRequest(req);
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
    expires: new Date(0),
    path: '/',
  });
  return response;
}
