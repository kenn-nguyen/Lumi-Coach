'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Download from 'lucide-react/dist/esm/icons/download';
import Search from 'lucide-react/dist/esm/icons/search';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left';
import { SwissGrid } from '@/components/home/swiss-grid';
import { Button } from '@/components/ui/button';
import {
  downloadAdminExtensionRunsExport,
  fetchAdminExtensionRunItem,
  fetchAdminExtensionRuns,
  fetchUserExtensionRunItem,
  fetchUserExtensionRuns,
  type ExtensionRunAdminItem,
  type ExtensionRunAdminListResponse,
} from '@/lib/api/admin';
import { buildAdminExtensionRunFilename, downloadBlobAsFile } from '@/lib/utils/download';
import { isAdminEmail } from '@/lib/admin';
import { SaveEvalCaseModal } from '@/components/evals/SaveEvalCaseModal';

type FilterStatus = 'all' | 'generated' | 'failed' | 'canceled' | 'running';
type FilterProfile = 'all' | 'profile1' | 'profile2' | 'profile3';
type FilterSource = 'all' | 'web' | 'extension';

function resolveRunSource(runSource?: string | null): string {
  if (!runSource) return '-';
  return runSource === 'web' ? 'Web' : 'Extension';
}

function toInputDateValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDefaultDateFrom(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return toInputDateValue(date);
}

function buildDefaultDateTo(): string {
  return toInputDateValue(new Date());
}

const RUN_LIST_LIMIT = 20;

function formatTimestamp(value?: string | null): string {
  if (!value) return '-';
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(parsed));
}

function buildCompanyRoleLabel(item: ExtensionRunAdminItem): string {
  const company = item.company?.trim() || '';
  const title = item.title?.trim() || '';
  if (company && title) return `${company} / ${title}`;
  return company || title || '-';
}

function shortenVersion(value?: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return '-';
  return normalized.slice(0, 6);
}

function formatPromptSetup(item: ExtensionRunAdminItem): string {
  const setup = item.prompt_setup;
  if (!setup) return '-';
  const parts: string[] = [];
  if (setup.prompt_profile_id?.trim()) {
    parts.push(setup.prompt_profile_id.trim());
  }
  parts.push(`1:${shortenVersion(setup.prompt1_version_id)}`);
  parts.push(`2:${shortenVersion(setup.prompt2_version_id)}`);
  parts.push(`3:${shortenVersion(setup.prompt3_version_id)}`);
  parts.push(`s:${shortenVersion(setup.system_prompt_version_id)}`);
  return parts.join(' | ');
}

function statusPillClass(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'generated') return 'border-green-200 bg-green-50 text-green-700';
  if (normalized === 'failed') return 'border-red-200 bg-red-50 text-red-700';
  if (normalized === 'canceled') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function RunsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const isAdmin = isAdminEmail(session?.user?.email);

  const [runsResponse, setRunsResponse] = useState<ExtensionRunAdminListResponse>({
    items: [],
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sourceFilter, setSourceFilter] = useState<FilterSource>('all');
  const [profileFilter, setProfileFilter] = useState<FilterProfile>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(buildDefaultDateFrom);
  const [dateTo, setDateTo] = useState(buildDefaultDateTo);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);
  const [evalResumeId, setEvalResumeId] = useState<string | null>(null);

  const offset = (page - 1) * RUN_LIST_LIMIT;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/');
  }, [authStatus, router]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, sourceFilter, profileFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const filters = {
          status: statusFilter === 'all' ? undefined : statusFilter,
          run_source: sourceFilter === 'all' ? undefined : sourceFilter,
          prompt_profile_id: isAdmin && profileFilter !== 'all' ? profileFilter : undefined,
          search: searchQuery || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: RUN_LIST_LIMIT,
          offset,
        };
        const next = isAdmin
          ? await fetchAdminExtensionRuns(filters)
          : await fetchUserExtensionRuns(filters);
        if (!cancelled) setRunsResponse(next);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load runs.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    authStatus,
    isAdmin,
    statusFilter,
    sourceFilter,
    profileFilter,
    searchQuery,
    dateFrom,
    dateTo,
    offset,
  ]);

  const rows = runsResponse.items;
  const rangeStart = runsResponse.total === 0 ? 0 : offset + 1;
  const rangeEnd = runsResponse.total === 0 ? 0 : offset + rows.length;
  const canGoPrevious = page > 1 && !isLoading;
  const canGoNext = !isLoading && offset + rows.length < runsResponse.total;

  const subtitle = useMemo(
    () =>
      `${isAdmin ? 'All users' : 'Your'} tailor runs. Showing ${rangeStart}–${rangeEnd} of ${runsResponse.total} result${runsResponse.total === 1 ? '' : 's'}.`,
    [isAdmin, rangeEnd, rangeStart, runsResponse.total]
  );

  async function handleDownloadFilteredJson(): Promise<void> {
    setIsExporting(true);
    setError(null);
    try {
      const blob = await downloadAdminExtensionRunsExport({
        status: statusFilter === 'all' ? undefined : statusFilter,
        run_source: sourceFilter === 'all' ? undefined : sourceFilter,
        prompt_profile_id: profileFilter === 'all' ? undefined : profileFilter,
        search: searchQuery || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      downloadBlobAsFile(blob, 'extension-runs-export.json');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to export runs.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadRun(item: ExtensionRunAdminItem): Promise<void> {
    setDownloadingRunId(item.run_id);
    setError(null);
    try {
      const run = isAdmin
        ? await fetchAdminExtensionRunItem(item.user_id, item.run_id)
        : await fetchUserExtensionRunItem(item.run_id);
      const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
      downloadBlobAsFile(blob, buildAdminExtensionRunFilename(run.company, run.title, item.run_id));
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to download run.');
    } finally {
      setDownloadingRunId(null);
    }
  }

  const colSpan = isAdmin ? 8 : 5;

  return (
    <>
      <SwissGrid
        title={isAdmin ? 'All Runs' : 'My Runs'}
        subtitle={subtitle}
        headerActions={
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        }
      >
        <div className="space-y-6">
          <section className="border border-border bg-card p-4 shadow-sw-sm">
            <div
              className={
                isAdmin
                  ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_8rem_8rem_8rem]'
                  : 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_8rem_8rem]'
              }
            >
              <label className="flex items-center gap-2 border border-border bg-white px-3 py-2 text-sm text-foreground">
                <Search className="h-4 w-4 text-primary" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={isAdmin ? 'Search company, role, or user' : 'Search company or role'}
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="border border-border bg-white px-3 py-2 text-sm text-foreground"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="border border-border bg-white px-3 py-2 text-sm text-foreground"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
                className="border border-border bg-white px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All statuses</option>
                <option value="generated">Generated</option>
                <option value="failed">Failed</option>
                <option value="canceled">Canceled</option>
                <option value="running">Running</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as FilterSource)}
                className="border border-border bg-white px-3 py-2 text-sm text-foreground"
              >
                <option value="all">All sources</option>
                <option value="web">Web</option>
                <option value="extension">Extension</option>
              </select>
              {isAdmin ? (
                <select
                  value={profileFilter}
                  onChange={(event) => setProfileFilter(event.target.value as FilterProfile)}
                  className="border border-border bg-white px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">All profiles</option>
                  <option value="profile1">profile1</option>
                  <option value="profile2">profile2</option>
                  <option value="profile3">profile3</option>
                </select>
              ) : null}
            </div>
            {isAdmin ? (
              <div className="mt-3 flex justify-end">
                <Button onClick={() => void handleDownloadFilteredJson()} disabled={isExporting}>
                  {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download filtered JSON
                </Button>
              </div>
            ) : null}
          </section>

          {error ? (
            <section className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sw-sm">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden border border-border bg-card shadow-sw-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-secondary/60 font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
                  <tr>
                    <th className="border-b border-border px-4 py-3 text-left">Time</th>
                    {isAdmin ? (
                      <th className="border-b border-border px-4 py-3 text-left">User</th>
                    ) : null}
                    <th className="border-b border-border px-4 py-3 text-left">Company / Role</th>
                    <th className="border-b border-border px-4 py-3 text-left">Status</th>
                    <th className="border-b border-border px-4 py-3 text-left">Source</th>
                    {isAdmin ? (
                      <>
                        <th className="border-b border-border px-4 py-3 text-left">Profile</th>
                        <th className="border-b border-border px-4 py-3 text-left">Prompt setup</th>
                      </>
                    ) : null}
                    <th className="border-b border-border px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={colSpan}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading runs...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colSpan}
                        className="px-4 py-10 text-center text-muted-foreground"
                      >
                        No runs found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((item) => (
                      <tr
                        key={`${item.user_id}:${item.run_id}`}
                        className="border-b border-border/70 last:border-b-0"
                      >
                        <td className="px-4 py-3 align-top text-foreground">
                          {formatTimestamp(item.generated_at || item.created_at)}
                        </td>
                        {isAdmin ? (
                          <td className="px-4 py-3 align-top text-foreground">
                            {item.user_email || item.user_id}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-foreground">
                            {buildCompanyRoleLabel(item)}
                          </div>
                          {item.location ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.location}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusPillClass(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                          {resolveRunSource(item.source)}
                        </td>
                        {isAdmin ? (
                          <>
                            <td className="px-4 py-3 align-top font-mono text-xs text-primary">
                              {item.prompt_setup?.prompt_profile_id || '-'}
                            </td>
                            <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                              {formatPromptSetup(item)}
                            </td>
                          </>
                        ) : null}
                        <td className="px-4 py-3 text-right align-top">
                          <div className="flex items-center justify-end gap-2">
                            {item.status === 'generated' && item.resume_id ? (
                              <>
                                <button
                                  onClick={() => setEvalResumeId(item.resume_id!)}
                                  className="font-mono text-xs text-gray-500 hover:text-foreground"
                                >
                                  Save as eval
                                </button>
                                <Link
                                  href={`/resumes/${item.resume_id}`}
                                  className="font-mono text-xs text-blue-600 hover:underline"
                                >
                                  View
                                </Link>
                              </>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleDownloadRun(item)}
                              disabled={downloadingRunId === item.run_id}
                            >
                              {downloadingRunId === item.run_id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="mr-2 h-4 w-4" />
                              )}
                              JSON
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Page {page}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={!canGoPrevious}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!canGoNext}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>
        </div>
      </SwissGrid>

      <SaveEvalCaseModal
        isOpen={evalResumeId !== null}
        onClose={() => setEvalResumeId(null)}
        tailoredResumeId={evalResumeId ?? ''}
      />
    </>
  );
}
