import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, hashToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('cosko_session')?.value;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : cookieToken;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, reason: 'Unauthenticated: No active session token provided' },
        { status: 401 }
      );
    }

    // Cryptographic JWT verification
    const sessionResult = verifySessionToken(token);
    if (!sessionResult || !sessionResult.user || !sessionResult.user.id) {
      return NextResponse.json(
        { authenticated: false, reason: 'Unauthenticated: Invalid or expired session' },
        { status: 401 }
      );
    }

    // Check DB-backed session for revocation
    const tokenDigest = hashToken(token);
    try {
      const dbSession = await (prisma as any).userSession.findUnique({
        where: { tokenHash: tokenDigest },
      });
      if (dbSession) {
        if (dbSession.revokedAt) {
          return NextResponse.json(
            { authenticated: false, reason: 'Session has been revoked. Please log in again.' },
            { status: 401 }
          );
        }
        if (dbSession.expiresAt < new Date()) {
          return NextResponse.json(
            { authenticated: false, reason: 'Session has expired. Please log in again.' },
            { status: 401 }
          );
        }
      }
      // If no DB session found, JWT is still valid (graceful for sessions created before migration)
    } catch (sessionCheckErr) {
      // DB session check failed — allow JWT-only auth as fallback to avoid blocking users during migration
      console.warn('DB session check failed (allowing JWT-only):', sessionCheckErr);
    }

    const sessionUser = sessionResult.user;

    // Verify against MySQL database for authoritative live status
    const dbUser = await prisma.userAccount.findFirst({
      where: {
        OR: [{ id: sessionUser.id }, { email: sessionUser.email.toLowerCase().trim() }],
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
        { authenticated: false, reason: `Account is ${dbUser.status}. Access denied.` },
        { status: 403 }
      );
    }

    const allowedStores = dbUser.storeAssignments.map((a) => a.storeCode);
    if (dbUser.storeScope && !allowedStores.includes(dbUser.storeScope)) {
      allowedStores.push(dbUser.storeScope);
    }

    const effectiveStore =
      dbUser.role === 'Super Admin'
        ? dbUser.storeScope || 'All Stores'
        : dbUser.storeScope && dbUser.storeScope !== 'All Stores'
          ? dbUser.storeScope
          : allowedStores[0] || 'BLR';

    const authoritativeUser = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as any,
      securityLevel: dbUser.securityLevel,
      store: effectiveStore,
      allowedStores:
        dbUser.role === 'Super Admin'
          ? allowedStores.length > 0
            ? allowedStores
            : ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM']
          : allowedStores.length > 0
            ? allowedStores
            : [effectiveStore],
      avatar: dbUser.name.substring(0, 2).toUpperCase(),
      shiftStatus: dbUser.shiftStatus as any,
      avatarUrl: dbUser.avatarUrl || undefined,
      mustChangePassword: dbUser.mustChangePassword || false,
    };

    return NextResponse.json(
      {
        authenticated: true,
        user: authoritativeUser,
        mustChangePassword: authoritativeUser.mustChangePassword,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (err: any) {
    console.error('Auth verification error in /api/auth/me:', err);
    return NextResponse.json(
      { authenticated: false, reason: 'Authentication service temporarily unavailable' },
      { status: 503 }
    );
  }
}
