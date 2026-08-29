import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, isSessionRevoked } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('cosko_session')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

    if (!token || isSessionRevoked(token)) {
      return NextResponse.json(
        { authenticated: false, reason: 'Unauthenticated: No active session token provided' },
        { status: 401 }
      );
    }

    const sessionUser = verifySessionToken(token);
    if (!sessionUser) {
      return NextResponse.json(
        { authenticated: false, reason: 'Unauthenticated: Invalid or expired session' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: sessionUser,
    });
  } catch {
    return NextResponse.json(
      { authenticated: false, reason: 'Internal Server Authentication Verification Error' },
      { status: 500 }
    );
  }
}
