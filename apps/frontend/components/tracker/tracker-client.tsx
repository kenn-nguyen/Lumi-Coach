'use client';

import Link from 'next/link';
import * as React from 'react';

import {
  COLUMNS,
  type ColumnOverrides,
  type ViewKey,
  isColumnOn,
  loadOverrides,
  saveOverrides,
  visibleColumns,
} from '@/components/tracker/columns';
import { JobRow } from '@/components/tracker/job-row';
import { TrackerHelp } from '@/components/tracker/tracker-help';
import { TrackerRuns } from '@/components/tracker/tracker-runs';
import { TrackerSettings } from '@/components/tracker/tracker-settings';
import { Button } from '@/components/ui/button';
import { RetroTabs } from '@/components/ui/retro-tabs';
import {
  type BulkOp,
  type TrackerRun,
  type JobsResponse,
  type QueueCounts,
  type TrackerJob,
  type TrackerMeta,
  bulkJobs,
  fetchJobs,
  fetchMeta,
  fetchRuns,
  setLinkDead,
  patchJob,
} from '@/lib/api/tracker';

const PAGE_SIZE = 25;
const EMPTY_COUNTS: QueueCounts = {
  flagged: 0,
  assigned: 0,
  submitted: 0,
  unowned_top: 0,
  total: 0,
};

type TabId = 'jobs' | 'runs' | 'settings' | 'help';

export function TrackerClient() {
  const [meta, setMeta] = React.useState<TrackerMeta | null>(null);
  const [tab, setTab] = React.useState<TabId>('jobs');

  const [view, setView] = React.useState<ViewKey>('assigned');
  const [overrides, setOverrides] = React.useState<ColumnOverrides>({ assigned: {}, all: {} });
  const [showColumns, setShowColumns] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);

  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [priority, setPriority] = React.useState('');
  const [visa, setVisa] = React.useState('');
  const [owner, setOwner] = React.useState('');
  const [sort, setSort] = React.useState<string>('');
  const [direction, setDirection] = React.useState<'asc' | 'desc'>('asc');

  const [page, setPage] = React.useState(0);
  const [data, setData] = React.useState<JobsResponse | null>(null);
  const [counts, setCounts] = React.useState<QueueCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  //

  const [watchToken, setWatchToken] = React.useState(0);

  const [fromRun, setFromRun] = React.useState<string | null>(null);
  // A run finishes in the background, so the page has to notice and say so;
  // otherwise Run Now looks like it did nothing.
  const [finishedRun, setFinishedRun] = React.useState<TrackerRun | null>(null);
  const activeRunId = React.useRef<string | null>(null);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const isOwner = meta?.role !== 'assignee';

  React.useEffect(() => setOverrides(loadOverrides()), []);

  React.useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch((e: Error) => setError(e.message));
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const body = await fetchJobs({
        view,
        from_run: fromRun || undefined,
        q: debounced || undefined,
        status: status || undefined,
        priority: priority || undefined,
        us_visa: visa || undefined,
        owner: owner || undefined,
        sort: sort || undefined,
        direction,
        offset: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setData(body);
      setCounts(body.counts);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [view, fromRun, debounced, status, priority, visa, owner, sort, direction, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Poll only while something is running: a finished run needs no watching, and
  // an idle page should not be asking every few seconds.
  const checkRuns = React.useCallback(async () => {
    try {
      const { runs } = await fetchRuns(3);
      const running = runs.find((r) => !r.finished_at) ?? null;
      if (running) {
        activeRunId.current = running.run_id;
        return true;
      }
      if (activeRunId.current) {
        const done = runs.find((r) => r.run_id === activeRunId.current) ?? null;
        activeRunId.current = null;
        if (done) {
          setFinishedRun(done);
          await load();
        }
      }
      return false;
    } catch {
      return false; // a failed poll is not worth interrupting the page for
    }
  }, [load]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;
    void (async () => {
      const running = await checkRuns();
      if (running && !cancelled) timer = setInterval(() => void checkRuns(), 5000);
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [checkRuns, watchToken]);

  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const columns = React.useMemo(() => visibleColumns(view, overrides), [view, overrides]);
  const statusOptions = React.useMemo(() => {
    if (!meta) return [];
    if (view !== 'assigned') return meta.statuses;
    return meta.assignee_statuses?.length ? meta.assignee_statuses : meta.statuses;
  }, [meta, view]);
  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  function switchView(next: ViewKey) {
    setView(next);
    setPage(0);
    setSelected(new Set());
  }

  function toggleColumn(key: string, on: boolean) {
    const next = { ...overrides, [view]: { ...overrides[view], [key]: on } };
    setOverrides(next);
    saveOverrides(next);
  }

  function clearFilters() {
    setFromRun(null);
    setStatus('');
    setPriority('');
    setVisa('');
    setOwner('');
    setSearch('');
    setPage(0);
  }

  function applyShortcut(next: ViewKey, filters: { status?: string; owner?: string }) {
    clearFilters();
    setFinishedRun(null);
    setView(next);
    setStatus(filters.status ?? '');
    setOwner(filters.owner ?? '');
    setPage(0);
    setTab('jobs');
  }

  function toggleSort(key: 'fit' | 'posted') {
    if (sort === key) setDirection(direction === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setDirection('asc');
    }
    setPage(0);
  }

  async function handlePatch(jobId: string, changes: Partial<TrackerJob>) {
    // Optimistic: the row is the user's own edit, so showing it immediately is
    // honest. A failure reloads and surfaces the real state.
    setData((current) =>
      current
        ? {
            ...current,
            jobs: current.jobs.map((j) => (j.job_id === jobId ? { ...j, ...changes } : j)),
          }
        : current
    );
    try {
      await patchJob(jobId, changes);
      await load();
    } catch (e) {
      setToast(`Could not save: ${(e as Error).message}`);
      await load();
    }
  }

  async function handleSetDead(jobId: string, linkId: string, dead: boolean) {
    try {
      const updated = await setLinkDead(jobId, linkId, dead);
      setData((current) =>
        current
          ? {
              ...current,
              jobs: current.jobs.map((j) => (j.job_id === jobId ? { ...j, ...updated } : j)),
            }
          : current
      );
      const live = updated.merged_job_ids.filter((id) => !updated.dead_links?.[id]).length;
      setToast(
        live === 0
          ? 'That was the last working link — build the resume from the saved description instead.'
          : 'Marked dead. Nobody has to try it again.'
      );
    } catch (e) {
      setToast(`Could not save: ${(e as Error).message}`);
    }
  }

  async function handleBulk(op: BulkOp) {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      const result = await bulkJobs(ids, op);
      setSelected(new Set());
      setToast(`${result.updated} job${result.updated === 1 ? '' : 's'} updated.`);
      await load();
    } catch (e) {
      setToast(`Could not apply: ${(e as Error).message}`);
    }
  }

  const allOnPageSelected = jobs.length > 0 && jobs.every((j) => selected.has(j.job_id));

  const tabs = [
    {
      id: 'jobs',
      label: (
        <>
          Jobs <span className="ml-1.5 opacity-60">{counts.total}</span>
        </>
      ),
    },
    ...(isOwner
      ? [
          { id: 'runs', label: 'Runs' },
          { id: 'settings', label: 'Settings' },
        ]
      : []),
    { id: 'help', label: 'Help' },
  ];

  return (
    <div className="mx-auto w-full max-w-[2200px] px-4 pb-16 pt-5 2xl:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Lumi Coach
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Job Tracker</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              ← Dashboard
            </Button>
          </Link>
          {meta && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {meta.role}
            </span>
          )}
        </div>
      </header>

      {isOwner && (
        <div className="grid gap-2.5 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip
            value={counts.flagged}
            label="flagged"
            tone="alert"
            onClick={() => applyShortcut('all', { status: 'Flagged' })}
          />
          <StatChip
            value={counts.assigned}
            label="assigned out"
            tone="calm"
            onClick={() => applyShortcut('assigned', {})}
          />
          <StatChip
            value={counts.submitted}
            label="submitted"
            onClick={() => applyShortcut('all', { status: 'Submitted' })}
          />
          <StatChip
            value={counts.unowned_top}
            label="P01–P02 unowned"
            tone="hot"
            onClick={() => applyShortcut('all', { owner: '__none' })}
          />
        </div>
      )}

      {finishedRun && (
        <RunFinishedBanner
          run={finishedRun}
          onShow={() => {
            clearFilters();
            setView('all');
            setFromRun(finishedRun.run_id);
            setPage(0);
            setTab('jobs');
            setFinishedRun(null);
          }}
          onDismiss={() => setFinishedRun(null)}
        />
      )}

      <div className="mt-5">
        <RetroTabs tabs={tabs} activeTab={tab} onTabChange={(id) => setTab(id as TabId)} />
      </div>

      {error && (
        <p className="mt-4 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === 'jobs' && (
        <section className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex overflow-hidden rounded border border-border bg-card">
              <button
                type="button"
                data-testid="view-assigned"
                aria-pressed={view === 'assigned'}
                onClick={() => switchView('assigned')}
                className={`border-r border-border px-3.5 py-1.5 text-[13px] ${
                  view === 'assigned'
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                Assigned only{' '}
                <span className="ml-1 font-mono text-[11px] opacity-70">{counts.assigned}</span>
              </button>
              <button
                type="button"
                data-testid="view-all"
                aria-pressed={view === 'all'}
                onClick={() => switchView('all')}
                className={`px-3.5 py-1.5 text-[13px] ${
                  view === 'all'
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                All jobs{' '}
                <span className="ml-1 font-mono text-[11px] opacity-70">{counts.total}</span>
              </button>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search company or title…"
              aria-label="Search jobs"
              className="w-full max-w-[260px] rounded border border-border bg-card px-2.5 py-2 text-[13px]"
            />
          </div>

          {fromRun && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-primary bg-primary/5 px-3.5 py-2">
              <span className="font-mono text-xs">Showing only what one run produced</span>
              <Button size="sm" variant="ghost" onClick={() => setFromRun(null)}>
                Show everything
              </Button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowColumns(!showColumns)}>
              Columns{' '}
              <span className="ml-1 text-muted-foreground">
                {COLUMNS.filter((c) => !c.fixed && isColumnOn(c, view, overrides)).length} of{' '}
                {COLUMNS.filter((c) => !c.fixed).length}
              </span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
            {(status || priority || visa || owner || search) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          {showColumns && (
            <div className="mt-2 grid gap-2 rounded border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-5">
              {COLUMNS.filter((c) => !c.fixed).map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={isColumnOn(col, view, overrides)}
                    onChange={(e) => toggleColumn(col.key, e.target.checked)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}

          {showFilters && meta && (
            <div className="mt-2 grid gap-3 rounded border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Status" value={status} onChange={setStatus} options={meta.statuses} />
              <Select
                label="Priority"
                value={priority}
                onChange={setPriority}
                options={meta.priorities}
              />
              <Select label="US visa" value={visa} onChange={setVisa} options={meta.visas} />
              <Select
                label="Owner"
                value={owner}
                onChange={setOwner}
                options={meta.owners}
                extra={[{ value: '__none', label: 'Unowned' }]}
              />
            </div>
          )}

          {selected.size > 0 && isOwner && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-primary bg-primary/5 px-3.5 py-2.5">
              <span className="font-mono text-xs font-semibold">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={() => handleBulk('assign')}>
                Assign Selected
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulk('assign_prep')}>
                Assign (Fill Only)
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulk('take_back')}>
                Take back
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulk('rescore')}>
                Reevaluate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulk('skip')}>
                Skip
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Cancel
              </Button>
            </div>
          )}

          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-sw-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-secondary/60">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`border-b border-border px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground ${
                          col.sort ? 'cursor-pointer hover:text-foreground' : ''
                        } ${col.align === 'right' ? 'text-right' : ''}`}
                        onClick={col.sort ? () => toggleSort(col.sort!) : undefined}
                      >
                        {col.key === 'select' ? (
                          <input
                            type="checkbox"
                            checked={allOnPageSelected}
                            aria-label="Select all on this page"
                            onChange={(e) => {
                              const next = new Set(selected);
                              jobs.forEach((j) =>
                                e.target.checked ? next.add(j.job_id) : next.delete(j.job_id)
                              );
                              setSelected(next);
                            }}
                          />
                        ) : (
                          <>
                            {col.label}
                            {col.sort && sort === col.sort && (
                              <span className="ml-1">{direction === 'asc' ? '▼' : '▲'}</span>
                            )}
                          </>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && jobs.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && jobs.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        {view === 'assigned' ? (
                          <>
                            <strong className="text-foreground">Nothing is assigned.</strong>
                            <br />
                            Switch to All jobs and assign some, or let the routing rules do it on
                            the next run.
                          </>
                        ) : (
                          <>
                            <strong className="text-foreground">No jobs match.</strong>
                            <br />
                            Try clearing the search or filters.
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                  {jobs.map((job, index) => (
                    <JobRow
                      key={job.job_id}
                      job={job}
                      rank={page * PAGE_SIZE + index + 1}
                      columns={columns}
                      meta={meta}
                      canEditEverything={isOwner}
                      selected={selected.has(job.job_id)}
                      expanded={expanded.has(job.job_id)}
                      onToggleSelect={(id) => {
                        const next = new Set(selected);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setSelected(next);
                      }}
                      onToggleExpand={(id) => {
                        const next = new Set(expanded);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setExpanded(next);
                      }}
                      onPatch={handlePatch}
                      onSetDead={handleSetDead}
                      statusOptions={statusOptions}
                      onToast={setToast}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/40 px-3.5 py-2.5">
              <span className="font-mono text-[11px] text-muted-foreground">
                {total === 0
                  ? 'Nothing to show'
                  : `Showing ${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}`}
              </span>
              <span className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  ← Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= maxPage}
                  onClick={() => setPage(page + 1)}
                >
                  Next →
                </Button>
              </span>
            </div>
          </div>
        </section>
      )}

      {tab === 'runs' && (
        <TrackerRuns onToast={setToast} onRunStarted={() => setWatchToken((n) => n + 1)} />
      )}
      {tab === 'settings' && <TrackerSettings onToast={setToast} />}
      {tab === 'help' && <TrackerHelp />}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-50 max-w-sm rounded border border-border border-l-[3px] border-l-primary bg-card px-3.5 py-2.5 text-sm shadow-sw-card"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function RunFinishedBanner({
  run,
  onShow,
  onDismiss,
}: {
  run: TrackerRun;
  onShow: () => void;
  onDismiss: () => void;
}) {
  const at = run.finished_at
    ? new Date(run.finished_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const added = Number(run.counters?.new_jobs ?? 0);
  const scored = Number(run.counters?.scored ?? 0);
  const failed = Number(run.counters?.failed ?? 0);
  const known = Number(run.counters?.already_known ?? 0);
  const broke = run.status === 'Failed';

  return (
    <div
      role="status"
      className={`mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${
        broke ? 'border-destructive bg-destructive/5' : 'border-primary bg-primary/5'
      }`}
    >
      <span className="text-sm">
        {broke ? (
          <>
            <strong>The {at} run failed.</strong> {run.errors?.[0] ?? 'No reason recorded.'}
          </>
        ) : added > 0 ? (
          <>
            <strong>
              {added} new job{added === 1 ? '' : 's'}
            </strong>{' '}
            from the {at} run.
          </>
        ) : (
          <>
            <strong>Nothing new</strong> in the {at} run.
          </>
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {scored} scored
        {known > 0 && `, ${known} already known`}
        {failed > 0 && `, ${failed} failed`}
      </span>
      {added > 0 && !broke && (
        <Button size="sm" variant="outline" onClick={onShow}>
          Show them
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

function StatChip({
  value,
  label,
  tone,
  onClick,
}: {
  value: number;
  label: string;
  tone?: 'alert' | 'calm' | 'hot';
  onClick: () => void;
}) {
  const border =
    tone === 'alert'
      ? 'border-l-destructive'
      : tone === 'hot'
        ? 'border-l-success'
        : tone === 'calm'
          ? 'border-l-primary'
          : 'border-l-border';
  const value_tone = tone === 'alert' ? 'text-destructive' : tone === 'hot' ? 'text-success' : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid gap-0.5 rounded border border-border border-l-[3px] ${border} bg-card px-3.5 py-3 text-left hover:bg-muted`}
    >
      <span className={`text-[22px] font-semibold leading-none tabular-nums ${value_tone}`}>
        {value}
      </span>
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  extra = [],
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  extra?: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <select
        className="rounded border border-border bg-card px-2.5 py-2 text-[13px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Any</option>
        {extra.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {options.filter(Boolean).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
