import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = [
  '/sign-up-login',
  '/api/auth/login',
  '/api/settings',
];

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

  const sessionCookie = request.cookies.get('cosko_session')?.value;
  const isAuth = !!sessionCookie && sessionCookie.length > 20;

  // If user is authenticated and visits login or root, redirect to dashboard
  if (isAuth && (pathname === '/sign-up-login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If visiting public path, allow
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // If visiting root and not authenticated, redirect to /sign-up-login
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/sign-up-login', request.url));
  }

  // Protected pages & APIs
  if (!isAuth) {
    // For API requests, check Authorization header before rejecting
    if (pathname.startsWith('/api/')) {
      // Allow /api/auth/me to return unauthenticated JSON instead of redirect
      if (pathname === '/api/auth/me') {
        return NextResponse.next();
      }
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 30) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    // For page requests, redirect to login
    const loginUrl = new URL('/sign-up-login', request.url);
    if (pathname !== '/dashboard') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

