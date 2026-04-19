'use client';

import { useEffect, useRef, useState } from 'react';
import { PublicHeader } from './public-header';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

const scopeSignals = [
  {
    title: 'High stakes',
    body: 'Pick stories with revenue, scale, deadlines, or visible business risk.',
  },
  {
    title: 'High friction',
    body: 'Choose moments with broken processes, tough stakeholders, or messy ambiguity.',
  },
  {
    title: 'High initiative',
    body: 'Favor examples where you stepped in before someone had to ask.',
  },
];

const outputAssets = [
  'A 30-second recruiter pitch',
  'A one-minute STAR answer',
  'A two-minute deep dive for interviews',
];

const aiPrompt = `# Career Storybank Extraction

I am building a career Storybank. I am going to tell you a messy, rambling story about a past project. Listen, extract the most important details, and output the following:

## 1. The 30-Second Pitch
A short, punchy summary of the problem and the result.

## 2. The 1-Minute STAR
A standard Situation, Task, Action, Result breakdown.

## 3. The 2-Minute Deep Dive
A comprehensive version that includes:
- the nuances of the conflict
- the specific cross-functional teams I aligned
- the technical hurdles I overcame`;

function StepCard({
  step,
  title,
  children,
  accent = 'light',
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  accent?: 'light' | 'dark';
}): React.ReactElement {
  const className =
    accent === 'dark'
      ? 'rounded-[30px] border border-[#b55f79]/50 bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] p-7 text-[#fff7f9] shadow-[0_24px_54px_rgba(86,15,40,0.2)]'
      : 'rounded-[30px] border border-[#ecd3da]/90 bg-[linear-gradient(180deg,rgba(255,249,250,0.95)_0%,rgba(247,235,238,0.9)_100%)] p-7 text-[#32111d] shadow-[0_22px_42px_rgba(86,15,40,0.08)]';

  const kickerClassName =
    accent === 'dark'
      ? 'text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[#f7c7d4]'
      : 'text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[#9c4760]';

  return (
    <article className={className}>
      <p className={kickerClassName}>Step {step}</p>
      <h2 className="mt-4 text-[1.9rem] font-semibold leading-[0.98] tracking-[-0.06em]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </article>
  );
}

export default function StoryBankPage(): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    captureEvent(POSTHOG_EVENTS.STORY_BANK_VIEWED, {
      entrypoint: 'page',
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopyPrompt(): Promise<void> {
    await navigator.clipboard.writeText(aiPrompt);
    captureEvent(POSTHOG_EVENTS.STORY_BANK_PROMPT_COPIED);
    setCopied(true);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 2200);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6eee9_0%,#f1e5e2_44%,#f7f0eb_100%)] text-[#32111d]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(111,16,45,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(111,16,45,0.05)_1px,transparent_1px)] bg-[size:52px_52px] opacity-70"
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col px-5 pb-20 pt-6 sm:px-8 lg:px-10">
        <PublicHeader activeTab="story-bank" />

        <section className="grid gap-10 py-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <p className="inline-flex rounded-full border border-[#ebd2d9]/95 bg-[rgba(255,248,249,0.82)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8e2247] shadow-[0_12px_24px_rgba(86,15,40,0.06)]">
              Better source material
            </p>
            <h1 className="mt-6 max-w-[10ch] text-5xl font-semibold leading-[0.88] tracking-[-0.09em] text-[#32111d] sm:text-6xl lg:text-7xl">
              Build a story bank your AI can actually use.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#5f3544]">
              Capture the strongest stories first. Tailor faster after.
            </p>
          </div>

          <div className="rounded-[34px] border border-[#e5cad2]/90 bg-[linear-gradient(180deg,rgba(255,248,249,0.88)_0%,rgba(245,232,235,0.82)_100%)] px-6 py-6 shadow-[0_24px_54px_rgba(86,15,40,0.08)] sm:px-8 sm:py-7">
            <div className="grid gap-3">
              <div className="rounded-[22px] border border-[#ead4da]/90 bg-white/72 px-5 py-3.5 text-sm leading-6 text-[#603847] shadow-[0_12px_26px_rgba(86,15,40,0.05)]">
                Focus on your last one or two roles, or roughly the last five years.
              </div>
              <div className="rounded-[22px] border border-[#ead4da]/90 bg-white/72 px-5 py-3.5 text-sm leading-6 text-[#603847] shadow-[0_12px_26px_rgba(86,15,40,0.05)]">
                Capture five to ten stories that show pressure, initiative, and measurable impact.
              </div>
              <div className="rounded-[22px] border border-[#ead4da]/90 bg-white/72 px-5 py-3.5 text-sm leading-6 text-[#603847] shadow-[0_12px_26px_rgba(86,15,40,0.05)]">
                Let AI turn each messy story into reusable bullets, pitches, and interview answers.
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <StepCard step="01" title="Scope the right stories.">
            <div className="grid gap-3">
              {scopeSignals.map((signal) => (
                <div
                  key={signal.title}
                  className="rounded-[22px] border border-[#ead4da]/90 bg-white/80 px-5 py-4 shadow-[0_12px_26px_rgba(86,15,40,0.05)]"
                >
                  <h3 className="text-base font-semibold tracking-[-0.04em] text-[#32111d]">
                    {signal.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#694152]">{signal.body}</p>
                </div>
              ))}
            </div>
          </StepCard>

          <StepCard step="02" title="Talk through the story.">
            <div className="rounded-[24px] border border-[#ead4da]/90 bg-white/78 p-5 shadow-[0_14px_28px_rgba(86,15,40,0.05)]">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#8e2247]">
                What to include
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[#694152]">
                <li className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#8e2247]" />
                  <span>What was going wrong before you stepped in?</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#8e2247]" />
                  <span>What you were specifically responsible for?</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#8e2247]" />
                  <span>What actions you personally took?</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#8e2247]" />
                  <span>What numbers, outcome, or decision changed?</span>
                </li>
              </ul>
            </div>

            <div className="mt-5 rounded-[24px] border border-[#ead4da]/90 bg-[rgba(255,247,249,0.82)] p-5 shadow-[0_14px_28px_rgba(86,15,40,0.05)]">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#8e2247_0%,#691733_100%)] px-5 text-sm font-semibold text-[#fff7f9] shadow-[0_18px_34px_rgba(105,23,51,0.24)] transition hover:translate-y-[1px] hover:opacity-95"
                >
                  {copied ? 'Prompt copied' : 'Copy sample prompt'}
                </button>
              </div>
            </div>
          </StepCard>

          <StepCard step="03" title="Get reusable outputs." accent="dark">
            <div className="grid gap-2.5">
              {outputAssets.map((asset) => (
                <div
                  key={asset}
                  className="rounded-[20px] border border-white/12 bg-white/10 px-5 py-3.5 shadow-[0_12px_28px_rgba(33,5,15,0.08)]"
                >
                  <p className="text-sm font-medium leading-6 text-[#fff7f9]">{asset}</p>
                </div>
              ))}
            </div>
          </StepCard>
        </section>
      </div>
    </main>
  );
}
