import { NextResponse } from 'next/server';
import { resolveAnalyticsEnvironment } from '@/lib/analytics/posthog';

export async function GET(request: Request) {
  const url = new URL(request.url);

  return NextResponse.json({
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || '',
    posthogHost: (
      process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
    ).replace(/\/$/, ''),
    env: resolveAnalyticsEnvironment(url.hostname, process.env.NEXT_PUBLIC_POSTHOG_ENV),
    release: process.env.NEXT_PUBLIC_RELEASE_VERSION?.trim() || null,
  });
}
