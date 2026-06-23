'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, Loader2, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  cancelTailor,
  getTailorStatus,
  progressStageLabel,
  startTailor,
  type PromptProfileId,
  type TailorStatusResponse,
} from '@/lib/api/tailor';
import { fetchStageReadiness, type StageReadinessItem } from '@/lib/api/config';
import { useStatusCache } from '@/lib/context/status-cache';
import { useBackgroundTailor } from '@/lib/context/background-tailor';

// Poll every 3 seconds while running
const POLL_INTERVAL_MS = 3000;

interface TailorDialogProps {
  resumeId: string;
  isOpen: boolean;
  onClose: () => void;
}

type Phase = 'input' | 'running' | 'done' | 'error';

export function TailorDialog({ resumeId, isOpen, onClose }: TailorDialogProps) {
  const router = useRouter();
  const { status: systemStatus } = useStatusCache();
  const { setJob } = useBackgroundTailor();

  // Input state
  const [jdUrl, setJdUrl] = useState('');
  const [jdText, setJdText] = useState('');
  const [profileId, setProfileId] = useState<PromptProfileId>('profile2');

  // Pipeline state
  const [phase, setPhase] = useState<Phase>('input');
  const [statusData, setStatusData] = useState<TailorStatusResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stage key readiness
  const [missingStages, setMissingStages] = useState<StageReadinessItem[]>([]);
  const [isOverride, setIsOverride] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Reset state when dialog opens/closes; fetch readiness on open
  useEffect(() => {
    if (!isOpen) {
      if (pollRef.current) clearInterval(pollRef.current);
      setPhase('input');
      setStatusData(null);
      setErrorMsg('');
      setIsSubmitting(false);
      setJdUrl('');
      setJdText('');
      setMissingStages([]);
      setIsOverride(false);
    } else {
      fetchStageReadiness()
        .then((r) => {
          setMissingStages(r.stages.filter((s) => !s.configured));
          setIsOverride(r.is_override);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (rid: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getTailorStatus(rid);
          setStatusData(status);

          if (status.status === 'completed') {
            stopPolling();
            setPhase('done');
          } else if (status.status === 'failed') {
            stopPolling();
            setErrorMsg(status.error_message || 'Pipeline failed.');
            setPhase('error');
          } else if (status.status === 'canceled') {
            stopPolling();
            setPhase('input');
          }
        } catch {
          // Transient network error — keep polling
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const handleSubmit = useCallback(async () => {
    const hasUrl = jdUrl.trim().length > 0;
    const hasText = jdText.trim().length > 0;

    if (!hasUrl && !hasText) {
      setErrorMsg('Please provide a LinkedIn URL or paste the job description text.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await startTailor(resumeId, {
        prompt_profile_id: profileId,
        jd_url: hasUrl ? jdUrl.trim() : null,
        jd_text: hasText ? jdText.trim() : null,
      });

      setPhase('running');
      startPolling(resumeId);
    } catch (err: unknown) {
      const base = err instanceof Error ? err.message : 'Failed to start pipeline.';
      const freeTierSuffix =
        systemStatus?.using_free_llm && !systemStatus?.has_user_api_key
          ? ' This may be due to free tier instability — try again or add your own API key in Settings.'
          : '';
      setErrorMsg(base + freeTierSuffix);
    } finally {
      setIsSubmitting(false);
    }
  }, [jdUrl, jdText, profileId, resumeId, startPolling, systemStatus]);

  const handleCancel = useCallback(async () => {
    stopPolling();
    try {
      await cancelTailor(resumeId);
    } catch {
      // best-effort
    }
    setPhase('input');
    setStatusData(null);
  }, [resumeId, stopPolling]);

  const handleViewResult = useCallback(() => {
    if (statusData?.tailored_resume_id) {
      onClose();
      router.push(`/resumes/${statusData.tailored_resume_id}`);
    }
  }, [statusData, onClose, router]);

  const isValidLinkedInUrl = (url: string) =>
    url.trim().length === 0 || url.includes('linkedin.com/jobs');

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (phase === 'running') {
            setJob({ resumeId });
          }
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Tailor Resume to Job</DialogTitle>
          <DialogDescription>
            Paste a LinkedIn job URL or the full job description text, then let the AI write a
            tailored version of your master resume.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* ── Input phase ─────────────────────────────────── */}
          {phase === 'input' && (
            <div className="space-y-4">
              {/* Missing API key warning */}
              {missingStages.length > 0 && !isOverride && (
                <div className="flex items-start gap-2 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    No {missingStages[0]?.provider} API key set — tailoring will fail.{' '}
                    <Link href="/settings" className="font-semibold underline underline-offset-2">
                      Add it in Settings
                    </Link>
                    .
                  </span>
                </div>
              )}
              {missingStages.length > 0 && isOverride && (
                <div className="flex items-start gap-2 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Stage{missingStages.length > 1 ? 's' : ''}{' '}
                    {missingStages.map((s) => `${s.stage} (${s.provider})`).join(', ')}{' '}
                    {missingStages.length > 1 ? 'are' : 'is'} missing an API key — paste it in the
                    YAML&apos;s <code className="font-mono text-xs">apiKey</code> field or{' '}
                    <Link href="/settings" className="font-semibold underline underline-offset-2">
                      add it in Settings
                    </Link>
                    .
                  </span>
                </div>
              )}
              {/* Soft notice when using system shared key */}
              {missingStages.length === 0 &&
                !isOverride &&
                systemStatus?.using_free_llm &&
                !systemStatus?.has_user_api_key && (
                  <div className="flex items-start gap-2 rounded-none border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <span>
                      Running on the system&apos;s shared key — may be slow or unstable.{' '}
                      <Link href="/settings" className="font-semibold underline underline-offset-2">
                        Add your own key in Settings
                      </Link>
                      .
                    </span>
                  </div>
                )}
              {/* LinkedIn URL */}
              <div>
                <label className="mb-1 block text-xs font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  LinkedIn Job URL
                </label>
                <input
                  type="url"
                  value={jdUrl}
                  onChange={(e) => setJdUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/jobs/view/…"
                  className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                />
                {jdUrl && !isValidLinkedInUrl(jdUrl) && (
                  <p className="mt-1 text-xs text-destructive">
                    Please use a linkedin.com/jobs URL.
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-mono text-muted-foreground">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* JD text */}
              <div>
                <label className="mb-1 block text-xs font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Paste Job Description
                </label>
                <textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.stopPropagation();
                  }}
                  placeholder="Paste the full job posting text here…"
                  rows={6}
                  className="w-full resize-y rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                />
              </div>

              {/* Profile selector */}
              <div>
                <label className="mb-1 block text-xs font-mono font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Tailoring style
                </label>
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value as PromptProfileId)}
                  className="w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
                >
                  <option value="profile1">Safe</option>
                  <option value="profile2">Competitive (recommended)</option>
                  <option value="profile5">Competitive+</option>
                  <option value="profile4">Direct</option>
                </select>
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate Tailored Resume
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Running phase ────────────────────────────────── */}
          {phase === 'running' && (
            <div className="space-y-6 py-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-serif text-lg font-semibold tracking-tight">
                  {progressStageLabel(statusData?.progress_stage ?? null)}
                </p>
                <p className="text-sm text-muted-foreground">
                  This usually takes 1–2 minutes. You can close this dialog — the job will keep
                  running.
                </p>
              </div>

              {/* Stage dots */}
              <div className="flex justify-center gap-2">
                {(['prompt1', 'prompt2', 'prompt3', 'postprocess'] as const).map((s) => {
                  const stages = [
                    'starting',
                    'apify',
                    'prompt1',
                    'prompt2',
                    'prompt3',
                    'postprocess',
                  ];
                  const currentIdx = stages.indexOf(statusData?.progress_stage ?? 'starting');
                  const dotIdx = stages.indexOf(s);
                  const isDone = dotIdx < currentIdx;
                  const isActive = dotIdx === currentIdx;
                  return (
                    <div
                      key={s}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        isDone ? 'bg-primary' : isActive ? 'bg-primary/50' : 'bg-border'
                      }`}
                    />
                  );
                })}
              </div>

              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel Job
              </Button>
            </div>
          )}

          {/* ── Done phase ───────────────────────────────────── */}
          {phase === 'done' && (
            <div className="space-y-4 py-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                  <Wand2 className="h-6 w-6" />
                </div>
                <p className="font-serif text-lg font-semibold tracking-tight">
                  Your tailored resume is ready!
                </p>
                <p className="text-sm text-muted-foreground">
                  A new resume has been created based on the job description.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button onClick={handleViewResult}>View Tailored Resume</Button>
              </div>
            </div>
          )}

          {/* ── Error phase ──────────────────────────────────── */}
          {phase === 'error' && (
            <div className="space-y-4 py-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <p className="font-serif text-lg font-semibold tracking-tight">Pipeline failed</p>
                <p className="max-w-sm text-sm text-amber-800">{errorMsg}</p>
                {statusData?.error_code === 'missing_api_key' && (
                  <Link
                    href="/settings"
                    className="text-sm font-semibold text-primary underline underline-offset-2"
                    onClick={onClose}
                  >
                    Go to Settings → API Keys
                  </Link>
                )}
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setPhase('input');
                    setErrorMsg('');
                    setStatusData(null);
                    setJdUrl('');
                    setJdText('');
                  }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
