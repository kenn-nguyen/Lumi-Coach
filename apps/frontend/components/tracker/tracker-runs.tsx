'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { type TrackerRun, cancelRun, fetchRuns, startRun } from '@/lib/api/tracker';

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground';

/** Starting runs and reading what past ones did. */
export function TrackerRuns({
  onToast,
  onRunStarted,
}: {
  onToast: (message: string) => void;
  /** Lets the page start watching, so it can say when the run finishes. */
  onRunStarted?: () => void;
}) {
  const [runs, setRuns] = React.useState<TrackerRun[]>([]);
  const [showImport, setShowImport] = React.useState(false);
  const [urls, setUrls] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setRuns((await fetchRuns()).runs);
    } catch (e) {
      onToast(`Could not load runs: ${(e as Error).message}`);
    }
  }, [onToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const active = runs.find((r) => !r.finished_at);

  async function begin(mode: 'import' | 'detail' | 'reevaluate', jobUrls: string[] = []) {
    setBusy(true);
    try {
      await startRun(mode, jobUrls);
      onToast('Run started. You will be told here when it finishes.');
      onRunStarted?.();
      await load();
    } catch (e) {
      onToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || Boolean(active)} onClick={() => begin('import')}>
          Run Now
        </Button>
        <Button variant="outline" onClick={() => setShowImport(!showImport)}>
          Import Jobs Manually…
        </Button>
        <Button
          variant="outline"
          disabled={!active}
          onClick={async () => {
            if (!active) return;
            await cancelRun(active.run_id);
            onToast('Run cancelled. Jobs already scored stayed in the queue.');
            await load();
          }}
        >
          Cancel Run
        </Button>
        <span className="text-xs text-muted-foreground">
          Runs start on their own on the schedule in Settings, outside quiet hours.
        </span>
      </div>

      {showImport && (
        <div className="mt-3 max-w-xl">
          <label className={LABEL} htmlFor="import-urls">
            LinkedIn job links — one per line
          </label>
          <textarea
            id="import-urls"
            rows={4}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/4071234567"
            className="mt-1.5 w-full rounded border border-border bg-card p-2 font-mono text-xs"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                const list = urls.split(/\s+/).filter(Boolean);
                if (!list.length) {
                  onToast('Paste at least one LinkedIn job link.');
                  return;
                }
                await begin('detail', list);
                setUrls('');
                setShowImport(false);
              }}
            >
              Score these
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-sw-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary/60">
                {['Started', 'How', 'Phase', 'Scored', 'New', 'Failed', 'Result', 'Notes'].map(
                  (h) => (
                    <th
                      key={h}
                      className="border-b border-border px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    <strong className="text-foreground">No runs yet.</strong>
                    <br />
                    Run Now scrapes and scores; later runs only score what is new.
                  </td>
                </tr>
              )}
              {runs.map((run) => (
                <tr key={run.run_id} className="hover:bg-muted">
                  <td className="whitespace-nowrap border-b border-border px-3 py-2 font-mono text-xs tabular-nums">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                  </td>
                  <td className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    {run.mode}
                  </td>
                  <td className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    {run.phase}
                  </td>
                  <td className="border-b border-border px-3 py-2 font-mono text-xs">
                    {run.counters?.scored ?? 0}
                  </td>
                  <td className="border-b border-border px-3 py-2 font-mono text-xs">
                    {run.counters?.new_jobs ?? 0}
                  </td>
                  <td className="border-b border-border px-3 py-2 font-mono text-xs">
                    {run.counters?.failed ?? 0}
                  </td>
                  <td className="border-b border-border px-3 py-2">
                    <span
                      className={`font-mono text-xs ${
                        run.status === 'Completed'
                          ? 'text-success'
                          : run.status === 'Failed'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    {run.errors?.[0] ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
