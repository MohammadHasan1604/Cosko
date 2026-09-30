import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/authPipeline';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.user) {
      return NextResponse.json(
        { authenticated: false, reason: auth.error || 'Unauthorized: No active session' },
        { status: auth.status || 401 }
      );
    }

    const u = auth.user;
    const authoritativeUser = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      securityLevel: u.securityLevel,
      store: u.store,
      allowedStores: u.allowedStores,
      permissions: u.permissions,
      overrides: u.overrides,
      avatar: u.name.substring(0, 2).toUpperCase(),
      avatarUrl: u.avatarUrl || undefined,
      mustChangePassword: u.mustChangePassword || false,
    };

    return NextResponse.json(
      {
        authenticated: true,
        user: authoritativeUser,
        mustChangePassword: authoritativeUser.mustChangePassword,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (err: any) {
    console.error('Auth verification error in /api/auth/me:', err);
    return NextResponse.json(
      { authenticated: false, reason: 'Authentication service temporarily unavailable' },
      { status: 503 }
    );
  }
}
