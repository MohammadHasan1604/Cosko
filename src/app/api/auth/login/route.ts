import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword, signSessionToken, isValidAuthOrigin } from '@/lib/auth';
import { checkRateLimit, recordFailedAttempt, clearRateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // 1. Origin / CSRF validation
  if (!isValidAuthOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden: Invalid request origin' }, { status: 403 });
  }

  const clientIp = getClientIp(req);

  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const cleanEmail = body.email.toLowerCase().trim();
    const password = body.password;

    // 2. Rate Limiting Check (by IP and Email Identifier)
    const ipRateLimit = checkRateLimit(`ip:${clientIp}`);
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${ipRateLimit.retryAfterSeconds || 900} seconds.`,
          retryAfter: ipRateLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    const emailRateLimit = checkRateLimit(`email:${cleanEmail}`);
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts for this account. Please try again in ${emailRateLimit.retryAfterSeconds || 900} seconds.`,
          retryAfter: emailRateLimit.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // 3. User Lookup in MySQL
    let user;
    try {
      user = await prisma.userAccount.findUnique({
        where: { email: cleanEmail },
        include: { storeAssignments: true },
      });
    } catch (dbError: any) {
      console.error('Database connection error during login lookup:', dbError?.message || dbError);
      return NextResponse.json(
        { error: 'Authentication service is temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    // 4. Generic rejection on missing user (prevents account enumeration)
    if (!user) {
      recordFailedAttempt(`ip:${clientIp}`);
      recordFailedAttempt(`email:${cleanEmail}`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 5. Check if user is suspended or inactive
    if (user.status === 'Suspended' || user.status === 'Inactive') {
      return NextResponse.json(
        { error: 'Account is inactive or suspended. Please contact Super Admin.' },
        { status: 403 }
      );
    }

    // 6. Verify salted bcrypt hash
    let passwordMatch = false;
    try {
      passwordMatch = await comparePassword(password, user.passwordHash);
    } catch (hashError) {
      console.error('Error verifying password hash:', hashError);
      passwordMatch = false;
    }

    if (!passwordMatch) {
      recordFailedAttempt(`ip:${clientIp}`);
      recordFailedAttempt(`email:${cleanEmail}`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // 7. Successful Authentication - Clear rate limit counters
    clearRateLimit(`ip:${clientIp}`);
    clearRateLimit(`email:${cleanEmail}`);

    // Update last login timestamp safely
    try {
      await prisma.userAccount.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    } catch (updateErr) {
      console.warn('Could not update last login timestamp:', updateErr);
    }

    const allowedStores = user.storeAssignments.map((a) => a.storeCode);
    if (user.storeScope && !allowedStores.includes(user.storeScope)) {
      allowedStores.push(user.storeScope);
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as any,
      securityLevel: user.securityLevel,
      store: user.storeScope,
      allowedStores: allowedStores.length > 0 ? allowedStores : (user.role === 'Super Admin' ? ['CENTRAL', 'BLR', 'HYD', 'DEL', 'MUM'] : [user.storeScope]),
      avatar: user.name.substring(0, 2).toUpperCase(),
      shiftStatus: user.shiftStatus as any,
      avatarUrl: user.avatarUrl || undefined,
      mustChangePassword: user.mustChangePassword || false,
    };

    const token = signSessionToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      token,
      mustChangePassword: sessionUser.mustChangePassword,
    });

    // Set secure HttpOnly session cookie
    response.cookies.set('cosko_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Unhandled login error:', error);
    return NextResponse.json(
      { error: 'Authentication service is temporarily unavailable. Please try again.' },
      { status: 503 }
    );
  }
}
