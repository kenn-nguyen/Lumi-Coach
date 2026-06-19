'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  fetchEvalCases,
  deleteEvalCase,
  runEvalStep,
  type EvalCase,
  type EvalRunSummary,
} from '@/lib/api/evals';

const PROFILE_LABELS: Record<string, string> = {
  profile1: 'Safe',
  profile2: 'Competitive',
  profile3: 'Lean',
  profile4: 'Direct',
};

function StepBadge({
  step,
  run,
}: {
  step: string;
  run?: { passed: boolean; error: string | null };
}) {
  if (!run) return <span className="font-mono text-[10px] text-gray-400">{step} —</span>;
  return (
    <span
      className={`border px-1.5 py-0.5 font-mono text-[10px] ${
        run.error
          ? 'border-red-200 bg-red-50 text-red-600'
          : run.passed
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {step} {run.error ? '✗ error' : run.passed ? '✓' : '✗'}
    </span>
  );
}

export default function UserEvalsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [cases, setCases] = useState<EvalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState<'structural' | 'heuristics' | 'judge' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvalCases({ userScoped: true });
      setCases(res.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') loadCases();
    if (authStatus === 'unauthenticated') router.replace('/sign-in');
  }, [authStatus, loadCases, router]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunStep = async (step: 'structural' | 'heuristics' | 'judge') => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : cases.map((c) => c.id);
    if (ids.length === 0) return;
    setRunning(step);
    setError(null);
    try {
      await runEvalStep({ case_ids: ids, step, userScoped: true });
      await loadCases();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(null);
    }
  };

  const handleDelete = async (caseId: string) => {
    try {
      await deleteEvalCase(caseId, { userScoped: true });
      setCases((prev) => prev.filter((c) => c.id !== caseId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(caseId);
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 font-mono text-xs text-gray-500 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">My Evals</h1>
            <p className="font-mono text-xs text-gray-500">
              {cases.length} eval case{cases.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2">
          {(['structural', 'heuristics', 'judge'] as const).map((step) => (
            <Button
              key={step}
              size="sm"
              variant="outline"
              onClick={() => handleRunStep(step)}
              disabled={running !== null}
              className="font-mono text-xs"
            >
              {running === step ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
              Run {step} {selectedIds.size > 0 ? `(${selectedIds.size})` : '(all)'}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : cases.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white/40 py-16 text-center">
            <ShieldAlert className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 font-mono text-sm text-gray-400">No eval cases yet.</p>
            <p className="font-mono text-xs text-gray-400">
              Open a tailored resume and click &ldquo;Save as eval case&rdquo;.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((c) => {
              const structuralRun = c.latest_runs?.structural as EvalRunSummary | undefined;
              const heuristicsRun = c.latest_runs?.heuristics as EvalRunSummary | undefined;
              const judgeRun = c.latest_runs?.judge as EvalRunSummary | undefined;
              const relDelta = heuristicsRun?.scores?.relevance_delta as number | undefined;
              const atsDelta = heuristicsRun?.scores?.ats_keyword_delta as number | undefined;
              const verdict = judgeRun?.scores?.verdict as string | undefined;
              return (
                <div
                  key={c.id}
                  className={`rounded-2xl border bg-white/60 p-4 transition-colors ${
                    selectedIds.has(c.id) ? 'border-primary/40 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-700">
                            {PROFILE_LABELS[c.prompt_profile_id] ?? c.prompt_profile_id}
                          </span>
                          <span className="font-mono text-[10px] text-gray-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                          {c.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-gray-600"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="shrink-0 border border-red-200 px-2 py-0.5 font-mono text-[10px] text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StepBadge step="structural" run={structuralRun} />
                        <StepBadge step="heuristics" run={heuristicsRun} />
                        <StepBadge step="judge" run={judgeRun} />
                        {relDelta !== undefined && (
                          <span
                            className={`font-mono text-[10px] ${relDelta > 0 ? 'text-green-700' : 'text-red-600'}`}
                          >
                            rel {relDelta > 0 ? '+' : ''}
                            {relDelta.toFixed(3)}
                          </span>
                        )}
                        {atsDelta !== undefined && (
                          <span
                            className={`font-mono text-[10px] ${atsDelta >= 0 ? 'text-green-700' : 'text-red-600'}`}
                          >
                            ats {atsDelta >= 0 ? '+' : ''}
                            {Math.round(atsDelta * 100)}%
                          </span>
                        )}
                        {verdict && (
                          <span
                            className={`font-mono text-[10px] font-bold ${
                              verdict === 'shortlist'
                                ? 'text-green-700'
                                : verdict === 'maybe'
                                  ? 'text-amber-700'
                                  : 'text-red-600'
                            }`}
                          >
                            {verdict}
                          </span>
                        )}
                      </div>
                      {c.notes && <p className="font-mono text-[11px] text-gray-500">{c.notes}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
