import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PROTECTED_PATH_PREFIXES = ['/dashboard', '/builder', '/tailor', '/settings', '/resumes'];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isProtectedPath = PROTECTED_PATH_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  if (!req.auth?.user) {
    const signInUrl = new URL('/sign-in', nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', `${pathname}${nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/builder/:path*',
    '/tailor/:path*',
    '/settings/:path*',
    '/resumes/:path*',
  ],
};
