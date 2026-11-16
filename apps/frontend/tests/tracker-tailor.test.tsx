/**
 * The tracker ↔ tailor hand-off: a tracker row opens the tailor dialog filled in
 * for its job, and once the backend has linked the finished resume the row links
 * to it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJob = vi.fn();
const fetchResumeList = vi.fn();
const dialogProps = vi.fn();

vi.mock('@/lib/api/tracker', () => ({
  fetchJob: (...args: unknown[]) => fetchJob(...args),
}));
vi.mock('@/lib/api/resume', () => ({
  fetchResumeList: (...args: unknown[]) => fetchResumeList(...args),
}));
// The real dialog and the providers it is wrapped in need a signed-in session;
// what matters here is what the dialog is given.
vi.mock('@/components/tailor/TailorDialog', () => ({
  TailorDialog: (props: Record<string, unknown>) => {
    dialogProps(props);
    return <div role="dialog">tailor dialog</div>;
  },
}));
vi.mock('@/lib/context/status-cache', () => ({
  StatusCacheProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/context/language-context', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { JobWorkArea } from '@/components/tracker/job-work-area';
import { fetchMasterResumeId, linkedResumeIdOf, tailorPrefillFor } from '@/lib/tracker-tailor';

const RESUME_ID = '06b64d30-681d-4a15-98b9-0a615614a6f1';
const MASTER_ID = '44cd045c-1de9-4c31-a5cd-078924777969';

const JOB = {
  job_id: '4479586945',
  company: 'Acme',
  title: 'Product Manager',
  merged_job_ids: ['4479586945', '4470000001'],
  dead_links: {} as Record<string, boolean>,
  resume_file: null as string | null,
  referral_contact: null,
};

beforeEach(() => {
  fetchJob.mockReset().mockResolvedValue({ ...JOB, jd_text: 'The description' });
  fetchResumeList.mockReset().mockResolvedValue({
    data: [{ resume_id: MASTER_ID, is_master: true }],
    total: 1,
  });
  dialogProps.mockReset();
});

describe('hand-off rules', () => {
  it('treats only a resume id as a link, not a hand-typed filename', () => {
    expect(linkedResumeIdOf(RESUME_ID)).toBe(RESUME_ID);
    expect(linkedResumeIdOf('Acme-PM.pdf')).toBeNull();
    expect(linkedResumeIdOf('')).toBeNull();
    expect(linkedResumeIdOf(null)).toBeNull();
  });

  it('fills the dialog with the saved description, and no link', () => {
    expect(tailorPrefillFor(JOB as never, 'The description')).toEqual({
      trackerJobId: '4479586945',
      label: 'Acme · Product Manager',
      jdText: 'The description',
      jdUrl: null,
    });
  });

  it('falls back to the newest link that still loads once the description is dropped', () => {
    const job = { ...JOB, dead_links: { '4479586945': true } };
    const prefill = tailorPrefillFor(job as never, '   ');
    expect(prefill.jdText).toBeNull();
    expect(prefill.jdUrl).toBe('https://www.linkedin.com/jobs/view/4470000001');
  });

  it('fetches the full posting when the saved description was cut short', () => {
    const prefill = tailorPrefillFor(JOB as never, 'Long posting, cut at the cap...', true);
    expect(prefill.jdText).toBeNull();
    expect(prefill.jdUrl).toBe('https://www.linkedin.com/jobs/view/4479586945');
  });

  it('keeps a cut description when no link works, as the best available', () => {
    const job = { ...JOB, dead_links: { '4479586945': true, '4470000001': true } };
    const prefill = tailorPrefillFor(job as never, 'Long posting, cut at the cap...', true);
    expect(prefill.jdText).toBe('Long posting, cut at the cap...');
    expect(prefill.jdUrl).toBeNull();
  });

  it('leaves both empty when there is no description and every link is dead', () => {
    const job = { ...JOB, dead_links: { '4479586945': true, '4470000001': true } };
    const prefill = tailorPrefillFor(job as never, null);
    expect(prefill.jdText).toBeNull();
    expect(prefill.jdUrl).toBeNull();
  });

  it('finds the master resume, or reports that there is none', async () => {
    expect(await fetchMasterResumeId()).toBe(MASTER_ID);
    fetchResumeList.mockResolvedValue({ data: [{ resume_id: RESUME_ID, is_master: false }] });
    expect(await fetchMasterResumeId()).toBeNull();
  });
});

describe('tracker row resume section', () => {
  it('opens the tailor dialog for this job on the master resume', async () => {
    render(<JobWorkArea job={JOB as never} onSetDead={() => {}} />);
    const button = await screen.findByRole('button', { name: /tailor resume/i });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const props = dialogProps.mock.calls.at(-1)?.[0];
    expect(props.resumeId).toBe(MASTER_ID);
    expect(props.prefill).toMatchObject({ trackerJobId: '4479586945', jdText: 'The description' });
  });

  it('says what to do when there is no master resume yet', async () => {
    fetchResumeList.mockResolvedValue({ data: [] });
    render(<JobWorkArea job={JOB as never} onSetDead={() => {}} />);
    const button = await screen.findByRole('button', { name: /tailor resume/i });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    expect(await screen.findByText(/upload a master resume/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links to the resume once one is recorded, and still allows tailoring again', () => {
    render(<JobWorkArea job={{ ...JOB, resume_file: RESUME_ID } as never} onSetDead={() => {}} />);
    expect(screen.getByRole('link', { name: /view resume/i })).toHaveAttribute(
      'href',
      `/resumes/${RESUME_ID}`
    );
    expect(screen.getByRole('button', { name: /tailor again/i })).toBeInTheDocument();
  });

  it('keeps a legacy filename visible without pretending it is a link', () => {
    render(
      <JobWorkArea job={{ ...JOB, resume_file: 'Acme-PM.pdf' } as never} onSetDead={() => {}} />
    );
    expect(screen.getByText(/Acme-PM\.pdf/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view resume/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tailor resume/i })).toBeInTheDocument();
  });
});
