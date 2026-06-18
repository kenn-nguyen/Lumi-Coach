'use client';

import React from 'react';
import Link from 'next/link';
import { Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SystemStatus } from '@/lib/api/config';

type ProcessingStatus = 'loading' | 'pending' | 'processing' | 'ready' | 'failed' | null;

interface SetupChecklistProps {
  systemStatus: SystemStatus | null;
  masterResumeId: string | null;
  processingStatus: ProcessingStatus;
  onUploadResume: () => void;
}

export function SetupChecklist({
  systemStatus,
  masterResumeId,
  processingStatus,
  onUploadResume,
}: SetupChecklistProps) {
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

  // Once fully set up (AI + master ready), the existing LLM notice banner takes over if needed
  if (isLlmUsable && isMasterReady) return null;

  const step1Done = isLlmUsable;
  const step1FreeTierWarning = isFreeLlmAvailable && !hasUserApiKey;

  const step2Done = isMasterReady;

  return (
    <section className="border border-border bg-card">
      <div className="border-b border-border px-6 py-3">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground">
          Get started
        </p>
      </div>
      <div className="divide-y divide-border">
        {/* Step 1 — Connect AI */}
        <div className="flex items-start gap-4 px-6 py-4">
          <span className="mt-0.5 font-mono text-sm font-bold text-foreground">
            {step1Done ? '✓' : '○'}
          </span>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                Step 1 — Connect AI
              </p>
              {!step1Done && (
                <Link href="/settings">
                  <Button size="sm" variant="outline" className="shrink-0">
                    Add API key
                  </Button>
                </Link>
              )}
            </div>
            {step1FreeTierWarning && (
              <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  Free Gemini tier active — may be unstable during peak hours.{' '}
                  <Link href="/settings" className="font-semibold underline underline-offset-2">
                    Add your own API key
                  </Link>{' '}
                  for reliable results.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2 — Add master resume */}
        <div className="flex items-start gap-4 px-6 py-4">
          <span className="mt-0.5 font-mono text-sm font-bold text-foreground">
            {step2Done ? '✓' : '○'}
          </span>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                Step 2 — Add your master resume
              </p>
              {!step2Done && !isMasterProcessing && (
                <Button size="sm" variant="outline" className="shrink-0" onClick={onUploadResume}>
                  {isMasterFailed ? 'Try again' : 'Upload file'}
                </Button>
              )}
            </div>
            {isMasterProcessing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="font-mono uppercase tracking-wide">
                  Processing… usually 1–2 min
                </span>
              </div>
            )}
            {isMasterFailed && (
              <div className="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Processing failed. Upload a new file to try again.</span>
              </div>
            )}
            {!masterResumeId && !isMasterProcessing && !isMasterFailed && (
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                PDF, MD, or TXT — AI will structure it automatically
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
