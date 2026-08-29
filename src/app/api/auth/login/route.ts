import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { comparePassword, signSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.userAccount.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { storeAssignments: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status === 'Suspended' || user.status === 'Inactive') {
      return NextResponse.json({ error: 'Account is suspended or inactive. Contact Super Admin.' }, { status: 403 });
    }

    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Update last login timestamp
    await prisma.userAccount.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

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
      allowedStores,
      avatar: user.name.substring(0, 2).toUpperCase(),
      shiftStatus: user.shiftStatus as any,
      avatarUrl: user.avatarUrl || undefined,
    };

    const token = signSessionToken(sessionUser);

    const response = NextResponse.json({ success: true, user: sessionUser, token });
    response.cookies.set('cosko_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
  }
}
