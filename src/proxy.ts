import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check JWT cookie
  const token = req.cookies.get('osakidetza_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.SESSION_SECRET ?? 'osakidetza-session-secret-2026'
    );
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    // Invalid or expired token
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('osakidetza_session');
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
