'use client';

import { SwissGrid } from '@/components/home/swiss-grid';
import { AccountControl } from '@/components/auth/account-control';
import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

// Optimized Imports for Performance (No Barrel Imports)
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Settings from 'lucide-react/dist/esm/icons/settings';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Upload from 'lucide-react/dist/esm/icons/upload';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import X from 'lucide-react/dist/esm/icons/x';

import {
  fetchResume,
  fetchResumeList,
  fetchJobDescription,
  type ResumeListItem,
} from '@/lib/api/resume';
import { useStatusCache } from '@/lib/context/status-cache';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'loading';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';

function looksLikeCredentialAutofill(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('gemini') ||
    normalized.includes('gpt-') ||
    normalized.includes('claude') ||
    normalized.includes('deepseek') ||
    normalized.includes('openrouter') ||
    normalized.includes('sk-') ||
    normalized.includes('aiza')
  );
}

export default function DashboardPage() {
  const { status: authStatus } = useSession();
  const { t } = useTranslations();
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [masterResumeItem, setMasterResumeItem] = useState<ResumeListItem | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('loading');
  const [tailoredResumes, setTailoredResumes] = useState<ResumeListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(false);
  const [showTailorPrompt, setShowTailorPrompt] = useState(false);
  const [isLlmNoticeDismissed, setIsLlmNoticeDismissed] = useState(false);
  const [searchFieldName, setSearchFieldName] = useState('lumi-resume-filter-field');
  const [isSearchFieldReady, setIsSearchFieldReady] = useState(false);
  const router = useRouter();

  // Status cache for optimistic counter updates and LLM status check
  const { status: systemStatus, isLoading: statusLoading } = useStatusCache();

  // Request id guard for concurrent loadTailoredResumes invocations
  const loadRequestIdRef = useRef(0);
  // Lightweight in-memory cache for job snippets to avoid N+1 refetches
  const jobSnippetCacheRef = useRef<Record<string, string>>({});
  const masterMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchEditedByUserRef = useRef(false);
  const searchQueryRef = useRef('');

  const hasUserApiKey = Boolean(systemStatus?.has_user_api_key);
  const isFreeModeAvailable = Boolean(systemStatus?.free_llm_available);
  const shouldShowLlmNotice =
    Boolean(masterResumeId) && !statusLoading && !hasUserApiKey && !isLlmNoticeDismissed;

  const formatDate = (value: string) => {
    if (!value) return t('common.unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('common.unknown');

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const checkResumeStatus = useCallback(async (resumeId: string) => {
    try {
      setProcessingStatus('loading');
      const data = await fetchResume(resumeId);
      const status = data.raw_resume?.processing_status || 'pending';
      setProcessingStatus(status as ProcessingStatus);
    } catch (err: unknown) {
      // If resume not found (404), clear the stale localStorage
      if (err instanceof Error && err.message.includes('404')) {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
        setMasterResumeItem(null);
        setProcessingStatus('loading');
        return;
      }
      console.error('Failed to check resume status:', err);
      setProcessingStatus('failed');
    }
  }, []);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const clearBrowserInjectedSearchValue = useCallback(() => {
    const input = searchInputRef.current;
    if (!input) return;
    const currentValue = input.value;
    const currentSearchQuery = searchQueryRef.current;
    const shouldClear =
      (!searchEditedByUserRef.current && currentValue && !currentSearchQuery) ||
      looksLikeCredentialAutofill(currentValue);
    if (!shouldClear) return;
    input.value = '';
    if (currentSearchQuery) {
      setSearchQuery('');
    }
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    setSearchFieldName(
      `lumi-filter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    );
    setIsSearchFieldReady(true);

    const delays = [0, 100, 500, 1500];
    const timeoutIds = delays.map((delay) =>
      window.setTimeout(clearBrowserInjectedSearchValue, delay)
    );
    window.addEventListener('focus', clearBrowserInjectedSearchValue);
    window.addEventListener('pageshow', clearBrowserInjectedSearchValue);

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.removeEventListener('focus', clearBrowserInjectedSearchValue);
      window.removeEventListener('pageshow', clearBrowserInjectedSearchValue);
    };
  }, [clearBrowserInjectedSearchValue]);

  const loadTailoredResumes = useCallback(async () => {
    try {
      const data = await fetchResumeList(true);
      const masterFromList = data.find((r) => r.is_master);
      const resolvedMasterId = masterFromList?.resume_id || null;

      if (resolvedMasterId) {
        localStorage.setItem('master_resume_id', resolvedMasterId);
        setMasterResumeId(resolvedMasterId);
        setMasterResumeItem(masterFromList ?? null);
        checkResumeStatus(resolvedMasterId);
      } else {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
        setMasterResumeItem(null);
      }

      const filtered = data.filter((r) => r.resume_id !== resolvedMasterId);
      setTailoredResumes(filtered);

      // Only fetch job descriptions for resumes that are actually tailored
      // (identified by having a non-null parent_id). This avoids N+1 calls
      // for untailored resumes.
      const tailoredWithParent = filtered.filter((r) => r.parent_id);

      // Guard against concurrent invocations overwriting each other
      const requestId = ++loadRequestIdRef.current;

      // Fetch job description snippets for tailored resumes in parallel and attach to state
      // Use a small in-memory cache to avoid re-fetching the same snippet repeatedly.
      const jobSnippets: Record<string, string> = {};
      await Promise.all(
        tailoredWithParent.map(async (r) => {
          // Use cached snippet when available
          if (jobSnippetCacheRef.current[r.resume_id]) {
            jobSnippets[r.resume_id] = jobSnippetCacheRef.current[r.resume_id];
            return;
          }
          try {
            const jd = await fetchJobDescription(r.resume_id);
            const snippet = (jd?.content || '').slice(0, 80);
            jobSnippetCacheRef.current[r.resume_id] = snippet;
            jobSnippets[r.resume_id] = snippet;
          } catch {
            // ignore missing job descriptions and cache empty result
            jobSnippetCacheRef.current[r.resume_id] = '';
            jobSnippets[r.resume_id] = '';
          }
        })
      );

      // Only apply results if this invocation is the latest (prevents stale overwrite)
      if (requestId === loadRequestIdRef.current) {
        setTailoredResumes((prev) =>
          prev.map((r) => ({ ...r, jobSnippet: jobSnippets[r.resume_id] || '' }))
        );
      }
    } catch (err) {
      console.error('Failed to load tailored resumes:', err);
    }
  }, [checkResumeStatus]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    captureEvent(POSTHOG_EVENTS.DASHBOARD_VIEWED);
    loadTailoredResumes();
  }, [authStatus, loadTailoredResumes]);

  // Refresh list when window gains focus (e.g., returning from viewer after delete)
  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const handleFocus = () => {
      loadTailoredResumes();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [authStatus, loadTailoredResumes]);

  useEffect(() => {
    if (!isMasterMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (masterMenuRef.current && !masterMenuRef.current.contains(event.target as Node)) {
        setIsMasterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMasterMenuOpen]);

  const handleTailorPromptContinue = () => {
    setShowTailorPrompt(false);
    window.open(CHROME_EXTENSION_URL, '_blank', 'noopener,noreferrer');
  };

  const getStatusDisplay = () => {
    switch (processingStatus) {
      case 'loading':
        return {
          text: t('dashboard.status.checking'),
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          color: 'text-gray-500',
        };
      case 'processing':
        return {
          text: t('dashboard.status.processing'),
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          color: 'text-blue-700',
        };
      case 'ready':
        return { text: t('dashboard.status.ready'), icon: null, color: 'text-green-700' };
      case 'failed':
        return {
          text: t('dashboard.status.failed'),
          icon: <AlertCircle className="w-3 h-3" />,
          color: 'text-red-600',
        };
      default:
        return { text: t('dashboard.status.pending'), icon: null, color: 'text-gray-500' };
    }
  };

  const getMonogram = (title: string): string => {
    const words = title.split(/\s+/).filter((w) => /^[a-zA-Z]/.test(w));
    return words
      .slice(0, 3)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  };

  // Muted palette that complements the #F0F0E8 canvas
  const cardPalette = [
    { bg: '#1D4ED8', fg: '#FFFFFF' }, // Hyper Blue
    { bg: '#15803D', fg: '#FFFFFF' }, // Signal Green
    { bg: '#000000', fg: '#FFFFFF' }, // Ink
    { bg: '#92400E', fg: '#FFFFFF' }, // Warm Brown
    { bg: '#7C3AED', fg: '#FFFFFF' }, // Violet
    { bg: '#0E7490', fg: '#FFFFFF' }, // Teal
    { bg: '#B91C1C', fg: '#FFFFFF' }, // Deep Red
    { bg: '#4338CA', fg: '#FFFFFF' }, // Indigo
  ];

  const hashTitle = (title: string): number => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash << 5) - hash + title.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getResumeTitle = useCallback(
    (resume: ResumeListItem) =>
      resume.title || resume.jobSnippet || resume.filename || t('dashboard.tailoredResume'),
    [t]
  );

  const filteredTailoredResumes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = tailoredResumes.filter((resume) => {
      if (!query) return true;
      return [getResumeTitle(resume), resume.filename || '', resume.jobSnippet || '']
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    filtered.sort((a, b) => {
      if (sortBy === 'title') {
        return getResumeTitle(a).localeCompare(getResumeTitle(b));
      }
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      return bTime - aTime;
    });

    return filtered;
  }, [getResumeTitle, searchQuery, sortBy, tailoredResumes]);

  const handleExportJson = useCallback(async (resumeId: string, fallbackTitle: string) => {
    try {
      const data = await fetchResume(resumeId);
      let payload: unknown = data.processed_resume ?? {};
      if (!data.processed_resume && data.raw_resume?.content) {
        try {
          payload = JSON.parse(data.raw_resume.content);
        } catch {
          payload = data.raw_resume.content;
        }
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const safeTitle = (fallbackTitle || 'resume')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${safeTitle || 'resume'}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export resume JSON:', error);
    }
  }, []);

  const renderStatusPill = (status: ResumeListItem['processing_status'] | ProcessingStatus) => {
    const baseClass =
      'inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em]';
    switch (status) {
      case 'failed':
        return <span className={cn(baseClass, 'bg-red-50 text-red-700')}>{status}</span>;
      case 'processing':
      case 'pending':
        return <span className={cn(baseClass, 'bg-blue-50 text-blue-700')}>{status}</span>;
      default:
        return (
          <span className={cn(baseClass, 'bg-secondary text-muted-foreground')}>{status}</span>
        );
    }
  };

  const masterButtonLabel = masterResumeId
    ? t('dashboard.masterResume')
    : t('dashboard.addMasterResume');
  const masterStatusText = masterResumeId
    ? getStatusDisplay().text
    : t('dashboard.masterResumeExtensionRequired');
  const masterStatusTone =
    processingStatus === 'failed'
      ? 'text-red-700'
      : processingStatus === 'processing' || processingStatus === 'pending'
        ? 'text-blue-700'
        : 'text-gray-500';

  const handleOpenMasterResume = () => {
    if (!masterResumeId) {
      setShowTailorPrompt(true);
      return;
    }
    router.push(`/resumes/${masterResumeId}`);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Warning Banner */}
      {shouldShowLlmNotice && (
        <div className="relative mb-6 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 pr-12 shadow-sw-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-amber-800">
                {t(
                  isFreeModeAvailable
                    ? 'dashboard.freeModeAvailableTitle'
                    : 'dashboard.llmNotConfiguredTitle'
                )}
              </p>
              <p className="font-mono text-xs text-amber-700 mt-0.5">
                {isFreeModeAvailable ? (
                  <>
                    {t('dashboard.freeModeAvailableMessagePrefix')}{' '}
                    <a
                      href={CHROME_EXTENSION_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-700 underline underline-offset-2"
                    >
                      {t('dashboard.freeModeAvailableExtensionLink')}
                    </a>
                    {t('dashboard.freeModeAvailableMessageMiddle')}{' '}
                    <Link href="/settings" className="font-bold underline underline-offset-2">
                      {t('dashboard.llmNotConfiguredSettingsLink')}
                    </Link>
                    {t('dashboard.freeModeAvailableMessageSuffix')}
                  </>
                ) : (
                  <>
                    {t('dashboard.llmNotConfiguredMessagePrefix')}{' '}
                    <Link href="/settings" className="font-bold underline underline-offset-2">
                      {t('dashboard.llmNotConfiguredSettingsLink')}
                    </Link>
                    {t('dashboard.llmNotConfiguredMessageSuffix')}
                  </>
                )}
              </p>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="border-warning text-amber-700">
              <Settings className="w-4 h-4 mr-2" />
              {t('nav.settings')}
            </Button>
          </Link>
          <button
            type="button"
            aria-label="Dismiss notice"
            onClick={() => setIsLlmNoticeDismissed(true)}
            className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <SwissGrid
        title={t('dashboard.myResumes')}
        headerActions={
          <>
            <div className="relative group" ref={masterMenuRef}>
              {masterResumeId ? (
                <div className="flex items-stretch">
                  <Button
                    variant="secondary"
                    onClick={handleOpenMasterResume}
                    className="h-10 min-w-[15rem] justify-start px-4 text-left"
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border border-border text-[9px] font-bold',
                        processingStatus === 'failed'
                          ? 'bg-red-50 text-red-700'
                          : processingStatus === 'processing' || processingStatus === 'pending'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-blue-700 text-white'
                      )}
                    >
                      {processingStatus === 'processing' || processingStatus === 'pending' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : processingStatus === 'failed' ? (
                        '!'
                      ) : (
                        'M'
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="truncate">{masterButtonLabel}</span>
                      <span
                        className={cn(
                          'font-mono text-[9px] uppercase tracking-[0.16em] leading-none',
                          masterStatusTone
                        )}
                      >
                        {masterStatusText}
                      </span>
                    </span>
                  </Button>
                  <button
                    type="button"
                    aria-label={t('dashboard.masterResumeMenu')}
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsMasterMenuOpen((open) => !open);
                    }}
                    className={cn(
                      'rounded-r-xl border border-border border-l-0 bg-secondary px-3 text-foreground shadow-xs transition-colors hover:bg-muted',
                      'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100'
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {isMasterMenuOpen ? (
                    <div className="absolute right-0 top-full z-40 mt-2 min-w-[13rem] overflow-hidden rounded-2xl border border-border bg-card shadow-sw-default">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMasterMenuOpen(false);
                          handleOpenMasterResume();
                        }}
                        className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-secondary"
                      >
                        <span>{t('dashboard.openMasterResume')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!masterResumeId) return;
                          setIsMasterMenuOpen(false);
                          handleExportJson(
                            masterResumeId,
                            masterResumeItem?.title || t('dashboard.masterResume')
                          );
                        }}
                        className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-secondary"
                      >
                        <span>{t('dashboard.exportJson')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMasterMenuOpen(false);
                          setShowTailorPrompt(true);
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-secondary"
                      >
                        <span>{t('dashboard.replaceMasterResumeWithExtension')}</span>
                        <Upload className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="h-10 min-w-[15rem] justify-start px-4"
                  onClick={() => setShowTailorPrompt(true)}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/10 bg-primary text-white">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="truncate">{masterButtonLabel}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] leading-none text-gray-500">
                      {masterStatusText}
                    </span>
                  </span>
                </Button>
              )}
            </div>
            <AccountControl />
            <Link href="/settings">
              <Button variant="outline" size="icon" aria-label={t('nav.settings')}>
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </>
        }
      >
        <div className="space-y-6">
          <div className="skin-card flex min-h-[32rem] flex-col overflow-hidden rounded-[24px]">
            <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-serif text-3xl">{t('dashboard.tailoredResumes')}</h2>
                  <p className="mt-2 font-mono text-xs uppercase tracking-wide text-gray-500">
                    {filteredTailoredResumes.length} / {tailoredResumes.length} resumes
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <form
                    role="search"
                    autoComplete="off"
                    onSubmit={(e) => e.preventDefault()}
                    className="contents"
                  >
                    {isSearchFieldReady ? (
                      <input
                        ref={searchInputRef}
                        type="text"
                        id="lumi-resume-library-filter"
                        name={searchFieldName}
                        value={searchQuery}
                        onFocus={clearBrowserInjectedSearchValue}
                        onChange={(e) => {
                          searchEditedByUserRef.current = true;
                          setSearchQuery(e.target.value);
                        }}
                        placeholder={t('common.search')}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="search"
                        data-1p-ignore="true"
                        data-lpignore="true"
                        className="h-10 min-w-[16rem] rounded-xl border border-border bg-input px-4 font-mono text-sm uppercase tracking-wide outline-none focus:border-primary"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-10 min-w-[16rem] rounded-xl border border-border bg-input px-4"
                      />
                    )}
                  </form>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'updated' | 'title')}
                    className="h-10 min-w-[12rem] rounded-xl border border-border bg-input px-4 font-mono text-sm uppercase tracking-wide outline-none focus:border-primary"
                  >
                    <option value="updated">{t('dashboard.sortUpdated')}</option>
                    <option value="title">{t('dashboard.sortTitle')}</option>
                  </select>
                </div>
              </div>
            </div>

            {filteredTailoredResumes.length === 0 ? (
              <div className="px-6 py-12">
                <p className="font-serif text-2xl">
                  {!masterResumeId
                    ? t('dashboard.noMasterResumeTitle')
                    : tailoredResumes.length === 0
                      ? t('dashboard.noResumes')
                      : t('dashboard.noMatchingResumes')}
                </p>
                <p className="mt-2 font-mono text-sm text-gray-500 uppercase tracking-wide">
                  {!masterResumeId
                    ? t('dashboard.noMasterResumeDescription')
                    : tailoredResumes.length === 0
                      ? t('dashboard.noTailoredResumesDescription')
                      : t('dashboard.tryDifferentSearch')}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto bg-card">
                {filteredTailoredResumes.map((resume, index) => {
                  const title = getResumeTitle(resume);
                  const color = cardPalette[hashTitle(title) % cardPalette.length];
                  return (
                    <div
                      key={resume.resume_id}
                      onClick={() => router.push(`/resumes/${resume.resume_id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/resumes/${resume.resume_id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'flex w-full items-center gap-4 bg-card px-6 py-3 text-left transition-colors hover:bg-secondary/80',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        index > 0 && 'border-t border-border'
                      )}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border"
                        style={{ backgroundColor: color.bg, color: color.fg }}
                      >
                        <span className="font-mono text-xs font-bold">{getMonogram(title)}</span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <h3 className="truncate font-serif text-[1.2rem] leading-tight">{title}</h3>
                        <p className="mt-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-gray-500">
                          {t('dashboard.edited', {
                            date: formatDate(resume.updated_at || resume.created_at),
                          })}
                        </p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2 self-center">
                        {resume.job_source_url ? (
                          <a
                            href={resume.job_source_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                          >
                            Open JD
                          </a>
                        ) : null}
                        {renderStatusPill(resume.processing_status)}
                        <span className="flex h-6 w-6 items-center justify-center rounded-xl border border-border bg-secondary text-foreground">
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Dialog open={showTailorPrompt} onOpenChange={setShowTailorPrompt}>
          <DialogContent className="max-w-[32rem] p-0 gap-0">
            <DialogHeader className="border-b border-border p-6 pb-4">
              <DialogTitle className="font-serif text-2xl">
                {t('dashboard.chromeExtensionPrompt.title')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 p-6">
              <p className="text-sm leading-relaxed text-black">
                {t('dashboard.chromeExtensionPrompt.bodyPrefix')}{' '}
                <a
                  href={CHROME_EXTENSION_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-700 underline underline-offset-4"
                >
                  {t('dashboard.chromeExtensionPrompt.extensionLinkText')}
                </a>{' '}
                {t('dashboard.chromeExtensionPrompt.bodySuffix')}
              </p>
              <p className="font-mono text-xs leading-relaxed text-gray-600">
                {t('dashboard.chromeExtensionPrompt.websiteModeNote')}
              </p>
            </div>

            <DialogFooter className="flex-row justify-end gap-3 border-t border-border bg-secondary/60 p-4">
              <Button variant="outline" onClick={() => setShowTailorPrompt(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleTailorPromptContinue}>
                {t('dashboard.chromeExtensionPrompt.continueInApp')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SwissGrid>
    </div>
  );
}
