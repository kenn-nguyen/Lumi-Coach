'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';
import { warmupBackend } from '@/lib/api/warmup';

export function GoogleSignInButton() {
  // Wake the Render backend as soon as the sign-in page opens, so it's warming
  // during the read + Google OAuth round-trip regardless of how the user got here.
  useEffect(() => {
    warmupBackend();
  }, []);

  return (
    <button
      type="submit"
      onClick={() => {
        // Deliberate action — always fire a fresh ping, bypassing the throttle.
        warmupBackend(true);
        captureEvent(POSTHOG_EVENTS.AUTH_SIGN_IN_GOOGLE_CLICKED);
      }}
      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-border bg-white px-5 py-3 text-[15px] font-medium text-[#3C4043] shadow-sm transition-colors hover:bg-[#F8F9FA]"
    >
      <Image
        src="/google-g-logo.svg"
        alt="Google"
        width={18}
        height={18}
        className="h-[18px] w-[18px]"
      />
      <span>Sign in with Google</span>
    </button>
  );
}
