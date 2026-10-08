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
  { key: 'status', label: 'Status', all: true, assigned: true },
  { key: 'links', label: 'Job links', all: true, assigned: true },
  { key: 'expand', label: '', fixed: true, all: true, assigned: true },
];

function renderRow(
  expanded: boolean,
  overrides: Partial<typeof JOB> = {},
  extra: { statusOptions?: string[] } = {}
) {
  return render(
    <table>
      <tbody>
        <JobRow
          job={{ ...JOB, ...overrides } as never}
          rank={1}
          columns={COLUMNS as never}
          meta={extra.statusOptions ? ({ actions: [] } as never) : null}
          selected={false}
          expanded={expanded}
          canEditEverything
          onToggleSelect={() => {}}
          onToggleExpand={() => {}}
          onPatch={() => {}}
          onSetDead={() => {}}
          statusOptions={extra.statusOptions ?? []}
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
              onSetDead={() => {}}
              statusOptions={[]}
              onToast={() => {}}
            />
          ))}
        </tbody>
      </table>
    );
    expect(fetchJob).not.toHaveBeenCalled();
  });
});

describe('job links', () => {
  beforeEach(() => fetchJob.mockClear());

  it('opens a single posting directly, with no menu and no detail query', () => {
    renderRow(false, { merged_job_ids: ['4071200001'] });
    const link = screen.getByRole('link', { name: /1\/1/ });
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/jobs/view/4071200001');
    expect(link).toHaveAttribute('target', '_blank');
    expect(fetchJob).not.toHaveBeenCalled();
  });

  it('offers a choice when a role was posted more than once', () => {
    renderRow(false, { merged_job_ids: ['4071200001', '4071200002', '4071200003'] });
    fireEvent.click(screen.getByRole('button', { name: /3\/3/ }));

    expect(screen.getByText(/3 postings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /4071200001/ })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/jobs/view/4071200001'
    );
    expect(screen.getByText(/newest/i)).toBeInTheDocument();
  });

  it('choosing a link never loads the row detail', () => {
    renderRow(false, { merged_job_ids: ['4071200001', '4071200002'] });
    fireEvent.click(screen.getByRole('button', { name: /2\/2/ }));
    expect(fetchJob).not.toHaveBeenCalled();
  });

  it('says so when every posting has expired', () => {
    renderRow(false, {
      merged_job_ids: ['1', '2'],
      dead_links: { '1': true, '2': true },
    });
    fireEvent.click(screen.getByRole('button', { name: /0\/2/ }));
    expect(screen.getByText(/every posting is dead/i)).toBeInTheDocument();
  });
});

describe('statuses offered in a row', () => {
  const ASSIGNEE = ['New', 'Filled', 'Submitted', 'Flagged'];

  function statusValues() {
    const select = screen.getByRole('combobox', { name: /status/i });
    return Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
  }

  it('offers the assignee only the statuses they act on', () => {
    renderRow(false, { status: 'New' }, { statusOptions: ASSIGNEE });
    expect(statusValues()).toEqual(ASSIGNEE);
    expect(statusValues()).not.toContain('Skip (auto)');
  });

  it('keeps a row in some other state selectable', () => {
    renderRow(false, { status: 'Networking' }, { statusOptions: ASSIGNEE });
    expect(statusValues()).toContain('Networking');
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveValue('Networking');
  });
});

describe('status actions in an opened row', () => {
  const patch = vi.fn();

  function openRow(overrides: Partial<typeof JOB> = {}) {
    patch.mockClear();
    render(
      <table>
        <tbody>
          <JobRow
            job={{ ...JOB, ...overrides } as never}
            rank={1}
            columns={COLUMNS as never}
            meta={null}
            selected={false}
            expanded
            canEditEverything
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onPatch={patch}
            onSetDead={() => {}}
            statusOptions={['New', 'Filled', 'Submitted', 'Flagged']}
            onToast={() => {}}
          />
        </tbody>
      </table>
    );
  }

  it('offers the submit action, and carries the way back with it', () => {
    openRow({ status: 'New' });
    fireEvent.click(screen.getByRole('button', { name: /i submitted it/i }));

    expect(patch).toHaveBeenCalledTimes(1);
    const [jobId, changes, said] = patch.mock.calls[0];
    expect(jobId).toBe('1');
    expect(changes).toEqual({ status: 'Submitted' });
    // Without the previous status travelling with the confirmation there is
    // nothing to undo to: the row re-sorts off the page the moment it saves.
    expect(said.revert).toEqual({ status: 'New' });
  });

  it('asks a Fill Only job to be marked filled, not submitted', () => {
    openRow({ status: 'New', action: 'Fill Only' });
    expect(screen.getByRole('button', { name: /ready to send/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /i submitted it/i })).toBeNull();
  });

  it('reverts an already-submitted job to where it came from', () => {
    openRow({ status: 'Submitted' });
    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
    expect(patch.mock.calls[0][1]).toEqual({ status: 'New' });
  });

  it('refuses to flag without a reason rather than sending an empty complaint', () => {
    openRow({ status: 'New' });
    fireEvent.click(screen.getByRole('button', { name: /stuck/i }));
    expect(patch).not.toHaveBeenCalled();
  });
});

describe('changing status from the row', () => {
  const patch = vi.fn();

  function renderWithPatch(overrides: Partial<typeof JOB> = {}) {
    patch.mockClear();
    render(
      <table>
        <tbody>
          <JobRow
            job={{ ...JOB, ...overrides } as never}
            rank={1}
            columns={COLUMNS as never}
            meta={{ actions: [] } as never}
            selected={false}
            expanded={false}
            canEditEverything
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onPatch={patch}
            onSetDead={() => {}}
            statusOptions={['New', 'Filled', 'Submitted', 'Flagged']}
            onToast={() => {}}
          />
        </tbody>
      </table>
    );
  }

  it('carries the way back, because this is where status actually gets changed', () => {
    renderWithPatch({ status: 'New' });
    fireEvent.change(screen.getByRole('combobox', { name: /status/i }), {
      target: { value: 'Submitted' },
    });

    const [jobId, changes, said] = patch.mock.calls[0];
    expect(jobId).toBe('1');
    expect(changes).toEqual({ status: 'Submitted' });
    expect(said?.revert).toEqual({ status: 'New' });
  });

  it('still refuses to flag from the row without a reason', () => {
    renderWithPatch({ status: 'New', notes: null });
    fireEvent.change(screen.getByRole('combobox', { name: /status/i }), {
      target: { value: 'Flagged' },
    });
    expect(patch).not.toHaveBeenCalled();
  });
});

describe('the one-click status button on the row', () => {
  const patch = vi.fn();

  function renderRowWith(overrides: Partial<typeof JOB> = {}) {
    patch.mockClear();
    render(
      <table>
        <tbody>
          <JobRow
            job={{ ...JOB, ...overrides } as never}
            rank={1}
            columns={COLUMNS as never}
            meta={{ actions: [] } as never}
            selected={false}
            expanded={false}
            canEditEverything
            onToggleSelect={() => {}}
            onToggleExpand={() => {}}
            onPatch={patch}
            onSetDead={() => {}}
            statusOptions={['New', 'Filled', 'Submitted', 'Flagged']}
            onToast={() => {}}
          />
        </tbody>
      </table>
    );
  }

  it('marks a job submitted in one click, with the way back', () => {
    renderRowWith({ status: 'New' });
    fireEvent.click(screen.getByRole('button', { name: /✓ Submitted/ }));

    const [jobId, changes, said] = patch.mock.calls[0];
    expect(jobId).toBe('1');
    expect(changes).toEqual({ status: 'Submitted' });
    expect(said?.revert).toEqual({ status: 'New' });
  });

  it('offers Filled, not Submitted, on work that is reviewed before it is sent', () => {
    renderRowWith({ status: 'New', action: 'Fill Only' });
    expect(screen.getByRole('button', { name: /✓ Filled/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /✓ Submitted/ })).toBeNull();
  });

  it('disappears once the job is already there', () => {
    renderRowWith({ status: 'Submitted' });
    expect(screen.queryByRole('button', { name: /✓ Submitted/ })).toBeNull();
  });

  it('stays out of the way on rows nobody is working', () => {
    for (const status of ['Skip', 'Skip (auto)', 'Closed']) {
      renderRowWith({ status });
      expect(screen.queryByRole('button', { name: /✓/ })).toBeNull();
    }
  });
});
