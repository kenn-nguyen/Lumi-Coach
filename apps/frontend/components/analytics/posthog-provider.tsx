'use client';

import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { captureEvent } from '@/lib/analytics/posthog';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? '';
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com').replace(/\/$/, '');

function buildCurrentPath(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loaded, setLoaded] = useState(false);
  const currentSearch = searchParams.toString();
  const currentPath = useMemo(
    () => buildCurrentPath(pathname, currentSearch),
    [currentSearch, pathname]
  );

  useEffect(() => {
    if (!loaded || !POSTHOG_KEY) return;
    captureEvent('$pageview', { $current_url: currentPath });
  }, [currentPath, loaded]);

  useEffect(() => {
    if (!loaded || !POSTHOG_KEY) return;

    if (status === 'authenticated' && session?.user?.id) {
      window.posthog?.identify?.(session.user.id, {
        email: session.user.email ?? null,
        name: session.user.name ?? null,
      });
      return;
    }

    if (status === 'unauthenticated') {
      window.posthog?.reset?.();
    }
  }, [loaded, session?.user?.email, session?.user?.id, session?.user?.name, status]);

  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        id="posthog-js"
        src={`${POSTHOG_HOST}/static/array.js`}
        strategy="afterInteractive"
        onLoad={() => {
          window.posthog?.init?.(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            autocapture: true,
            capture_pageview: false,
            person_profiles: 'identified_only',
          });
          setLoaded(true);
        }}
      />
      {children}
    </>
  );
}
