'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

type AuthCtaProps = {
  className?: string;
  signedOutLabel?: string;
  signedInLabel?: string;
  callbackUrl?: string;
  eventTarget?: string;
};

/**
 * Auth-aware call-to-action for public pages. A signed-out visitor is sent to
 * the Google sign-in flow (returning to `callbackUrl` afterwards); a signed-in
 * visitor goes straight into the app.
 */
export function AuthCta({
  className = '',
  signedOutLabel = 'Sign in',
  signedInLabel = 'Open app',
  callbackUrl = '/dashboard',
  eventTarget = 'public_header',
}: AuthCtaProps): React.ReactElement {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const href = isAuthed ? callbackUrl : `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <Link
      href={href}
      onClick={() =>
        captureEvent(POSTHOG_EVENTS.PUBLIC_SIGN_IN_CLICKED, {
          target: eventTarget,
          authed: isAuthed,
        })
      }
      className={className}
    >
      {isAuthed ? signedInLabel : signedOutLabel}
    </Link>
  );
}
