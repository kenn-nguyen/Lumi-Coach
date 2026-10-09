import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// With the tracker's dev bypass on, /tracker is reachable without a session so the
// app can be run and tested headless.
//
// The three conditions below mirror dev_bypass_enabled() in app/tracker/auth.py
// deliberately. The backend is the real gate and refuses the bypass anywhere that
// looks deployed; checking only the flag here would mean a stray environment
// variable in production left this page open while the backend still refused the
// data — a shell with no content, and a confusing one to diagnose.
const DEPLOY_MARKERS = ['RENDER', 'RENDER_SERVICE_ID', 'KUBERNETES_SERVICE_HOST', 'DYNO'];
const DEV_ENVIRONMENTS = ['development', 'dev', 'local', 'test'];

function trackerDevBypassEnabled(): boolean {
  const flag = (process.env.TRACKER_DEV_NO_AUTH ?? '').trim();
  if (!['1', 'true', 'TRUE', 'yes'].includes(flag)) return false;
  if (DEPLOY_MARKERS.some((marker) => (process.env[marker] ?? '').trim())) return false;
  const environment = (process.env.ENVIRONMENT ?? 'development').trim().toLowerCase();
  return DEV_ENVIRONMENTS.includes(environment);
}

const TRACKER_DEV_OPEN = trackerDevBypassEnabled();

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
