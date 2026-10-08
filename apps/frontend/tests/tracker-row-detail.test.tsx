/**
 * A row's detail must not be fetched until the row is opened.
 *
 * The list view carries ~25 rows and the detail query reads the stored job
 * description, which runs to tens of kilobytes. Fetching one per row would make
 * every page turn 25 extra queries for text nobody has asked to see.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJob = vi.fn();

vi.mock('@/lib/api/tracker', () => ({
  fetchJob: (...args: unknown[]) => {
    fetchJob(...args);
    return Promise.resolve({
      job_id: '1',
      summary: 'A summary',
      why: 'Because',
      us_visa_reason: 'Sponsors',
      jd_text: 'The description',
      merged_job_ids: ['1'],
      dead_links: {},
    });
  },
}));

import { JobRow } from '@/components/tracker/job-row';

const JOB = {
  job_id: '1',
  priority: 'P01',
  score: 96,
  us_visa: 'Yes (100%)',
  company: 'Acme',
  title: 'Product Manager, Fraud',
  title_level: 'Senior-PM',
  jd_implied_level: 'Senior-PM',
  status: 'New',
  owner: '',
  action: '',
  location: 'New York, NY',
  posted: '2026-10-01T00:00:00Z',
  applicants: '25',
  notes: null,
  applied_at: null,
  merged_job_ids: ['1'],
  dead_links: {},
  resume_file: null,
  referral_contact: null,
  sort_key: '03000000000000000000',
  in_assigned_queue: false,
};

const COLUMNS = [
  { key: 'job', label: 'Job', all: true, assigned: true },
  { key: 'expand', label: '', fixed: true, all: true, assigned: true },
];

function renderRow(expanded: boolean) {
  return render(
    <table>
      <tbody>
        <JobRow
          job={JOB as never}
          rank={1}
          columns={COLUMNS as never}
          meta={null}
          selected={false}
          expanded={expanded}
          canEditEverything
          onToggleSelect={() => {}}
          onToggleExpand={() => {}}
          onPatch={() => {}}
          onMarkDead={() => {}}
          onToast={() => {}}
        />
      </tbody>
    </table>
  );
}

describe('row detail loading', () => {
  beforeEach(() => fetchJob.mockClear());

  it('does not touch the database for a row nobody opened', () => {
    renderRow(false);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(fetchJob).not.toHaveBeenCalled();
  });

  it('fetches once the row is opened, and only for that job', () => {
    renderRow(true);
    expect(fetchJob).toHaveBeenCalledTimes(1);
    expect(fetchJob).toHaveBeenCalledWith('1');
  });

  it('a page of rows costs no detail queries at all', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ ...JOB, job_id: String(i) }));
    render(
      <table>
        <tbody>
          {rows.map((job) => (
            <JobRow
              key={job.job_id}
              job={job as never}
              rank={1}
              columns={COLUMNS as never}
              meta={null}
              selected={false}
              expanded={false}
              canEditEverything
              onToggleSelect={() => {}}
              onToggleExpand={() => {}}
              onPatch={() => {}}
              onMarkDead={() => {}}
              onToast={() => {}}
            />
          ))}
        </tbody>
      </table>
    );
    expect(fetchJob).not.toHaveBeenCalled();
  });
});
