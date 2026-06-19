'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import { apiFetch, readApiErrorMessage } from '@/lib/api/client';

interface ExtensionRun {
  run_id: string;
  status: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  source_url?: string | null;
  job_source?: string | null;
  resume_id?: string | null;
  generated_at?: string | null;
  created_at?: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'generated'
      ? 'border-green-200 bg-green-50 text-green-700'
      : status === 'failed'
        ? 'border-red-200 bg-red-50 text-red-600'
        : status === 'running'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-border bg-secondary text-gray-500';
  return <span className={`border px-1.5 py-0.5 font-mono text-[10px] ${cls}`}>{status}</span>;
}

async function fetchMyRuns(): Promise<{ items: ExtensionRun[]; total: number }> {
  const res = await apiFetch('/api/v1/extension/runs?limit=50');
  if (!res.ok) {
    const msg = await readApiErrorMessage(res, 'Failed to load runs');
    throw new Error(msg);
  }
  return res.json();
}

export default function MyRunsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [runs, setRuns] = useState<ExtensionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyRuns();
      setRuns(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') load();
    if (authStatus === 'unauthenticated') router.replace('/sign-in');
  }, [authStatus, load, router]);

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
            <h1 className="font-serif text-2xl font-bold tracking-tight">My Runs</h1>
            <p className="font-mono text-xs text-gray-500">Extension tailor pipeline history</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-mono text-xs text-amber-800">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white/40 py-16 text-center">
            <p className="font-mono text-sm text-gray-400">No runs yet.</p>
            <p className="font-mono text-xs text-gray-400">
              Use the Chrome extension to tailor a resume.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.run_id} className="rounded-2xl border border-border bg-white/60 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={run.status} />
                      <span className="font-mono text-[10px] text-gray-400">
                        {formatDate(run.generated_at || run.created_at)}
                      </span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-gray-800">
                      {run.company && run.title
                        ? `${run.company} · ${run.title}`
                        : run.company || run.title || run.run_id}
                    </p>
                    {run.location && (
                      <p className="font-mono text-xs text-gray-500">{run.location}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {run.resume_id && run.status === 'generated' && (
                      <Link
                        href={`/resumes/${run.resume_id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        View resume
                      </Link>
                    )}
                    {run.source_url && (
                      <a
                        href={run.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
