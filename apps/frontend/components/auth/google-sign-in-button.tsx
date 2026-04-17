'use client';

import Image from 'next/image';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

export function GoogleSignInButton() {
  return (
    <button
      type="submit"
      onClick={() => captureEvent(POSTHOG_EVENTS.AUTH_SIGN_IN_GOOGLE_CLICKED)}
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
