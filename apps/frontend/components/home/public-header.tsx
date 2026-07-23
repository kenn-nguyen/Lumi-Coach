import Image from 'next/image';
import Link from 'next/link';
import { AuthCta } from './auth-cta';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

type PublicHeaderProps = {
  activeTab?: 'story-bank' | null;
};

const baseLinkClassName =
  'inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold transition';
const CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';

export function PublicHeader({ activeTab = null }: PublicHeaderProps): React.ReactElement {
  return (
    <header className="flex items-center justify-between gap-4 rounded-full border border-[#ecd3da]/90 bg-[rgba(255,248,249,0.76)] px-5 py-3 shadow-[0_24px_44px_rgba(86,15,40,0.08)] backdrop-blur-[18px]">
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 md:flex-initial md:justify-start md:gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Image
            src="/logo.png"
            alt="Lumi Coach"
            width={40}
            height={40}
            className="size-8 sm:size-10"
          />
          <span className="truncate text-lg font-semibold tracking-[-0.05em] text-[#32111d] sm:text-2xl">
            Lumi Coach
          </span>
        </Link>

        <nav
          aria-label="Public pages"
          className="flex shrink-0 items-center gap-2 border-l border-[#ead3d9]/90 pl-3 sm:pl-4"
        >
          <Link
            href="/story-bank"
            className={
              activeTab === 'story-bank'
                ? `${baseLinkClassName} px-0 text-[#8e2247] md:border md:border-[#e6cad2]/95 md:bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] md:px-4 md:text-[#fff7f9] md:shadow-[0_12px_26px_rgba(86,15,40,0.14)]`
                : `${baseLinkClassName} px-0 text-[#6f102d] hover:text-[#32111d] md:px-4 md:hover:bg-white/80`
            }
          >
            Story bank
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <a
          href={CHROME_WEB_STORE_URL}
          onClick={() =>
            captureEvent(POSTHOG_EVENTS.HERO_CTA_CLICKED, {
              target:
                activeTab === 'story-bank'
                  ? 'chrome_web_store_header_story_bank'
                  : 'chrome_web_store_header',
            })
          }
          className="hidden min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] px-5 text-sm font-semibold text-[#fff7f9] shadow-[0_12px_26px_rgba(86,15,40,0.14)] transition hover:translate-y-[1px] hover:opacity-95 md:inline-flex"
        >
          Install now
        </a>
        <AuthCta
          signedInLabel="Sign in"
          eventTarget={activeTab === 'story-bank' ? 'public_header_story_bank' : 'public_header'}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e6cad2]/95 bg-white/70 px-5 text-sm font-semibold text-[#6f102d] transition hover:bg-white"
        />
      </div>
    </header>
  );
}
