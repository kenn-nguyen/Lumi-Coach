'use client';

import * as React from 'react';

import { TailorDialog } from '@/components/tailor/TailorDialog';
import { fetchJob, type TrackerJob, type TrackerJobDetail } from '@/lib/api/tracker';
import { LanguageProvider } from '@/lib/context/language-context';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import {
  fetchMasterResumeId,
  linkIdsOf,
  linkedResumeIdOf,
  tailorPrefillFor,
} from '@/lib/tracker-tailor';

interface JobWorkAreaProps {
  job: TrackerJob;
  onSetDead: (jobId: string, linkId: string, dead: boolean) => void;
}

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground';

/**
 * What a job looks like when you open it: why it scored, where to apply, and
 * whether the resume exists.
 *
 * Everything that *changes* the job — status and notes — stays on the row, which
 * is where the work is actually done. This panel held a second copy of both, and
 * a second copy of a field is not a convenience: the two note editors were on
 * screen together, each holding its own draft of one value, and whichever lost
 * focus last silently overwrote the other.
 */
export function JobWorkArea({ job, onSetDead }: JobWorkAreaProps) {
  const [detail, setDetail] = React.useState<TrackerJobDetail | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Tailoring. The backend links the finished resume to this job; the id is also
  // kept here so a run that finishes with the dialog open shows without a reload.
  const [masterResumeId, setMasterResumeId] = React.useState<string | null>(null);
  const [tailorOpen, setTailorOpen] = React.useState(false);
  const [tailorError, setTailorError] = React.useState<string | null>(null);
  const [justLinkedId, setJustLinkedId] = React.useState<string | null>(null);
  const linkedResumeId = justLinkedId ?? linkedResumeIdOf(job.resume_file);

  const openTailor = async () => {
    setTailorError(null);
    try {
      const id = masterResumeId ?? (await fetchMasterResumeId());
      if (!id) {
        setTailorError('Upload a master resume on the dashboard first.');
        return;
      }
      setMasterResumeId(id);
      setTailorOpen(true);
    } catch {
      setTailorError('Could not load your master resume. Try again.');
    }
  };

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

  const tailorPrefill = React.useMemo(
    () => tailorPrefillFor(job, detail?.jd_text ?? null, detail?.jd_truncated ?? false),
    [job, detail]
  );

  const linkIds = linkIdsOf(job);
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
                    <button
                      type="button"
                      onClick={() => onSetDead(job.job_id, id, false)}
                      className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-success hover:text-success"
                    >
                      still works?
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetDead(job.job_id, id, true)}
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
          {/* The resume opens in a new tab so the tracker keeps its filters and scroll position. */}
          {linkedResumeId ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <a
                href={`/resumes/${linkedResumeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-success hover:underline"
              >
                ✓ View resume →
              </a>
              <button
                type="button"
                onClick={openTailor}
                disabled={!loaded}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
              >
                Tailor again
              </button>
            </div>
          ) : (
            <div className="mt-2">
              {job.resume_file && (
                // A filename recorded by hand before resumes were linked.
                <p className="mb-2 text-sm text-muted-foreground">Noted: {job.resume_file}</p>
              )}
              <button
                type="button"
                onClick={openTailor}
                disabled={!loaded}
                className="inline-flex rounded border border-primary px-3 py-1 text-sm font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-50"
              >
                Tailor resume →
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Uses the saved description, or the newest working link if it was dropped or cut
                short.
              </p>
            </div>
          )}
          {tailorError && <p className="mt-2 text-xs text-destructive">{tailorError}</p>}
          {masterResumeId && tailorOpen && (
            // The tracker page sits outside the app shell, because the shell renders
            // nothing when signed out and the tracker can run signed out with the dev
            // bypass. So the dialog brings the two contexts it reads (system status,
            // and the language for its labels) rather than the page taking the shell.
            <StatusCacheProvider>
              <LanguageProvider>
                <TailorDialog
                  resumeId={masterResumeId}
                  isOpen={tailorOpen}
                  onClose={() => setTailorOpen(false)}
                  prefill={tailorPrefill}
                  onCompleted={setJustLinkedId}
                />
              </LanguageProvider>
            </StatusCacheProvider>
          )}
          {job.referral_contact && (
            <p className="mt-2 text-xs text-warning">Referral: {job.referral_contact}</p>
          )}
        </section>
      </div>

      <div className="col-span-full border-t border-border pt-2 font-mono text-[10.5px] text-muted-foreground">
        job_id {job.job_id} ·{' '}
        {linkIds.length > 1 ? `${linkIds.length} merged postings` : 'single posting'}
        {detail?.scored_at ? ` · scored ${new Date(detail.scored_at).toLocaleDateString()}` : ''}
      </div>
    </div>
  );
}
