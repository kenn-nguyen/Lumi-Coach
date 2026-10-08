'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

import type { TrackerJob } from '@/lib/api/tracker';

export function jobLinkIds(job: TrackerJob): string[] {
  return job.merged_job_ids?.length ? job.merged_job_ids : [job.job_id];
}

export function linkUrl(linkId: string): string {
  return `https://www.linkedin.com/jobs/view/${linkId}`;
}

interface LinkMenuProps {
  job: TrackerJob;
  /** Where to put the menu: the button the user clicked. */
  anchor: DOMRect;
  onSetDead: (jobId: string, linkId: string, dead: boolean) => void;
  onClose: () => void;
}

/**
 * The postings for one role, listed where the user clicked.
 *
 * A role is often posted several times and the old ones expire, so picking a link
 * is a real decision rather than a formality. Showing them here keeps that
 * decision out of the expanded row, which would otherwise have to load the job's
 * description — tens of kilobytes nobody asked for just to follow a link.
 *
 * Rendered through a portal so the table's horizontal scrolling cannot clip it.
 */
export function LinkMenu({ job, anchor, onSetDead, onClose }: LinkMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const ids = jobLinkIds(job);
  const dead = job.dead_links ?? {};
  const allDead = ids.every((id) => dead[id]);

  React.useEffect(() => {
    function onDocument(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    // Deferred so the click that opened the menu does not immediately close it.
    const timer = setTimeout(() => document.addEventListener('mousedown', onDocument), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDocument);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  // Keep the menu on screen when the row is near the right edge or the bottom.
  const width = 320;
  const left = Math.min(anchor.left, window.innerWidth - width - 12);
  const estimatedHeight = 60 + ids.length * 34 + (allDead ? 34 : 0);
  const openUpwards = anchor.bottom + estimatedHeight > window.innerHeight;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Job links for ${job.company ?? job.job_id}`}
      style={{
        position: 'fixed',
        left,
        top: openUpwards ? undefined : anchor.bottom + 4,
        bottom: openUpwards ? window.innerHeight - anchor.top + 4 : undefined,
        width,
        zIndex: 60,
      }}
      className="rounded-lg border border-border bg-card p-2 shadow-sw-card"
    >
      <p className="px-2 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {ids.length} postings · try until one loads
      </p>
      <ul className="grid gap-0.5">
        {ids.map((id, index) => {
          const isDead = Boolean(dead[id]);
          return (
            <li key={id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted">
              <a
                href={linkUrl(id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={`flex-1 truncate font-mono text-xs ${
                  isDead ? 'text-muted-foreground line-through' : 'text-primary hover:underline'
                }`}
                title={linkUrl(id)}
              >
                {id}
                {index === 0 && ids.length > 1 && (
                  <span className="ml-2 font-sans text-[10px] not-italic text-muted-foreground">
                    newest
                  </span>
                )}
              </a>
              {isDead ? (
                <button
                  type="button"
                  onClick={() => onSetDead(job.job_id, id, false)}
                  className="rounded border border-border px-1.5 py-px text-[10px] text-muted-foreground hover:border-success hover:text-success"
                  title="Put this posting back — it loads after all"
                >
                  still works?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSetDead(job.job_id, id, true)}
                  className="rounded border border-border px-1.5 py-px text-[10px] text-muted-foreground hover:border-destructive hover:text-destructive"
                  title="Mark this posting as expired so nobody retries it"
                >
                  dead?
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {allDead && (
        <p className="mt-1 border-t border-dashed border-border px-2 pt-2 text-[11.5px] text-muted-foreground">
          <strong className="text-foreground">Every posting is dead.</strong> Build the resume from
          the saved description instead.
        </p>
      )}
    </div>,
    document.body
  );
}
