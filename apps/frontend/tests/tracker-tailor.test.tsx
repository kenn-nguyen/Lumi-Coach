/**
 * The tracker ↔ tailor hand-off: the row opens the tailor page for its job, the
 * tailor page reads the job's saved description, and a confirmed resume is
 * written back so the row can link to it.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJob = vi.fn();
const patchJob = vi.fn();

vi.mock('@/lib/api/tracker', () => ({
  fetchJob: (...args: unknown[]) => fetchJob(...args),
  patchJob: (...args: unknown[]) => patchJob(...args),
}));

import { JobWorkArea } from '@/components/tracker/job-work-area';
import {
  linkTailoredResume,
  linkedResumeIdOf,
  loadTrackerJobForTailor,
  tailorHref,
  trackerJobIdFromSearch,
} from '@/lib/tracker-tailor';

const RESUME_ID = '06b64d30-681d-4a15-98b9-0a615614a6f1';

const JOB = {
  job_id: '4479586945',
  company: 'Acme',
  title: 'Product Manager',
  merged_job_ids: ['4479586945'],
  dead_links: {},
  resume_file: null as string | null,
  referral_contact: null,
};

beforeEach(() => {
  fetchJob.mockReset().mockResolvedValue({ ...JOB, jd_text: 'The description' });
  patchJob.mockReset().mockResolvedValue({});
});

describe('hand-off rules', () => {
  it('builds the tailor URL for a job', () => {
    expect(tailorHref('4479586945')).toBe('/tailor?trackerJob=4479586945');
  });

  it('reads the job id back from the URL, and ignores pages opened without one', () => {
    expect(trackerJobIdFromSearch('?trackerJob=4479586945')).toBe('4479586945');
    expect(trackerJobIdFromSearch('')).toBeNull();
    expect(trackerJobIdFromSearch('?trackerJob=')).toBeNull();
  });

  it('treats only a resume id as a link, not a hand-typed filename', () => {
    expect(linkedResumeIdOf(RESUME_ID)).toBe(RESUME_ID);
    expect(linkedResumeIdOf('Acme-PM.pdf')).toBeNull();
    expect(linkedResumeIdOf('')).toBeNull();
    expect(linkedResumeIdOf(null)).toBeNull();
  });

  it('reports a dropped description as missing rather than as blank text', async () => {
    fetchJob.mockResolvedValue({ ...JOB, jd_text: '   ' });
    const job = await loadTrackerJobForTailor('4479586945');
    expect(job.jdText).toBeNull();
    expect(job.company).toBe('Acme');
  });

  it('writes the confirmed resume onto the job', async () => {
    await linkTailoredResume('4479586945', RESUME_ID);
    expect(patchJob).toHaveBeenCalledWith('4479586945', { resume_file: RESUME_ID });
  });
});

describe('tracker row resume section', () => {
  it('offers to tailor when no resume is linked', () => {
    render(<JobWorkArea job={JOB as never} onSetDead={() => {}} />);
    const link = screen.getByRole('link', { name: /tailor resume/i });
    expect(link).toHaveAttribute('href', '/tailor?trackerJob=4479586945');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: /view resume/i })).not.toBeInTheDocument();
  });

  it('links to the resume once one is recorded, and still allows tailoring again', () => {
    render(<JobWorkArea job={{ ...JOB, resume_file: RESUME_ID } as never} onSetDead={() => {}} />);
    expect(screen.getByRole('link', { name: /view resume/i })).toHaveAttribute(
      'href',
      `/resumes/${RESUME_ID}`
    );
    expect(screen.getByRole('link', { name: /tailor again/i })).toBeInTheDocument();
  });

  it('keeps a legacy filename visible without pretending it is a link', () => {
    render(
      <JobWorkArea job={{ ...JOB, resume_file: 'Acme-PM.pdf' } as never} onSetDead={() => {}} />
    );
    expect(screen.getByText(/Acme-PM\.pdf/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view resume/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /tailor resume/i })).toBeInTheDocument();
  });
});
