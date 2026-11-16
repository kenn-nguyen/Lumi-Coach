/**
 * The hand-off between a tracker job and the tailor dialog.
 *
 * "Tailor resume" on a tracker job opens the same dialog as the dashboard, filled
 * in for that job and carrying its id. The backend records the finished resume's
 * id in the job's `resume_file` when the run completes — even if the dialog or the
 * tab was closed meanwhile — and the tracker row turns it into a "View resume" link.
 *
 * `resume_file` used to hold a filename typed in by hand, so only a value shaped
 * like a resume id counts as a link; anything else is shown as a plain note.
 */

import { fetchResumeList } from '@/lib/api/resume';
import type { TrackerJob } from '@/lib/api/tracker';
import type { TailorJobPrefill } from '@/components/tailor/TailorDialog';

// Resume ids are UUIDs (see `resumes.resume_id`).
const RESUME_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The resume id a tracker job links to, or null when it holds none (or a legacy filename). */
export function linkedResumeIdOf(resumeFile: string | null | undefined): string | null {
  const value = (resumeFile ?? '').trim();
  return RESUME_ID_PATTERN.test(value) ? value : null;
}

/** LinkedIn ids for a job, newest first: merged re-postings, or the job's own id. */
export function linkIdsOf(job: TrackerJob): string[] {
  return job.merged_job_ids?.length ? job.merged_job_ids : [job.job_id];
}

/**
 * What the tailor dialog starts with for a tracker job.
 *
 * The dialog takes a link *or* pasted text, and the saved text is preferred: it
 * needs no LinkedIn fetch. The newest link not marked dead is used instead, and the
 * pipeline fetches the full posting from Apify, when the saved text is unusable:
 * dropped (submitted, closed or skipped jobs) or cut short at the tracker's storage
 * cap. A cut description is still used when no link works, as the best available.
 */
export function tailorPrefillFor(
  job: TrackerJob,
  jdText: string | null,
  jdTruncated = false
): TailorJobPrefill {
  const text = jdText?.trim() ? jdText : null;
  const liveId = linkIdsOf(job).find((id) => !job.dead_links?.[id]);
  const useLink = Boolean(liveId) && (!text || jdTruncated);
  return {
    trackerJobId: job.job_id,
    label: [job.company, job.title].filter(Boolean).join(' · '),
    jdText: useLink ? null : text,
    jdUrl: useLink ? `https://www.linkedin.com/jobs/view/${liveId}` : null,
  };
}

/** The signed-in user's master resume id, or null if they have not uploaded one. */
export async function fetchMasterResumeId(): Promise<string | null> {
  // The list keeps the master even at the smallest page size.
  const { data } = await fetchResumeList(true, 1);
  return data.find((resume) => resume.is_master)?.resume_id ?? null;
}
