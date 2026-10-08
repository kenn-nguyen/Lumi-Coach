'use client';

import * as React from 'react';

import {
  type ColumnDef,
  formatDate,
  liveLinkCount,
  priorityClass,
  statusClass,
  visaClass,
} from '@/components/tracker/columns';
import { JobWorkArea } from '@/components/tracker/job-work-area';
import type { TrackerJob, TrackerMeta } from '@/lib/api/tracker';

interface JobRowProps {
  job: TrackerJob;
  rank: number;
  columns: ColumnDef[];
  meta: TrackerMeta | null;
  selected: boolean;
  expanded: boolean;
  canEditEverything: boolean;
  onToggleSelect: (jobId: string) => void;
  onToggleExpand: (jobId: string) => void;
  onPatch: (jobId: string, changes: Partial<TrackerJob>) => void;
  onMarkDead: (jobId: string, linkId: string) => void;
}

const CELL = 'border-b border-border px-3 py-2 align-middle';

export function JobRow({
  job,
  rank,
  columns,
  meta,
  selected,
  expanded,
  canEditEverything,
  onToggleSelect,
  onToggleExpand,
  onPatch,
  onMarkDead,
}: JobRowProps) {
  const { live, total } = liveLinkCount(job);
  const dead = total > 0 && live === 0;

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
      case 'status':
        return meta ? (
          <select
            className={`cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-border ${statusClass(job.status)}`}
            value={job.status}
            onChange={(e) => onPatch(job.job_id, { status: e.target.value })}
            aria-label={`Status for ${job.company ?? job.job_id}`}
          >
            {meta.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          job.status
        );
      case 'owner':
        return meta && canEditEverything ? (
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
        return meta && canEditEverything ? (
          <select
            className="cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-muted-foreground hover:border-border"
            value={job.action ?? ''}
            onChange={(e) => onPatch(job.job_id, { action: e.target.value })}
            aria-label={`Action for ${job.company ?? job.job_id}`}
          >
            <option value="">—</option>
            {meta.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">{job.action || '—'}</span>
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
      case 'links':
        return (
          <button
            type="button"
            onClick={() => onToggleExpand(job.job_id)}
            className={`whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] ${
              dead ? 'border-destructive/50 text-destructive' : 'border-border text-primary'
            }`}
            title={dead ? 'Every link to this role is dead' : 'Open the links for this role'}
          >
            {live}/{total} ↗
          </button>
        );
      case 'notes':
        return job.notes ? (
          <span className={`text-xs ${job.status === 'Flagged' ? 'text-destructive' : ''}`}>
            {job.status === 'Flagged' ? '⚑ ' : ''}
            {job.notes}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
          <td key={col.key} className={`${CELL} ${col.align === 'right' ? 'text-right' : ''}`}>
            {cell(col)}
          </td>
        ))}
      </tr>
      {expanded && (
        <tr data-testid="job-detail">
          <td colSpan={columns.length} className="border-b border-border bg-muted p-0">
            <JobWorkArea
              job={job}
              canEditEverything={canEditEverything}
              onPatch={onPatch}
              onMarkDead={onMarkDead}
            />
          </td>
        </tr>
      )}
    </>
  );
}
