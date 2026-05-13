'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Download from 'lucide-react/dist/esm/icons/download';
import Search from 'lucide-react/dist/esm/icons/search';
import ShieldAlert from 'lucide-react/dist/esm/icons/shield-alert';
import { SwissGrid } from '@/components/home/swiss-grid';
import { Button } from '@/components/ui/button';
import {
  downloadAdminExtensionRunsExport,
  fetchAdminExtensionRunItem,
  fetchAdminExtensionRuns,
  type ExtensionRunAdminItem,
  type ExtensionRunAdminListResponse,
} from '@/lib/api/admin';
import { downloadBlobAsFile } from '@/lib/utils/download';

type FilterStatus = 'all' | 'generated' | 'failed' | 'canceled' | 'running';
type FilterProfile = 'all' | 'profile1' | 'profile2' | 'profile3';

function toInputDateValue(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDefaultDateFrom(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 7);
  return toInputDateValue(date);
}

function buildDefaultDateTo(): string {
  return toInputDateValue(new Date());
}

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
  if (normalized === 'generated') {
    return 'border-green-200 bg-green-50 text-green-700';
  }
  if (normalized === 'failed') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (normalized === 'canceled') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }
  return 'border-blue-200 bg-blue-50 text-blue-700';
}

export default function AdminExtensionRunsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [runsResponse, setRunsResponse] = useState<ExtensionRunAdminListResponse>({
    items: [],
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [profileFilter, setProfileFilter] = useState<FilterProfile>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState(buildDefaultDateFrom);
  const [dateTo, setDateTo] = useState(buildDefaultDateTo);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/');
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const next = await fetchAdminExtensionRuns({
          status: statusFilter === 'all' ? undefined : statusFilter,
          prompt_profile_id: profileFilter === 'all' ? undefined : profileFilter,
          search: searchQuery || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          limit: 100,
          offset: 0,
        });
        if (!cancelled) {
          setRunsResponse(next);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load extension runs.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [authStatus, statusFilter, profileFilter, searchQuery, dateFrom, dateTo]);

  const rows = runsResponse.items;
  const subtitle = useMemo(
    () =>
      `Recent extension runs and JSON exports. Showing ${runsResponse.total} result${runsResponse.total === 1 ? '' : 's'}.`,
    [runsResponse.total]
  );

  async function handleDownloadFilteredJson(): Promise<void> {
    setIsExporting(true);
    setError(null);
    try {
      const blob = await downloadAdminExtensionRunsExport({
        status: statusFilter === 'all' ? undefined : statusFilter,
        prompt_profile_id: profileFilter === 'all' ? undefined : profileFilter,
        search: searchQuery || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      downloadBlobAsFile(blob, 'extension-runs-export.json');
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Failed to export extension runs.'
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadRun(item: ExtensionRunAdminItem): Promise<void> {
    setDownloadingRunId(item.run_id);
    setError(null);
    try {
      const run = await fetchAdminExtensionRunItem(item.user_id, item.run_id);
      const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
      downloadBlobAsFile(blob, `extension-run-${item.run_id}.json`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : 'Failed to download extension run.'
      );
    } finally {
      setDownloadingRunId(null);
    }
  }

  return (
    <SwissGrid title="Extension Runs" subtitle={subtitle}>
      <div className="space-y-6">
        <section className="border border-border bg-card p-4 shadow-sw-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem_auto]">
            <label className="flex items-center gap-2 border border-border bg-white px-3 py-2 text-sm text-foreground">
              <Search className="h-4 w-4 text-primary" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search company, role, or user"
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
              value={profileFilter}
              onChange={(event) => setProfileFilter(event.target.value as FilterProfile)}
              className="border border-border bg-white px-3 py-2 text-sm text-foreground"
            >
              <option value="all">All profiles</option>
              <option value="profile1">profile1</option>
              <option value="profile2">profile2</option>
              <option value="profile3">profile3</option>
            </select>
          </div>
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
                  <th className="border-b border-border px-4 py-3 text-left">User</th>
                  <th className="border-b border-border px-4 py-3 text-left">Company / Role</th>
                  <th className="border-b border-border px-4 py-3 text-left">Status</th>
                  <th className="border-b border-border px-4 py-3 text-left">Profile</th>
                  <th className="border-b border-border px-4 py-3 text-left">Prompt setup</th>
                  <th className="border-b border-border px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading extension runs...
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No extension runs found for the current filters.
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
                      <td className="px-4 py-3 align-top text-foreground">
                        {item.user_email || item.user_id}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground">
                          {buildCompanyRoleLabel(item)}
                        </div>
                        {item.location ? (
                          <div className="mt-1 text-xs text-muted-foreground">{item.location}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusPillClass(item.status)}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-primary">
                        {item.prompt_setup?.prompt_profile_id || '-'}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground">
                        {formatPromptSetup(item)}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SwissGrid>
  );
}
