import { NextResponse, type NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const publicPaths = [
  '/sign-up-login',
  '/api/auth/login',
  '/api/settings/branding',  // Only public branding (app name, logo)
];

const AUTH_SECRET = process.env.AUTH_SECRET;
const INSECURE_DEFAULT = 'cosko_insecure_dev_fallback_jwt_key_do_not_use';

/**
 * Cryptographically verify JWT token. Returns true only if the token is
 * a valid JWT signed with AUTH_SECRET and not expired.
 */
function isValidJWT(token: string): boolean {
  if (!AUTH_SECRET) return false;
  if (AUTH_SECRET === INSECURE_DEFAULT && process.env.NODE_ENV === 'production') return false;
  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as any;
    return !!(decoded && decoded.user && decoded.user.id);
  } catch {
    return false;
  }
}

/**
 * Validate Origin/Referer for CSRF protection on state-changing requests.
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  // Non-browser requests (no Origin header) are allowed
  if (!origin && !referer) return true;

  const targetUrl = origin || referer;
  if (!targetUrl) return true;

  try {
    const parsed = new URL(targetUrl);
    if (host && parsed.host === host) return true;
    if (configuredUrl) {
      const parsedConfig = new URL(configuredUrl);
      if (parsed.host === parsedConfig.host) return true;
    }
    if (process.env.NODE_ENV !== 'production' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return true;
    }
  } catch {}

  return false;
}

/**
 * Add security headers to every response.
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, internal next routes, images, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // ─── CSRF Protection: Validate Origin on state-changing requests ───
  const method = request.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!isValidOrigin(request)) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Forbidden: Invalid request origin (CSRF protection)' }, { status: 403 })
      );
    }
  }

  // ─── Cryptographic Authentication ───
  const sessionCookie = request.cookies.get('cosko_session')?.value;
  const isAuth = !!sessionCookie && isValidJWT(sessionCookie);

  // If authenticated and visits login or root, redirect to dashboard
  if (isAuth && (pathname === '/sign-up-login' || pathname === '/')) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  // If visiting public path, allow
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // If visiting root and not authenticated, redirect to /sign-up-login
  if (pathname === '/') {
    return addSecurityHeaders(NextResponse.redirect(new URL('/sign-up-login', request.url)));
  }

  // Protected pages & APIs
  if (!isAuth) {
    // For API requests, check Authorization header with cryptographic verification
    if (pathname.startsWith('/api/')) {
      // Allow /api/auth/me to return unauthenticated JSON instead of redirect
      if (pathname === '/api/auth/me') {
        return addSecurityHeaders(NextResponse.next());
      }
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.substring(7);
        if (isValidJWT(bearerToken)) {
          return addSecurityHeaders(NextResponse.next());
        }
      }
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized: Valid session required' }, { status: 401 })
      );
    }

    // For page requests, redirect to login
    const loginUrl = new URL('/sign-up-login', request.url);
    if (pathname !== '/dashboard') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return addSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
