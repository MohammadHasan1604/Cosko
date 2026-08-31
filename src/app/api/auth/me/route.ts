import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, isSessionRevoked } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    if (!sessionUser || !sessionUser.id) {
      return NextResponse.json(
        { authenticated: false, reason: 'Unauthenticated: Invalid or expired session' },
        { status: 401 }
      );
    }

    // Verify against MySQL database for authoritative live status
    const dbUser = await prisma.userAccount.findFirst({
      where: {
        OR: [
          { id: sessionUser.id },
          { email: sessionUser.email.toLowerCase().trim() },
        ],
      },
      include: {
        storeAssignments: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { authenticated: false, reason: 'Account no longer exists in database' },
        { status: 401 }
      );
    }

    if (dbUser.status === 'Suspended' || dbUser.status === 'Inactive') {
      return NextResponse.json(
        { authenticated: false, reason: `Account is ${dbUser.status}` },
        { status: 403 }
      );
    }

    const allowedStores = dbUser.storeAssignments.map((a) => a.storeCode);
    if (dbUser.storeScope && !allowedStores.includes(dbUser.storeScope)) {
      allowedStores.push(dbUser.storeScope);
    }

    const authoritativeUser = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as any,
      securityLevel: dbUser.securityLevel,
      store: dbUser.storeScope,
      allowedStores: allowedStores.length > 0 ? allowedStores : (dbUser.role === 'Super Admin' ? ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'] : [dbUser.storeScope]),
      avatar: dbUser.name.substring(0, 2).toUpperCase(),
      shiftStatus: dbUser.shiftStatus as any,
      avatarUrl: dbUser.avatarUrl || undefined,
    };

    return NextResponse.json(
      {
        authenticated: true,
        user: authoritativeUser,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    console.error('Auth verification error in /api/auth/me:', err);
    return NextResponse.json(
      { authenticated: false, reason: 'Database temporarily unavailable' },
      { status: 500 }
    );
  }
}

