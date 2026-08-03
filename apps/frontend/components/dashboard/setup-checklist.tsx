'use client';

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Loader2, AlertTriangle, AlertCircle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SystemStatus } from '@/lib/api/config';
import { useStatusCache } from '@/lib/context/status-cache';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';

type ProcessingStatus = 'loading' | 'pending' | 'processing' | 'ready' | 'failed' | null;

interface SetupChecklistProps {
  systemStatus: SystemStatus | null;
  masterResumeId: string | null;
  processingStatus: ProcessingStatus;
  onUploadResume: () => void;
  dismissed: boolean;
  onDismissedChange: (dismissed: boolean) => void;
}

export function SetupChecklist({
  systemStatus,
  masterResumeId,
  processingStatus,
  onUploadResume,
  dismissed,
  onDismissedChange,
}: SetupChecklistProps) {
  // Gate on fresh API data, not stale localStorage cache.
  // mountTime is set once in useLayoutEffect so it can be read safely during render.
  const [mountTime, setMountTime] = useState<number | null>(null);
  useLayoutEffect(() => {
    setMountTime(Date.now());
  }, []);
  const { lastFetched } = useStatusCache();
  const hasFreshApiData =
    mountTime !== null && lastFetched !== null && lastFetched.getTime() > mountTime;

  const hasUserApiKey = Boolean(systemStatus?.has_user_api_key);
  const isFreeLlmAvailable = Boolean(
    systemStatus?.free_llm_available || systemStatus?.using_free_llm
  );
  const isLlmUsable = hasUserApiKey || isFreeLlmAvailable;

  const isMasterReady = Boolean(masterResumeId) && processingStatus === 'ready';
  const isMasterProcessing =
    Boolean(masterResumeId) &&
    (processingStatus === 'pending' || processingStatus === 'processing');
  const isMasterFailed = processingStatus === 'failed';

  const isSetupDone = isLlmUsable && isMasterReady;

  const step1Done = isLlmUsable;
  const step1FreeTierWarning = isFreeLlmAvailable && !hasUserApiKey;
  const step2Done = isMasterReady;

  const stepsComplete = [step1Done, step2Done].filter(Boolean).length;

  // Dismissal is owned by the parent so the "Add Master Resume" button can
  // re-open this modal after the user closes it (e.g. signed in with the wrong
  // Google account). Setup isn't complete, so the modal also returns on the
  // next load — dismissing only unblocks the current view, it doesn't skip setup.
  const shouldShowModal = hasFreshApiData && systemStatus !== null && !isSetupDone && !dismissed;

  // Lock scroll while setup modal is open
  useEffect(() => {
    if (shouldShowModal) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldShowModal]);

  // Escape dismisses this modal (and is stopped from closing anything else).
  useEffect(() => {
    if (!shouldShowModal) return;
    const block = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onDismissedChange(true);
      }
    };
    document.addEventListener('keydown', block, true);
    return () => document.removeEventListener('keydown', block, true);
  }, [shouldShowModal, onDismissedChange]);

  if (!shouldShowModal || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop — not clickable (intentional: user must complete setup) */}
      <div className="fixed inset-0 bg-[rgba(18,24,38,0.32)] backdrop-blur-[2px]" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg animate-in fade-in-0 zoom-in-95 duration-200 overflow-hidden rounded-3xl border border-border bg-card shadow-sw-card">
          {/* Header */}
          <div className="border-b border-border px-6 pt-6 pb-4 pr-14">
            <h2 className="font-serif text-2xl font-semibold leading-none tracking-[-0.04em]">
              Welcome — let&apos;s get you set up
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Two quick steps and you&apos;re ready to tailor.
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Wrong account? Close this to switch or log out.
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onDismissedChange(true)}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground transition hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Steps */}
          <div className="divide-y divide-border">
            {/* Step 1 */}
            <div className="flex items-start gap-4 px-6 py-5">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold transition-colors ${
                  step1Done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary text-foreground'
                }`}
              >
                {step1Done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : '1'}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {step1Done ? 'AI connected' : 'Connect your AI'}
                    </p>
                  </div>
                  {!step1Done && (
                    <Link href="/settings" className="shrink-0">
                      <Button size="sm" variant="outline">
                        Add API key
                      </Button>
                    </Link>
                  )}
                </div>
                {step1FreeTierWarning && (
                  <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>
                      Free Gemini tier — can be slow at peak times.{' '}
                      <Link href="/settings" className="font-semibold underline underline-offset-2">
                        Add your own key
                      </Link>{' '}
                      for reliable runs.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 px-6 py-5">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold transition-colors ${
                  step2Done
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary text-foreground'
                }`}
              >
                {step2Done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : '2'}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {step2Done ? 'Master resume ready' : 'Upload your master resume'}
                    </p>
                    {!step2Done && !isMasterProcessing && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        PDF, DOCX, MD, or TXT — AI structures it automatically
                      </p>
                    )}
                  </div>
                  {!step2Done && !isMasterProcessing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={onUploadResume}
                    >
                      {isMasterFailed ? 'Try again' : 'Upload file'}
                    </Button>
                  )}
                </div>
                {isMasterProcessing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="font-mono uppercase tracking-wide">
                      Processing — usually 1–2 min
                    </span>
                  </div>
                )}
                {isMasterFailed && (
                  <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Processing failed — upload a new file.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer progress */}
          <div className="flex items-center justify-between border-t border-border bg-secondary/60 px-6 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {stepsComplete} of 2 complete
            </p>
            <div className="flex gap-1.5">
              {[step1Done, step2Done].map((done, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-8 rounded-full transition-colors ${done ? 'bg-primary' : 'bg-border'}`}
                />
              ))}
            </div>
          </div>

          {/* Recommended path — the extension (also the cost-saving answer) */}
          <div className="flex items-center justify-between gap-4 border-t border-border bg-secondary/30 px-6 py-4">
            <p className="text-xs leading-5 text-muted-foreground">
              💡 <span className="font-semibold text-foreground">Best experience:</span> the{' '}
              <a
                href={CHROME_EXTENSION_URL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-2 hover:text-foreground"
              >
                extension
              </a>{' '}
              tailors any LinkedIn job through your ChatGPT login — no API key, no cost.
            </p>
            <a href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer" className="shrink-0">
              <Button size="sm" variant="outline">
                Get extension
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
