'use client';

import { SwissGrid } from '@/components/home/swiss-grid';
import { AccountControl } from '@/components/auth/account-control';
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
  type FormEvent,
} from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import X from 'lucide-react/dist/esm/icons/x';
import Wand2 from 'lucide-react/dist/esm/icons/wand-2';

import {
  deleteResume,
  fetchResume,
  fetchResumeList,
  fetchJobDescription,
  type ResumeListItem,
} from '@/lib/api/resume';
import {
  CACHE_KEYS,
  CACHE_TTL,
  readCache,
  writeCache,
  invalidateCache,
} from '@/lib/cache/local-cache';

interface ResumeListCache {
  resumes: ResumeListItem[];
  masterId: string | null;
  masterItem: ResumeListItem | null;
}
import { ResumeJsonImportDialog } from '@/components/dashboard/resume-json-import-dialog';
import { ImportMasterResumeDialog } from '@/components/dashboard/import-master-resume-dialog';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { useStatusCache } from '@/lib/context/status-cache';
import { useBackgroundTailor } from '@/lib/context/background-tailor';
import { getTailorStatus } from '@/lib/api/tailor';
import { TailorDialog } from '@/components/tailor/TailorDialog';
import type { DashboardInitialData } from '@/lib/api/server';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'loading';

interface DashboardClientProps {
  initialData: DashboardInitialData | null;
}

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/lumi-coach/iklflomjpppjfkaegdimkgabancffdhb';
const DASHBOARD_RESUME_LIST_LIMIT = 10;

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

export default function DashboardPage({ initialData }: DashboardClientProps) {
  const { status: authStatus } = useSession();
  const { t } = useTranslations();
  // Seed from server-prefetched props so SSR and client hydration render identical
  // HTML (no flash). localStorage is NOT read in the render path — it would crash on
  // the server and cause a hydration mismatch. The mount effect (loadTailoredResumes)
  // revalidates and syncs localStorage afterward.
  const [masterResumeId, setMasterResumeId] = useState<string | null>(
    initialData?.masterResumeId ?? null
  );
  const [masterResumeItem, setMasterResumeItem] = useState<ResumeListItem | null>(
    initialData?.masterResumeItem ?? null
  );
  const [resumesLoaded, setResumesLoaded] = useState<boolean>(initialData !== null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>(
    initialData?.processingStatus ?? 'loading'
  );
  const [tailoredResumes, setTailoredResumes] = useState<ResumeListItem[]>(
    initialData?.tailoredResumes ?? []
  );
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(false);
  const [showTailorPrompt, setShowTailorPrompt] = useState(false);
  const [showTailorDialog, setShowTailorDialog] = useState(false);
  const [isTailorMenuOpen, setIsTailorMenuOpen] = useState(false);
  const [showImportTailoredDialog, setShowImportTailoredDialog] = useState(false);
  const [showImportMasterDialog, setShowImportMasterDialog] = useState(false);
  const [isLlmNoticeDismissed, setIsLlmNoticeDismissed] = useState(false);
  const [resumePendingDelete, setResumePendingDelete] = useState<ResumeListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [searchFieldName, setSearchFieldName] = useState('lumi-resume-filter-field');
  const [isSearchFieldReady, setIsSearchFieldReady] = useState(false);
  const router = useRouter();

  // Status cache for optimistic counter updates and LLM status check
  const { status: systemStatus, isLoading: statusLoading, decrementResumes } = useStatusCache();

  // Background tailor job (started when TailorDialog is closed mid-run)
  const { job: bgTailorJob, setJob: setBgTailorJob } = useBackgroundTailor();
  const [bgTailorState, setBgTailorState] = useState<'running' | 'done' | 'error' | 'canceled'>(
    'running'
  );
  const [bgTailoredResumeId, setBgTailoredResumeId] = useState<string | null>(null);
  const [bgTailorError, setBgTailorError] = useState<string | null>(null);
  const bgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request id guard for concurrent loadTailoredResumes invocations
  const loadRequestIdRef = useRef(0);
  // Lightweight in-memory cache for job snippets to avoid N+1 refetches
  const jobSnippetCacheRef = useRef<Record<string, string>>({});
  const masterMenuRef = useRef<HTMLDivElement>(null);
  const tailorMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchEditedByUserRef = useRef(false);
  const searchInputValueRef = useRef('');
  const submittedSearchRef = useRef('');

  const hasUserApiKey = Boolean(systemStatus?.has_user_api_key);
  const isFreeModeAvailable = Boolean(systemStatus?.free_llm_available);
  const shouldShowLlmNotice =
    resumesLoaded &&
    Boolean(masterResumeId) &&
    processingStatus === 'ready' &&
    !statusLoading &&
    systemStatus !== null &&
    !isLlmNoticeDismissed &&
    (isFreeModeAvailable || !systemStatus.llm_configured) &&
    !hasUserApiKey;

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
    searchInputValueRef.current = searchInput;
  }, [searchInput]);

  useEffect(() => {
    submittedSearchRef.current = submittedSearch;
  }, [submittedSearch]);

  const clearBrowserInjectedSearchValue = useCallback(() => {
    const input = searchInputRef.current;
    if (!input) return;
    const currentValue = input.value;
    const currentSearchInput = searchInputValueRef.current;
    const shouldClear =
      (!searchEditedByUserRef.current && currentValue && !currentSearchInput) ||
      looksLikeCredentialAutofill(currentValue);
    if (!shouldClear) return;
    input.value = '';
    if (currentSearchInput) {
      setSearchInput('');
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

  const applyResumeList = useCallback(
    (data: ResumeListItem[], includeMaster: boolean, fromCache: boolean) => {
      if (includeMaster) {
        const masterFromList = data.find((r) => r.is_master);
        const resolvedMasterId = masterFromList?.resume_id || null;

        if (resolvedMasterId) {
          if (!fromCache) localStorage.setItem('master_resume_id', resolvedMasterId);
          setMasterResumeId(resolvedMasterId);
          setMasterResumeItem(masterFromList ?? null);
          const pStatus = masterFromList?.processing_status;
          if (pStatus === 'pending' || pStatus === 'processing') {
            // Non-terminal: poll the status endpoint until it resolves
            checkResumeStatus(resolvedMasterId);
          } else {
            // Terminal ('ready'/'failed') or unknown: trust list data directly
            // — avoids the 'loading' flash that occurred when !fromCache forced a re-check
            setProcessingStatus((pStatus ?? 'loading') as ProcessingStatus);
          }
        } else {
          if (!fromCache) localStorage.removeItem('master_resume_id');
          setMasterResumeId(null);
          setMasterResumeItem(null);
          if (!fromCache) setProcessingStatus('loading');
        }
      }

      const filtered = data
        .filter((r) => !r.is_master)
        .map((resume) => ({
          ...resume,
          jobSnippet: jobSnippetCacheRef.current[resume.resume_id] || resume.jobSnippet || '',
        }));
      setTailoredResumes(filtered);
      setResumesLoaded(true);
    },
    [checkResumeStatus]
  );

  const loadTailoredResumes = useCallback(
    async (searchTerm: string = submittedSearchRef.current) => {
      const normalizedSearch = searchTerm.trim();
      const includeMaster = normalizedSearch.length === 0;
      const requestId = ++loadRequestIdRef.current;

      // Serve from cache immediately for the unfiltered list
      if (includeMaster) {
        const cached = readCache<ResumeListCache>(CACHE_KEYS.RESUME_LIST, CACHE_TTL.RESUME_LIST);
        if (cached) {
          applyResumeList(cached.resumes, true, true);
        }
      }

      // Always fetch fresh in background
      try {
        const data = await fetchResumeList(includeMaster, undefined, normalizedSearch);
        if (requestId !== loadRequestIdRef.current) return;

        applyResumeList(data, includeMaster, false);

        if (includeMaster) {
          const masterFromList = data.find((r) => r.is_master) ?? null;
          writeCache<ResumeListCache>(CACHE_KEYS.RESUME_LIST, {
            resumes: data,
            masterId: masterFromList?.resume_id ?? null,
            masterItem: masterFromList,
          });
        }
      } catch (err) {
        console.error('Failed to load tailored resumes:', err);
      }
    },
    [applyResumeList]
  );

  // Poll background tailor job when one is active (must be after loadTailoredResumes)
  useEffect(() => {
    if (!bgTailorJob) {
      if (bgPollRef.current) {
        clearInterval(bgPollRef.current);
        bgPollRef.current = null;
      }
      setBgTailorState('running');
      setBgTailoredResumeId(null);
      setBgTailorError(null);
      return;
    }

    const rid = bgTailorJob.resumeId;
    setBgTailorState('running');

    bgPollRef.current = setInterval(async () => {
      try {
        const s = await getTailorStatus(rid);
        if (s.status === 'completed') {
          clearInterval(bgPollRef.current!);
          bgPollRef.current = null;
          setBgTailoredResumeId(s.tailored_resume_id ?? null);
          setBgTailorState('done');
          invalidateCache(CACHE_KEYS.RESUME_LIST);
          void loadTailoredResumes();
        } else if (s.status === 'failed') {
          clearInterval(bgPollRef.current!);
          bgPollRef.current = null;
          setBgTailorError(s.error_message ?? 'Pipeline failed.');
          setBgTailorState('error');
        } else if (s.status === 'canceled') {
          clearInterval(bgPollRef.current!);
          bgPollRef.current = null;
          setBgTailorState('canceled');
          setBgTailorJob(null);
        }
      } catch {
        // transient — keep polling
      }
    }, 3000);

    return () => {
      if (bgPollRef.current) {
        clearInterval(bgPollRef.current);
        bgPollRef.current = null;
      }
    };
  }, [bgTailorJob, loadTailoredResumes, setBgTailorJob]);

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

  useEffect(() => {
    if (!isTailorMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (tailorMenuRef.current && !tailorMenuRef.current.contains(event.target as Node)) {
        setIsTailorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTailorMenuOpen]);

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

  const sortedTailoredResumes = useMemo(() => {
    const nextResumes = [...tailoredResumes];

    nextResumes.sort((a, b) => {
      if (sortBy === 'title') {
        return getResumeTitle(a).localeCompare(getResumeTitle(b));
      }
      const aTime = new Date(a.updated_at || a.created_at).getTime();
      const bTime = new Date(b.updated_at || b.created_at).getTime();
      return bTime - aTime;
    });

    return nextResumes;
  }, [getResumeTitle, sortBy, tailoredResumes]);

  const hasActiveSearch = submittedSearch.trim().length > 0;
  const totalTailoredResumeCount = sortedTailoredResumes.length;
  const totalPages = Math.max(1, Math.ceil(totalTailoredResumeCount / DASHBOARD_RESUME_LIST_LIMIT));
  const paginatedTailoredResumes = useMemo(() => {
    const start = (currentPage - 1) * DASHBOARD_RESUME_LIST_LIMIT;
    return sortedTailoredResumes.slice(start, start + DASHBOARD_RESUME_LIST_LIMIT);
  }, [currentPage, sortedTailoredResumes]);
  const pageRangeStart = totalTailoredResumeCount
    ? (currentPage - 1) * DASHBOARD_RESUME_LIST_LIMIT + 1
    : 0;
  const pageRangeEnd = totalTailoredResumeCount
    ? Math.min(currentPage * DASHBOARD_RESUME_LIST_LIMIT, totalTailoredResumeCount)
    : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, submittedSearch]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const resumesNeedingSnippets = paginatedTailoredResumes.filter(
      (resume) => resume.parent_id && jobSnippetCacheRef.current[resume.resume_id] === undefined
    );
    if (resumesNeedingSnippets.length === 0) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      resumesNeedingSnippets.map(async (resume) => {
        try {
          const jd = await fetchJobDescription(resume.resume_id);
          return [resume.resume_id, (jd?.content || '').slice(0, 80)] as const;
        } catch {
          return [resume.resume_id, ''] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) return;

      const snippetMap = Object.fromEntries(entries);
      Object.entries(snippetMap).forEach(([resumeId, snippet]) => {
        jobSnippetCacheRef.current[resumeId] = snippet;
      });

      setTailoredResumes((current) =>
        current.map((resume) =>
          resume.resume_id in snippetMap
            ? { ...resume, jobSnippet: snippetMap[resume.resume_id] || '' }
            : resume
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, [paginatedTailoredResumes]);

  const handleSearchSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const nextSearch = searchInput.trim();
      setCurrentPage(1);
      setSubmittedSearch(nextSearch);
      void loadTailoredResumes(nextSearch);
    },
    [loadTailoredResumes, searchInput]
  );

  const handleSearchReset = useCallback(() => {
    searchEditedByUserRef.current = false;
    setCurrentPage(1);
    setSearchInput('');
    setSubmittedSearch('');
    void loadTailoredResumes('');
  }, [loadTailoredResumes]);

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

  const renderStatusPill = (
    status: ResumeListItem['processing_status'] | ProcessingStatus,
    resumeId?: string
  ) => {
    const baseClass =
      'inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em]';
    switch (status) {
      case 'failed':
        return <span className={cn(baseClass, 'bg-red-50 text-red-700')}>{status}</span>;
      case 'processing':
      case 'pending':
        return <span className={cn(baseClass, 'bg-blue-50 text-blue-700')}>{status}</span>;
      case 'ready':
        return (
          <button
            type="button"
            className={cn(
              baseClass,
              'bg-secondary text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35'
            )}
            onClick={(event) => {
              event.stopPropagation();
              if (resumeId) {
                router.push(`/resumes/${resumeId}`);
              }
            }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {status}
          </button>
        );
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

  const handleImportJsonComplete = useCallback(
    ({ resumeId }: { resumeId: string }) => {
      router.push(`/resumes/${resumeId}`);
    },
    [router]
  );

  const handleDeleteResumeFromDashboard = useCallback(async () => {
    if (!resumePendingDelete || isDeletingResume) return;

    try {
      setIsDeletingResume(true);
      setDeleteError(null);
      await deleteResume(resumePendingDelete.resume_id);
      invalidateCache(CACHE_KEYS.RESUME_LIST);
      setTailoredResumes((current) =>
        current.filter((resume) => resume.resume_id !== resumePendingDelete.resume_id)
      );
      decrementResumes();
      setResumePendingDelete(null);
    } catch (error) {
      console.error('Failed to delete resume from dashboard:', error);
      setDeleteError(t('resumeViewer.errors.failedToDelete'));
    } finally {
      setIsDeletingResume(false);
    }
  }, [decrementResumes, isDeletingResume, resumePendingDelete, t]);

  return (
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
                        setShowImportMasterDialog(true);
                      }}
                      className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-secondary"
                    >
                      <span>Import Master Resume</span>
                      <Upload className="h-3.5 w-3.5" />
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
          {masterResumeId && processingStatus === 'ready' ? (
            <div className="relative group" ref={tailorMenuRef}>
              <div className="flex items-stretch">
                <Button
                  variant="outline"
                  onClick={() => setShowTailorDialog(true)}
                  className="h-10 min-w-[12rem] justify-start px-4 text-left"
                >
                  <Wand2 className="h-3.5 w-3.5 mr-2" />
                  <span className="flex min-w-0 flex-col items-start">
                    <span className="truncate">Tailor to Job</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] leading-none text-gray-500">
                      AI-powered
                    </span>
                  </span>
                </Button>
                <button
                  type="button"
                  aria-label="Tailor menu"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsTailorMenuOpen((open) => !open);
                  }}
                  className={cn(
                    'rounded-r-xl border border-border border-l-0 bg-secondary px-3 text-foreground shadow-xs transition-colors hover:bg-muted',
                    'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100'
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {isTailorMenuOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-2 min-w-[16rem] overflow-hidden rounded-2xl border border-border bg-card shadow-sw-default">
                    <button
                      type="button"
                      onClick={() => {
                        setIsTailorMenuOpen(false);
                        setShowTailorDialog(true);
                      }}
                      className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-secondary"
                    >
                      <span>Tailor to Job</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTailorMenuOpen(false);
                        setShowImportTailoredDialog(true);
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-secondary"
                    >
                      <span>Import Tailored Resume JSON</span>
                      <Upload className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
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
        {/* First-time setup checklist */}
        <SetupChecklist
          systemStatus={systemStatus}
          masterResumeId={masterResumeId}
          processingStatus={processingStatus}
          onUploadResume={() => setShowImportMasterDialog(true)}
        />

        {/* Background tailor job banner */}
        {bgTailorJob && bgTailorState !== 'canceled' && (
          <section className="relative rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 pr-14 shadow-sw-sm">
            <div className="flex items-center gap-3">
              {bgTailorState === 'running' && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
              )}
              {bgTailorState === 'done' && <Wand2 className="h-4 w-4 shrink-0 text-amber-600" />}
              {bgTailorState === 'error' && (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0 flex-1">
                {bgTailorState === 'running' && (
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Tailoring in progress — working in the background…
                  </p>
                )}
                {bgTailorState === 'done' && (
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Tailored resume is ready!{' '}
                    {bgTailoredResumeId && (
                      <button
                        type="button"
                        onClick={() => {
                          setBgTailorJob(null);
                          router.push(`/resumes/${bgTailoredResumeId}`);
                        }}
                        className="underline underline-offset-2 hover:no-underline"
                      >
                        View resume
                      </button>
                    )}
                  </p>
                )}
                {bgTailorState === 'error' && (
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    Tailoring failed — {bgTailorError}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setBgTailorJob(null)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        {/* Configuration Warning Banner */}
        {shouldShowLlmNotice && (
          <section className="relative rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 pr-14 shadow-sw-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-700" />
                <div className="max-w-3xl space-y-2">
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                    {t(
                      isFreeModeAvailable
                        ? 'dashboard.freeModeAvailableTitle'
                        : 'dashboard.llmNotConfiguredTitle'
                    )}
                  </p>
                  {isFreeModeAvailable ? (
                    <>
                      <p className="max-w-2xl text-sm leading-6 text-amber-950">
                        {t('dashboard.freeModeAvailableBody')}
                      </p>
                      <p className="max-w-2xl text-sm leading-6 text-amber-700/95">
                        {t('dashboard.freeModeAvailableBodySecondaryPrefix')}
                        <Link
                          href="/settings"
                          className="font-semibold underline underline-offset-2"
                        >
                          {t('dashboard.llmNotConfiguredSettingsLink')}
                        </Link>
                        {t('dashboard.freeModeAvailableBodySecondarySuffix')}
                      </p>
                    </>
                  ) : (
                    <p className="max-w-2xl text-sm leading-6 text-amber-700/95">
                      {t('dashboard.llmNotConfiguredMessagePrefix')}{' '}
                      <Link href="/settings" className="font-semibold underline underline-offset-2">
                        {t('dashboard.llmNotConfiguredSettingsLink')}
                      </Link>
                      {t('dashboard.llmNotConfiguredMessageSuffix')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 lg:justify-end">
                <a href={CHROME_EXTENSION_URL} target="_blank" rel="noreferrer">
                  <Button size="sm" className="min-w-[8.5rem]">
                    {t('dashboard.freeModeAvailableExtensionCta')}
                  </Button>
                </a>
                <Link href="/settings">
                  <Button variant="outline" size="sm" className="min-w-[7.5rem]">
                    <Settings className="mr-2 h-4 w-4" />
                    {t('nav.settings')}
                  </Button>
                </Link>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss notice"
              onClick={() => setIsLlmNoticeDismissed(true)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </section>
        )}

        <div className="skin-card flex min-h-[32rem] flex-col overflow-hidden rounded-[24px]">
          <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-serif text-3xl">{t('dashboard.tailoredResumes')}</h2>
                <p className="mt-2 font-mono text-xs uppercase tracking-wide text-gray-500">
                  {totalTailoredResumeCount} resumes
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <form
                  role="search"
                  autoComplete="off"
                  onSubmit={handleSearchSubmit}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center"
                >
                  {isSearchFieldReady ? (
                    <input
                      ref={searchInputRef}
                      type="text"
                      id="lumi-resume-library-filter"
                      name={searchFieldName}
                      value={searchInput}
                      onFocus={clearBrowserInjectedSearchValue}
                      onChange={(e) => {
                        searchEditedByUserRef.current = true;
                        setSearchInput(e.target.value);
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
                  <Button type="submit" variant="outline" className="h-10 min-w-[7.5rem]">
                    {t('common.search')}
                  </Button>
                  {searchInput || hasActiveSearch ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 min-w-[6rem]"
                      onClick={handleSearchReset}
                    >
                      {t('common.reset')}
                    </Button>
                  ) : null}
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

          {totalTailoredResumeCount === 0 ? (
            <div className="px-6 py-12">
              <p className="font-serif text-2xl">
                {!masterResumeId && !hasActiveSearch
                  ? t('dashboard.noMasterResumeTitle')
                  : !hasActiveSearch
                    ? t('dashboard.noResumes')
                    : t('dashboard.noMatchingResumes')}
              </p>
              <p className="mt-2 font-mono text-sm text-gray-500 uppercase tracking-wide">
                {!masterResumeId && !hasActiveSearch
                  ? t('dashboard.noMasterResumeDescription')
                  : !hasActiveSearch
                    ? t('dashboard.noTailoredResumesDescription')
                    : t('dashboard.tryDifferentSearch')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-card">
                {paginatedTailoredResumes.map((resume, index) => {
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
                        <div className="flex min-w-0 items-start gap-3">
                          <h3
                            className="min-w-0 flex-1 truncate font-serif text-[1.2rem] leading-tight"
                            title={title}
                          >
                            {title}
                          </h3>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-wide text-gray-500">
                            {t('dashboard.edited', {
                              date: formatDate(resume.updated_at || resume.created_at),
                            })}
                          </p>
                          {resume.job_source_url ? (
                            <a
                              href={resume.job_source_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-card px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                            >
                              Open JD
                            </a>
                          ) : null}
                          <div className="shrink-0">
                            {renderStatusPill(resume.processing_status, resume.resume_id)}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('dashboard.deleteResume')}
                            className="h-8 w-8 shrink-0 rounded-xl border border-transparent text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:border-red-200 focus-visible:bg-red-50 focus-visible:text-red-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteError(null);
                              setResumePendingDelete(resume);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3 border-t border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                  {t('dashboard.pageRange', {
                    start: pageRangeStart,
                    end: pageRangeEnd,
                    count: totalTailoredResumeCount,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-w-[6.5rem]"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                  >
                    {t('common.previous')}
                  </Button>
                  <div className="min-w-[8rem] px-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                    {t('dashboard.pageLabel', {
                      current: currentPage,
                      total: totalPages,
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-w-[6.5rem]"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {masterResumeId && showTailorDialog && (
        <TailorDialog
          resumeId={masterResumeId}
          isOpen={showTailorDialog}
          onClose={() => {
            setShowTailorDialog(false);
            invalidateCache(CACHE_KEYS.RESUME_LIST);
            void loadTailoredResumes();
          }}
        />
      )}

      {masterResumeId && (
        <ResumeJsonImportDialog
          open={showImportTailoredDialog}
          onOpenChange={setShowImportTailoredDialog}
          onImportComplete={handleImportJsonComplete}
          trigger={null}
        />
      )}

      <ImportMasterResumeDialog
        open={showImportMasterDialog}
        onOpenChange={setShowImportMasterDialog}
        onImportComplete={({ resumeId }) => {
          invalidateCache(CACHE_KEYS.RESUME_LIST);
          router.push(`/resumes/${resumeId}`);
        }}
      />

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

      <ConfirmDialog
        open={!!resumePendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeletingResume) {
            setResumePendingDelete(null);
            setDeleteError(null);
          }
        }}
        title={t('dashboard.deleteResume')}
        description={t('confirmations.deleteResumeFromSystemDescription')}
        errorMessage={deleteError ?? undefined}
        confirmLabel={t('confirmations.deleteResumeConfirmLabel')}
        cancelLabel={t('confirmations.keepResumeCancelLabel')}
        confirmDisabled={isDeletingResume}
        closeOnConfirm={false}
        onConfirm={handleDeleteResumeFromDashboard}
        variant="danger"
      />
    </SwissGrid>
  );
}
