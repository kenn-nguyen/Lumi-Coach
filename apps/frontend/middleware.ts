import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// With the tracker's dev bypass on, /tracker is reachable without a session so the
// app can be run and tested headless. The backend applies the same rule, and
// refuses the bypass in anything that looks deployed.
const TRACKER_DEV_OPEN = process.env.TRACKER_DEV_NO_AUTH === '1';

const PROTECTED_PATH_PREFIXES = [
  '/dashboard',
  '/builder',
  '/tailor',
  '/settings',
  '/resumes',
  '/runs',
  '/evals',
  '/admin',
  ...(TRACKER_DEV_OPEN ? [] : ['/tracker']),
];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  const isProtectedPath = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
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
    '/runs/:path*',
    '/runs',
    '/evals/:path*',
    '/evals',
    '/admin/:path*',
    '/tracker/:path*',
    '/tracker',
  ],
};
