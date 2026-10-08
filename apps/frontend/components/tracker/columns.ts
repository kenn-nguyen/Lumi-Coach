/**
 * The queue's columns.
 *
 * Job_Priority and Assigned were two sheets holding the same rows with different
 * columns, so the view toggle switches the column set as well as the rows. Every
 * column the sheet had is available; the defaults just keep the table narrow
 * enough to read without scrolling sideways.
 */

import type { TrackerJob } from '@/lib/api/tracker';

export type ViewKey = 'assigned' | 'all';

export interface ColumnDef {
  key: string;
  label: string;
  /** Always rendered; not offered in the picker. */
  fixed?: boolean;
  /** Shown by default in each view. */
  all: boolean;
  assigned: boolean;
  sort?: 'fit' | 'posted';
  align?: 'right';
  /** Gets a minimum width: it is edited in place, so it needs room to type in. */
  wide?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'select', label: '', fixed: true, all: true, assigned: true },
  { key: 'rank', label: '#', all: true, assigned: true, align: 'right' },
  // Priority and score are one judgement at two precisions: the band you scan and
  // the number that separates a 75 from an 83 inside it. One cell, both values.
  { key: 'fit', label: 'Fit', all: true, assigned: true, sort: 'fit' },
  { key: 'us_visa', label: 'US visa', all: true, assigned: true },
  // Company runs to ~9 characters and title to ~37, so separate columns squeezed
  // the title into wrapping. Together they fit one line and the rows get shorter.
  { key: 'job', label: 'Job', all: true, assigned: true },
  { key: 'priority', label: 'Priority (alone)', all: false, assigned: false, sort: 'fit' },
  { key: 'score', label: 'Score (alone)', all: false, assigned: false, align: 'right' },
  { key: 'company', label: 'Company (alone)', all: false, assigned: false },
  { key: 'title', label: 'Title (alone)', all: false, assigned: false },
  { key: 'level', label: 'Level', all: false, assigned: false },
  { key: 'status', label: 'Status', all: true, assigned: true },
  { key: 'owner', label: 'Owner', all: true, assigned: false },
  { key: 'action', label: 'Action', all: true, assigned: false },
  { key: 'location', label: 'Location', all: false, assigned: true },
  { key: 'posted', label: 'Posted', all: true, assigned: true, sort: 'posted' },
  { key: 'applicants', label: 'Applicants', all: false, assigned: false, align: 'right' },
  { key: 'links', label: 'Job links', all: true, assigned: true },
  { key: 'notes', label: 'Notes', all: true, assigned: true, wide: true },
  { key: 'applied_at', label: 'Submitted on', all: false, assigned: true },
  { key: 'expand', label: '', fixed: true, all: true, assigned: true },
];

const STORAGE_KEY = 'tracker.columns.v1';

export type ColumnOverrides = Record<ViewKey, Record<string, boolean>>;

export const EMPTY_OVERRIDES: ColumnOverrides = { assigned: {}, all: {} };

export function loadOverrides(): ColumnOverrides {
  if (typeof window === 'undefined') return EMPTY_OVERRIDES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_OVERRIDES;
    const parsed = JSON.parse(raw);
    if (parsed?.assigned && parsed?.all) return parsed as ColumnOverrides;
  } catch {
    /* private window or blocked storage: the defaults are fine */
  }
  return EMPTY_OVERRIDES;
}

export function saveOverrides(overrides: ColumnOverrides): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* losing a column preference is not worth surfacing */
  }
}

export function isColumnOn(col: ColumnDef, view: ViewKey, overrides: ColumnOverrides): boolean {
  if (col.fixed) return true;
  const override = overrides[view]?.[col.key];
  return override === undefined ? col[view] : override;
}

export function visibleColumns(view: ViewKey, overrides: ColumnOverrides): ColumnDef[] {
  return COLUMNS.filter((c) => isColumnOn(c, view, overrides));
}

/** P01 is the rare bullseye; P10 is noise. The styling follows that gradient. */
export function priorityClass(priority: string | null): string {
  const n = Number((priority ?? '').replace(/\D/g, ''));
  if (!n) return 'text-muted-foreground';
  if (n <= 1) return 'bg-success text-white border-success';
  if (n <= 2) return 'text-success border-success';
  if (n <= 3) return 'bg-secondary border-border';
  if (n <= 5) return 'text-muted-foreground border-border';
  return 'text-muted-foreground border-transparent';
}

export function visaClass(visa: string | null): string {
  const value = visa ?? '';
  if (/^(Yes|Likely)/.test(value)) return 'text-success font-semibold';
  if (/^(No|Unlikely)/.test(value)) return 'text-destructive';
  return 'text-warning';
}

export function statusClass(status: string): string {
  switch (status) {
    case 'New':
      return 'text-primary';
    case 'Networking':
    case 'Filled':
      return 'text-warning';
    case 'Submitted':
      return 'text-success';
    case 'Flagged':
      return 'text-destructive font-semibold';
    default:
      return 'text-muted-foreground';
  }
}

/** Dates are shown as dates: a posting is compared against a calendar, not a stopwatch. */
export function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function liveLinkCount(job: TrackerJob): { live: number; total: number } {
  const ids = job.merged_job_ids?.length ? job.merged_job_ids : [job.job_id];
  const dead = job.dead_links ?? {};
  return { live: ids.filter((id) => !dead[id]).length, total: ids.length };
}
