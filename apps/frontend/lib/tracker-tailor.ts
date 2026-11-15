/**
 * The hand-off between a tracker job and the tailor page.
 *
 * The tracker opens `/tailor?trackerJob=<job_id>`. The tailor page loads that
 * job's saved description, and once a resume is confirmed it writes the new
 * resume's id back into the job's `resume_file`, which the tracker row then
 * turns into a "View resume" link.
 *
 * `resume_file` used to hold a filename typed in by hand, so only a value shaped
 * like a resume id counts as a link; anything else is shown as a plain note.
 */

import { fetchJob, patchJob } from '@/lib/api/tracker';

export const TRACKER_JOB_PARAM = 'trackerJob';

// Resume ids are UUIDs (see `resumes.resume_id`).
const RESUME_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TrackerJobForTailor {
  jobId: string;
  company: string | null;
  title: string | null;
  /** Null once the tracker has dropped the description (submitted, closed or skipped jobs). */
  jdText: string | null;
}

export function tailorHref(jobId: string): string {
  return `/tailor?${TRACKER_JOB_PARAM}=${encodeURIComponent(jobId)}`;
}

/** The resume id a tracker job links to, or null when it holds none (or a legacy filename). */
export function linkedResumeIdOf(resumeFile: string | null | undefined): string | null {
  const value = (resumeFile ?? '').trim();
  return RESUME_ID_PATTERN.test(value) ? value : null;
}

/** The tracker job id in the current URL, if the tailor page was opened from the tracker. */
export function trackerJobIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(TRACKER_JOB_PARAM)?.trim();
  return value ? value : null;
}

export async function loadTrackerJobForTailor(jobId: string): Promise<TrackerJobForTailor> {
  const job = await fetchJob(jobId);
  return {
    jobId: job.job_id,
    company: job.company,
    title: job.title,
    jdText: job.jd_text?.trim() ? job.jd_text : null,
  };
}

/** Record a confirmed resume on its tracker job; replaces any earlier link. */
export async function linkTailoredResume(jobId: string, resumeId: string): Promise<void> {
  await patchJob(jobId, { resume_file: resumeId });
}
