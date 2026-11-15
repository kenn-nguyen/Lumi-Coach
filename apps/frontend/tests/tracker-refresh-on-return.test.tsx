/**
 * Returning to the tracker tab re-reads the current page.
 *
 * A row's "Tailor resume" link opens in a new tab, and the resume is linked to
 * the job there. Without a re-read, the tracker tab the user comes back to still
 * offers "Tailor resume" for a job that already has one.
 */

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchJobs = vi.fn();

vi.mock('@/lib/api/tracker', () => ({
  fetchJobs: (...args: unknown[]) => fetchJobs(...args),
  fetchMeta: () => new Promise(() => {}),
  fetchRuns: () => Promise.resolve({ runs: [] }),
  bulkJobs: vi.fn(),
  setLinkDead: vi.fn(),
  patchJob: vi.fn(),
}));

import { TrackerClient } from '@/components/tracker/tracker-client';

const EMPTY = {
  jobs: [],
  total: 0,
  offset: 0,
  limit: 25,
  counts: { flagged: 0, assigned: 0, submitted: 0, unowned_top: 0, total: 0 },
};

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  fetchJobs.mockReset().mockResolvedValue(EMPTY);
});

afterEach(() => setVisibility('visible'));

describe('tracker refresh on return', () => {
  it('reloads the page of jobs when the tab becomes visible again', async () => {
    render(<TrackerClient />);
    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(1));

    await act(async () => setVisibility('hidden'));
    expect(fetchJobs).toHaveBeenCalledTimes(1);

    await act(async () => setVisibility('visible'));
    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(2));
  });

  it('keeps the same filters and page when it reloads', async () => {
    render(<TrackerClient />);
    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(1));

    await act(async () => setVisibility('visible'));
    await waitFor(() => expect(fetchJobs).toHaveBeenCalledTimes(2));
    expect(fetchJobs.mock.calls[1][0]).toEqual(fetchJobs.mock.calls[0][0]);
  });
});
