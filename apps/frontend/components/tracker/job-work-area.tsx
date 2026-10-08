'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { fetchJob, type TrackerJob, type TrackerJobDetail } from '@/lib/api/tracker';

interface JobWorkAreaProps {
  job: TrackerJob;
  canEditEverything: boolean;
  onPatch: (jobId: string, changes: Partial<TrackerJob>) => void;
  onMarkDead: (jobId: string, linkId: string) => void;
}

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground';

/**
 * Everything needed to actually work a job, in the row itself.
 *
 * The owner reads the top half (why the AI scored it this way); the assignee works
 * the bottom half (which link loads, is the resume built, what to tell the owner).
 * They are the same row because they are the same job — the sheet never separated
 * them either.
 */
export function JobWorkArea({ job, canEditEverything, onPatch, onMarkDead }: JobWorkAreaProps) {
  const [detail, setDetail] = React.useState<TrackerJobDetail | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [note, setNote] = React.useState(job.notes ?? '');
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // The description is only fetched when a row is opened, which is what keeps the
  // list query small.
  React.useEffect(() => {
    let cancelled = false;
    fetchJob(job.job_id)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setLoaded(true);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setLoadError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job.job_id]);

  React.useEffect(() => setNote(job.notes ?? ''), [job.notes]);

  const linkIds = job.merged_job_ids?.length ? job.merged_job_ids : [job.job_id];
  const deadLinks = job.dead_links ?? {};
  const allDead = linkIds.every((id) => deadLinks[id]);

  return (
    <div className="grid gap-5 p-4 pl-10 md:grid-cols-2 lg:grid-cols-4">
      <section>
        <h4 className={LABEL}>Summary</h4>
        <p className="mt-1 max-w-[60ch] text-sm">
          {detail?.summary || (loaded ? '—' : 'Loading…')}
        </p>
      </section>
      <section>
        <h4 className={LABEL}>Why</h4>
        <p className="mt-1 max-w-[60ch] text-sm">{loaded ? detail?.why || '—' : 'Loading…'}</p>
      </section>
      <section>
        <h4 className={LABEL}>US visa reason</h4>
        <p className="mt-1 max-w-[60ch] text-sm">
          {loaded ? detail?.us_visa_reason || '—' : 'Loading…'}
        </p>
      </section>
      <section>
        <h4 className={LABEL}>Job description</h4>
        <div className="mt-1 max-h-24 overflow-hidden border-l-2 border-border pl-2.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
          {!loaded
            ? 'Loading…'
            : loadError
              ? `Could not load: ${loadError}`
              : detail?.jd_text
                ? detail.jd_text.slice(0, 600)
                : 'No description stored. It is dropped once a job is submitted, closed or skipped — nothing re-reads it after that.'}
        </div>
      </section>

      <div className="col-span-full grid gap-5 border-t border-border pt-4 md:grid-cols-3">
        <section>
          <h4 className={LABEL}>Job links — try until one loads</h4>
          <ol className="mt-2 grid gap-1.5">
            {linkIds.map((id, index) => {
              const isDead = Boolean(deadLinks[id]);
              return (
                <li key={id} className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://www.linkedin.com/jobs/view/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded border border-border px-2 py-0.5 text-xs hover:border-primary hover:text-primary ${
                      isDead ? 'line-through opacity-50' : ''
                    }`}
                  >
                    Open ↗
                  </a>
                  <span
                    className={`font-mono text-xs text-muted-foreground ${isDead ? 'line-through opacity-50' : ''}`}
                  >
                    {id}
                  </span>
                  {index === 0 && <span className="text-[11px] text-muted-foreground">newest</span>}
                  {isDead ? (
                    <span className="text-[11px] text-destructive">dead</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMarkDead(job.job_id, id)}
                      className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive"
                    >
                      doesn&apos;t load
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {allDead && (
            <p className="mt-2 border-t border-dashed border-border pt-2 text-xs">
              <strong>Every link is dead.</strong> Build the resume from the saved description
              instead.
            </p>
          )}
        </section>

        <section>
          <h4 className={LABEL}>Tailored resume</h4>
          {job.resume_file ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-success">✓ {job.resume_file}</span>
              <button
                type="button"
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-border"
                onClick={() => onPatch(job.job_id, { resume_file: '' })}
              >
                Build again
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <span className="text-sm text-muted-foreground">Not built yet</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() =>
                  onPatch(job.job_id, {
                    resume_file: `${(job.company ?? 'role').replace(/\W+/g, '')}-PM.pdf`,
                  })
                }
              >
                Built with the extension
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Open a working link, then run the Lumi extension on that page.
              </p>
            </div>
          )}
          {job.referral_contact && (
            <p className="mt-2 text-xs text-warning">Referral: {job.referral_contact}</p>
          )}
        </section>

        <section>
          <h4 className={LABEL}>Notes</h4>
          <textarea
            className="mt-2 w-full rounded border border-border bg-card p-2 text-sm"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== (job.notes ?? '')) onPatch(job.job_id, { notes: note });
            }}
            placeholder="e.g. used the fintech resume · wants a cover letter · applied on their own site"
            aria-label="Notes for this job"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Set the status to <strong>Flagged</strong> to send it back with this note.
          </p>
        </section>
      </div>

      <div className="col-span-full border-t border-border pt-2 font-mono text-[10.5px] text-muted-foreground">
        job_id {job.job_id} ·{' '}
        {linkIds.length > 1 ? `${linkIds.length} merged postings` : 'single posting'}
        {detail?.scored_at ? ` · scored ${new Date(detail.scored_at).toLocaleDateString()}` : ''}
        {canEditEverything ? '' : ' · you can change status, notes and the resume'}
      </div>
    </div>
  );
}
