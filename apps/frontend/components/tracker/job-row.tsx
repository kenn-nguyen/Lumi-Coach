'use client';

import * as React from 'react';

import {
  type ColumnDef,
  formatDate,
  liveLinkCount,
  priorityClass,
  quickAction,
  statusClass,
  visaClass,
} from '@/components/tracker/columns';
import { JobWorkArea } from '@/components/tracker/job-work-area';
import { LinkMenu, jobLinkIds, linkUrl } from '@/components/tracker/link-menu';
import type { TrackerJob, TrackerMeta } from '@/lib/api/tracker';

interface JobRowProps {
  job: TrackerJob;
  rank: number;
  columns: ColumnDef[];
  meta: TrackerMeta | null;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: (jobId: string) => void;
  onToggleExpand: (jobId: string) => void;
  onPatch: (
    jobId: string,
    changes: Partial<TrackerJob>,
    /** What to confirm, and the values an undo would restore. */
    said?: { message: string; revert?: Partial<TrackerJob> },
  ) => void;
  onSetDead: (jobId: string, linkId: string, dead: boolean) => void;
  /** The statuses this view offers. Shorter in the assigned view. */
  statusOptions: string[];
  onToast: (message: string) => void;
}

const CELL = 'border-b border-border px-3 py-2 align-middle';

export function JobRow({
  job,
  rank,
  columns,
  meta,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onPatch,
  onSetDead,
  statusOptions,
  onToast,
}: JobRowProps) {
  const { live, total } = liveLinkCount(job);
  const dead = total > 0 && live === 0;

  // The note is edited in place, so it is held locally and written on blur rather
  // than on every keystroke.
  const [linkMenu, setLinkMenu] = React.useState<DOMRect | null>(null);
  const [noteDraft, setNoteDraft] = React.useState(job.notes ?? '');
  const noteRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => setNoteDraft(job.notes ?? ''), [job.notes]);

  function changeStatus(next: string) {
    // Flagging sends a job back to the owner, and a flag with no reason gives them
    // nothing to act on. Refuse it here and put the cursor where the fix is.
    if (next === 'Flagged' && !noteDraft.trim()) {
      onToast('Add a note first — a flagged job needs a reason.');
      noteRef.current?.focus();
      return;
    }
    // This is where status actually gets changed — from the row, not from the
    // opened card. The new status re-sorts the row, usually off the page, so the
    // way back has to travel with the confirmation or a mis-pick is unrecoverable.
    onPatch(
      job.job_id,
      { status: next },
      { message: `Marked ${next}.`, revert: { status: job.status } }
    );
  }

  function saveNote() {
    if (noteDraft !== (job.notes ?? '')) onPatch(job.job_id, { notes: noteDraft });
  }

  function cell(col: ColumnDef): React.ReactNode {
    switch (col.key) {
      case 'select':
        return (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(job.job_id)}
            aria-label={`Select ${job.company ?? job.job_id}`}
          />
        );
      case 'rank':
        return <span className="font-mono text-muted-foreground tabular-nums">{rank}</span>;
      case 'fit':
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span
              className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${priorityClass(job.priority)}`}
            >
              {job.priority ?? '—'}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {job.score ?? '—'}
            </span>
          </span>
        );
      case 'job':
        return (
          <span className="block min-w-[260px]">
            <span className="font-semibold">{job.company ?? '—'}</span>
            {job.action === 'Fill Only' && (
              <span
                className="ml-2 rounded border border-warning/50 px-1.5 py-px align-middle font-mono text-[10px] uppercase tracking-wider text-warning"
                title="Fill the form but do not submit it"
              >
                fill only
              </span>
            )}
            <span className="block text-[13px] leading-snug">{job.title ?? '—'}</span>
          </span>
        );
      case 'priority':
        return (
          <span
            className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${priorityClass(job.priority)}`}
          >
            {job.priority ?? '—'}
          </span>
        );
      case 'score':
        return <span className="font-mono tabular-nums">{job.score ?? '—'}</span>;
      case 'us_visa':
        return (
          <span className={`whitespace-nowrap text-xs ${visaClass(job.us_visa)}`}>
            {job.us_visa ?? '—'}
          </span>
        );
      case 'company':
        return <span className="font-semibold">{job.company ?? '—'}</span>;
      case 'title':
        return <span className="block min-w-[200px]">{job.title ?? '—'}</span>;
      case 'level':
        return (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {job.title_level ?? '—'}
            <br />
            <span className="opacity-70">JD: {job.jd_implied_level ?? '—'}</span>
          </span>
        );
      case 'status': {
        const quick = quickAction(job.status, job.action);
        return meta ? (
          <div className="flex items-center gap-1.5">
          <select
            // Styled as a control rather than as text: this is the row's primary
            // action, and a bare value with no edges does not read as one.
            className={`cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold shadow-xs transition-colors hover:border-foreground/30 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${statusClass(job.status)}`}
            value={job.status}
            onChange={(e) => changeStatus(e.target.value)}
            aria-label={`Status for ${job.company ?? job.job_id}`}
          >
            {/* A row already in some other state keeps its own value in the list,
                or the select would render with nothing selected. */}
            {(statusOptions.includes(job.status)
              ? statusOptions
              : [...statusOptions, job.status]
            ).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {/* The one outcome that happens hundreds of times, as one click. */}
          {quick && (
            <button
              type="button"
              onClick={() => changeStatus(quick.status)}
              title={`Mark ${job.company ?? 'this job'} as ${quick.status.toLowerCase()}`}
              className="whitespace-nowrap rounded-full border border-success/30 bg-success/10 px-2 py-1 text-xs font-semibold text-success transition-colors hover:bg-success hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/40"
            >
              {quick.label}
            </button>
          )}
          </div>
        ) : (
          job.status
        );
      }
      case 'owner':
        return meta ? (
          <select
            className="cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-muted-foreground hover:border-border"
            value={job.owner ?? ''}
            onChange={(e) => onPatch(job.job_id, { owner: e.target.value })}
            aria-label={`Owner for ${job.company ?? job.job_id}`}
          >
            <option value="">—</option>
            {meta.owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">{job.owner || '—'}</span>
        );
      case 'action':
        if (!meta) {
          return (
            <span
              className={`text-xs ${
                job.action === 'Fill Only' ? 'text-warning' : 'text-muted-foreground'
              }`}
            >
              {job.action === 'Fill & Submit' ? '—' : job.action || '—'}
            </span>
          );
        }
        return (
          <select
            className={`cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-border ${
              job.action === 'Fill Only' ? 'text-warning font-semibold' : 'text-muted-foreground'
            }`}
            value={job.action ?? ''}
            onChange={(e) => onPatch(job.job_id, { action: e.target.value })}
            aria-label={`Action for ${job.company ?? job.job_id}`}
            // "Fill & Submit" is what almost every delegated job is, so it reads as a
            // dash. "Fill Only" is the exception that changes what the assignee does.
            title={job.action || 'No action set'}
          >
            <option value="">—</option>
            {meta.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        );
      case 'location':
        return (
          <span
            className="block max-w-[96px] truncate text-xs text-muted-foreground"
            title={job.location ?? undefined}
          >
            {job.location ?? '—'}
          </span>
        );
      case 'posted':
        return (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(job.posted)}
          </span>
        );
      case 'applicants':
        return (
          <span className="font-mono text-xs text-muted-foreground">{job.applicants ?? '—'}</span>
        );
      case 'links': {
        const ids = jobLinkIds(job);
        const cls = `whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] ${
          dead ? 'border-destructive/50 text-destructive' : 'border-border text-primary'
        }`;
        // One posting is not a choice, so clicking opens it. Several is a choice,
        // because the older ones are often expired.
        if (ids.length === 1) {
          return (
            <a
              href={linkUrl(ids[0])}
              target="_blank"
              rel="noopener noreferrer"
              className={cls}
              title={dead ? 'Marked dead — it may still open' : 'Open this posting'}
            >
              {live}/{total} ↗
            </a>
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => setLinkMenu(e.currentTarget.getBoundingClientRect())}
            aria-haspopup="dialog"
            aria-expanded={Boolean(linkMenu)}
            className={cls}
            title={`${ids.length} postings for this role`}
          >
            {live}/{total} ▾
          </button>
        );
      }
      case 'notes':
        return (
          <input
            ref={noteRef}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') setNoteDraft(job.notes ?? '');
            }}
            placeholder="Add a note…"
            aria-label={`Note for ${job.company ?? job.job_id}`}
            className={`w-full min-w-[200px] rounded border border-transparent bg-transparent px-1.5 py-1 text-xs hover:border-border focus:border-border focus:bg-card ${
              job.status === 'Flagged' ? 'text-destructive' : ''
            }`}
          />
        );
      case 'applied_at':
        return (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums">
            {formatDate(job.applied_at)}
          </span>
        );
      case 'expand':
        return (
          <button
            type="button"
            className="rounded border border-transparent px-1.5 text-muted-foreground hover:border-border hover:text-foreground"
            aria-expanded={expanded}
            aria-label={`Details for ${job.company ?? job.job_id}`}
            onClick={() => onToggleExpand(job.job_id)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        );
      default:
        return null;
    }
  }

  return (
    <>
      <tr
        data-testid="job-row"
        data-job-id={job.job_id}
        className={`${selected ? 'bg-primary/5' : ''} ${
          job.status === 'Flagged' ? 'shadow-[inset_3px_0_0_var(--destructive)]' : ''
        } hover:bg-muted`}
      >
        {columns.map((col) => (
          <td
            key={col.key}
            className={`${CELL} ${col.align === 'right' ? 'text-right' : ''} ${
              col.wide ? 'min-w-[220px]' : ''
            }`}
          >
            {cell(col)}
          </td>
        ))}
      </tr>
      {linkMenu && (
        <LinkMenu
          job={job}
          anchor={linkMenu}
          onSetDead={onSetDead}
          onClose={() => setLinkMenu(null)}
        />
      )}
      {expanded && (
        <tr data-testid="job-detail">
          <td colSpan={columns.length} className="border-b border-border bg-muted p-0">
            <JobWorkArea
              job={job}
              onPatch={onPatch}
              onSetDead={onSetDead}
            />
          </td>
        </tr>
      )}
    </>
  );
}
