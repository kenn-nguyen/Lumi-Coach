'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PublicHeader } from './public-header';
import { AuthCta } from './auth-cta';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

const CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';

const heroSignals = [
  'For MBA recruiting',
  'Built for live LinkedIn roles',
  'Move fast without sounding rushed',
];

const manualSteps = [
  'Pull keywords by hand',
  'Rewrite bullets from scratch',
  'Jump between tabs and notes',
];

const lumiSteps = ['Start from the live role', 'Tailor in context', 'Review and send'];

const workflowSteps = [
  {
    step: '01',
    title: 'See the role',
    body: 'Start where the opportunity already lives.',
  },
  {
    step: '02',
    title: 'Tailor fast',
    body: 'Shape the draft with the real context in front of you.',
  },
  {
    step: '03',
    title: 'Review and send',
    body: 'Make the final call, then apply with confidence.',
  },
];

function ExtensionMock(): React.ReactElement {
  return (
    <div className="relative rounded-[38px] border border-[#f5d9df]/80 bg-[linear-gradient(180deg,rgba(120,18,47,0.94)_0%,rgba(80,11,31,0.98)_100%)] p-3 shadow-[0_36px_80px_rgba(61,12,31,0.28)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-30 rounded-full bg-[radial-gradient(circle,rgba(248,212,221,0.34)_0%,rgba(248,212,221,0)_72%)] blur-2xl"
      />
      <div className="overflow-hidden rounded-[30px] border border-[#f6e4e7]/70 bg-[linear-gradient(180deg,rgba(249,238,240,0.98)_0%,rgba(239,221,225,0.96)_100%)] shadow-[inset_0_1px_0_rgba(255,247,249,0.76)]">
        <div className="flex items-center justify-between border-b border-[#d4b3bc]/55 bg-[rgba(255,245,247,0.62)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Lumi Coach" width={34} height={34} className="size-8" />
            <span className="text-[1.1rem] font-semibold tracking-[-0.05em] text-[#37121e]">
              Lumi Coach
            </span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex size-10 items-center justify-center rounded-full border border-[#ebd3d9]/95 bg-white/80 text-[#6f102d] shadow-[0_10px_18px_rgba(86,15,40,0.08)]"
              >
                <div className="size-3.5 rounded-full border border-current/40" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5 px-5 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8a3952]">
                Active LinkedIn role
              </p>
              <h3 className="mt-3 max-w-[10ch] text-[2.55rem] font-semibold leading-[0.92] tracking-[-0.08em] text-[#37121e] sm:text-[2.7rem]">
                Forward Deployed Product Manager
              </h3>
              <p className="mt-4 text-[1.05rem] font-semibold tracking-[-0.03em] text-[#4d1b2b]">
                Glean
              </p>
              <p className="mt-3 max-w-[28ch] text-[0.95rem] leading-7 text-[#6a3b4b]">
                Reposted 2 days ago • Over 100 people clicked apply
              </p>
            </div>

            <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-[#7f1d3f] text-[1.75rem] font-bold text-[#fff6f8] shadow-[0_14px_28px_rgba(127,29,63,0.34)]">
              ✓
            </div>
          </div>

          <div className="rounded-[24px] border border-[#edd8de]/90 bg-white/82 p-5 shadow-[inset_0_1px_0_rgba(255,246,248,0.72)]">
            <span className="block max-w-[24ch] text-[0.9rem] leading-7 tracking-normal text-[#724657]">
              Add any extra context before the run and keep the application story tight.
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[0.9fr_1.45fr]">
            <div className="flex min-h-20 items-center justify-center rounded-[28px] border border-[#edd8de]/90 bg-white/84 text-[1.2rem] font-semibold tracking-[-0.04em] text-[#4d1b2b] shadow-[0_14px_28px_rgba(86,15,40,0.06)]">
              Minimize
            </div>
            <a
              href={CHROME_WEB_STORE_URL}
              onClick={() =>
                captureEvent(POSTHOG_EVENTS.HERO_CTA_CLICKED, {
                  target: 'extension_mock_tailor_now',
                })
              }
              className="flex min-h-20 items-center justify-center rounded-[28px] bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] text-[1.3rem] font-semibold tracking-[-0.04em] text-[#fff7f9] shadow-[0_20px_34px_rgba(105,23,51,0.32)] transition hover:translate-y-[1px] hover:opacity-95"
            >
              Tailor now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalPill({ label }: { label: string }): React.ReactElement {
  return (
    <div className="rounded-full border border-[#ecd3da]/90 bg-[rgba(255,247,249,0.86)] px-4 py-2 text-sm font-medium text-[#4d1b2b] shadow-[0_14px_24px_rgba(86,15,40,0.06)]">
      {label}
    </div>
  );
}

function ComparisonCard({
  label,
  title,
  steps,
  accent = 'light',
}: {
  label: string;
  title: string;
  steps: string[];
  accent?: 'light' | 'dark';
}): React.ReactElement {
  const isDark = accent === 'dark';

  return (
    <article
      className={
        isDark
          ? 'rounded-[30px] border border-[#b55f79]/55 bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] p-6 text-[#fff7f9] shadow-[0_24px_48px_rgba(86,15,40,0.2)]'
          : 'rounded-[30px] border border-[#ecd3da]/90 bg-[linear-gradient(180deg,rgba(255,249,250,0.95)_0%,rgba(247,235,238,0.9)_100%)] p-6 text-[#32111d] shadow-[0_20px_38px_rgba(86,15,40,0.08)]'
      }
    >
      <p
        className={
          isDark
            ? 'text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[#f7c7d4]'
            : 'text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[#9c4760]'
        }
      >
        {label}
      </p>
      <h3 className="mt-4 text-[1.65rem] font-semibold leading-[0.96] tracking-[-0.06em]">
        {title}
      </h3>

      <ul className="mt-5 space-y-3">
        {steps.map((step) => (
          <li key={step} className="flex items-start gap-3">
            <span
              className={
                isDark
                  ? 'mt-2 size-1.5 shrink-0 rounded-full bg-[#fff1f4]'
                  : 'mt-2 size-1.5 shrink-0 rounded-full bg-[#8e2247]'
              }
            />
            <span
              className={
                isDark
                  ? 'text-sm leading-7 text-[#fff1f4] sm:text-base'
                  : 'text-sm leading-7 text-[#694152] sm:text-base'
              }
            >
              {step}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function WorkflowCard({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}): React.ReactElement {
  return (
    <article className="rounded-[24px] border border-[#e8cfd7]/90 bg-[rgba(255,249,250,0.86)] p-5 shadow-[0_16px_30px_rgba(86,15,40,0.06)]">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[#9c4760]">
        {step}
      </p>
      <h3 className="mt-3 text-[1.3rem] font-semibold leading-[1.02] tracking-[-0.05em] text-[#32111d]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-[#694152]">{body}</p>
    </article>
  );
}

export default function Homepage(): React.ReactElement {
  useEffect(() => {
    captureEvent(POSTHOG_EVENTS.LANDING_VIEWED);
  }, []);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6eee9_0%,#f1e5e2_44%,#f7f0eb_100%)] text-[#32111d]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(111,16,45,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(111,16,45,0.05)_1px,transparent_1px)] bg-[size:52px_52px] opacity-70"
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-5 pb-20 pt-6 sm:px-8 lg:px-10">
        <PublicHeader />

        <section className="grid gap-12 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="flex flex-col gap-8">
            <div>
              <p className="inline-flex rounded-full border border-[#ebd2d9]/95 bg-[rgba(255,248,249,0.82)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8e2247] shadow-[0_12px_24px_rgba(86,15,40,0.06)]">
                For MBA candidates and recent grads
              </p>
              <h1 className="mt-6 max-w-[10ch] text-5xl font-semibold leading-[0.88] tracking-[-0.09em] text-[#32111d] sm:text-6xl lg:text-7xl">
                Tailor your resume before the moment passes.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f3544] sm:text-[1.12rem]">
                A strong role shows up. Manual tailoring gets messy fast. Lumi Coach keeps the
                workflow tight.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {heroSignals.map((signal) => (
                <SignalPill key={signal} label={signal} />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <AuthCta
                signedOutLabel="Tailor on the web"
                signedInLabel="Go to dashboard"
                eventTarget="hero"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] px-7 text-base font-semibold text-[#fff7f9] shadow-[0_24px_46px_rgba(105,23,51,0.3)] transition hover:translate-y-[1px] hover:opacity-95"
              />
              <a
                href={CHROME_WEB_STORE_URL}
                onClick={() =>
                  captureEvent(POSTHOG_EVENTS.HERO_CTA_CLICKED, {
                    target: 'chrome_web_store',
                  })
                }
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] px-7 text-base font-semibold text-[#fff7f9] shadow-[0_24px_46px_rgba(105,23,51,0.3)] transition hover:translate-y-[1px] hover:opacity-95"
              >
                Install the extension
              </a>
            </div>
            <p className="max-w-[46ch] text-sm leading-6 text-[#6f4756]">
              Tailor right here on the web, or install the extension to start from a live LinkedIn
              job.
            </p>
          </div>

          <ExtensionMock />
        </section>

        <section className="border-t border-[#e4cbd2]/70 py-12">
          <div className="mb-7 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e2247]">
              Old way vs new way
            </p>
            <h2 className="mt-4 max-w-[11ch] text-4xl font-semibold leading-[0.93] tracking-[-0.08em] text-[#32111d] sm:text-5xl">
              Manual tailoring is slow when timing matters.
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ComparisonCard
              label="Manual"
              title="You do the context switching."
              steps={manualSteps}
            />
            <ComparisonCard
              label="With Lumi Coach"
              title="You stay with the opportunity."
              steps={lumiSteps}
              accent="dark"
            />
          </div>
        </section>

        <section className="rounded-[32px] border border-[#e4c8d0]/90 bg-[linear-gradient(180deg,rgba(255,248,249,0.9)_0%,rgba(245,232,235,0.84)_100%)] px-6 py-7 shadow-[0_24px_48px_rgba(86,15,40,0.08)] sm:px-8 sm:py-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e2247]">
              The flow
            </p>
            <h2 className="mt-4 max-w-[12ch] text-4xl font-semibold leading-[0.92] tracking-[-0.08em] text-[#32111d] sm:text-5xl">
              Three steps. No extra ceremony.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-[#5f3544]">
              See the role. Tailor fast. Review before you send.
            </p>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {workflowSteps.map((step) => (
              <WorkflowCard key={step.step} step={step.step} title={step.title} body={step.body} />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[38px] border border-[#e4c8d0]/90 bg-[linear-gradient(180deg,rgba(112,16,45,0.96)_0%,rgba(50,17,29,0.98)_100%)] px-6 py-8 text-[#fff6f7] shadow-[0_34px_64px_rgba(61,12,31,0.24)] sm:px-8 sm:py-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f0c7d2]">
                Final push
              </p>
              <h2 className="mt-4 max-w-[12ch] text-4xl font-semibold leading-[0.92] tracking-[-0.08em] text-[#fff8f9] sm:text-5xl">
                Be ready for the next role before it goes cold.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-[#f2dfe4]">
                Add Lumi Coach before the next strong opening turns into another rushed night.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <a
                href={CHROME_WEB_STORE_URL}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[#fff7f9] px-7 text-base font-semibold text-[#5d1530] shadow-[0_24px_44px_rgba(28,7,14,0.24)] transition hover:translate-y-[1px] hover:opacity-95"
              >
                Install now
              </a>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-[#f3dfe4] transition hover:text-white"
              >
                Already installed? Open your workspace
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 border-t border-[#e4cbd2]/75 py-8 text-sm text-[#6a4251] sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl">
            Lumi Coach is built for high-stakes applications that need to move quickly without
            sounding rushed.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="text-sm text-[#6a4251]">
              Send me a message:{' '}
              <a
                href="https://www.linkedin.com/in/kenn-nguyen/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#5d1530] transition hover:text-[#32111d]"
              >
                LinkedIn
              </a>
            </p>
            <p className="text-sm text-[#6a4251]">
              Give feedback:{' '}
              <a
                href="https://lumicoach.userjot.com/?cursor=1&order=top&limit=10"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#5d1530] transition hover:text-[#32111d]"
              >
                UserJot
              </a>
            </p>
            <p className="text-sm text-[#6a4251]">
              Join our community:{' '}
              <a
                href="https://chat.whatsapp.com/Ep41UDOTd3A4Lu78mxcEkQ?mode=gi_t"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#5d1530] transition hover:text-[#32111d]"
              >
                WhatsApp
              </a>
            </p>
            <Link
              href="/privacy"
              className="font-medium text-[#5d1530] transition hover:text-[#32111d]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/sign-in"
              className="font-medium text-[#5d1530] transition hover:text-[#32111d]"
            >
              Sign in
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
