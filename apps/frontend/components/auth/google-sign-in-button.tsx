'use client';

import Image from 'next/image';
import { captureEvent } from '@/lib/analytics/posthog';

export function GoogleSignInButton() {
  return (
    <button
      type="submit"
      onClick={() => captureEvent('sign_in_with_google_clicked')}
      className="inline-flex w-full items-center justify-center gap-3 border border-[#DADCE0] bg-white px-5 py-3 text-[15px] font-medium text-[#3C4043] shadow-[4px_4px_0px_0px_#000000] transition hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[#F8F9FA] hover:shadow-[3px_3px_0px_0px_#000000]"
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
