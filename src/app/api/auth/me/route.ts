import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, reason: 'Unauthenticated: No active session token provided' },
        { status: 401 }
      );
    }

    const verification = verifySession(token);
    if (!verification.valid || !verification.session) {
      return NextResponse.json(
        { authenticated: false, reason: verification.reason || 'Unauthenticated: Invalid or expired session' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: verification.session.userId,
        storeScope: verification.session.storeScope,
        securityLevel: verification.session.securityLevel,
        expiresAt: verification.session.expiresAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false, reason: 'Internal Server Authentication Verification Error' },
      { status: 500 }
    );
  }
}
