'use client';

import { SwissGrid } from '@/components/home/swiss-grid';
import { ResumeUploadDialog } from '@/components/dashboard/resume-upload-dialog';
import { AccountControl } from '@/components/auth/account-control';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// Optimized Imports for Performance (No Barrel Imports)
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Settings from 'lucide-react/dist/esm/icons/settings';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import Upload from 'lucide-react/dist/esm/icons/upload';
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';

import {
  fetchResume,
  fetchResumeList,
  deleteResume,
  retryProcessing,
  fetchJobDescription,
  type ResumeListItem,
} from '@/lib/api/resume';
import { useStatusCache } from '@/lib/context/status-cache';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'loading';

const TAILOR_PROMPT_COUNT_KEY = 'som_career_coach_tailor_prompt_count';
const TAILOR_PROMPT_DISMISSED_KEY = 'som_career_coach_tailor_prompt_dismissed';

export default function DashboardPage() {
  const { status: authStatus } = useSession();
  const { t, locale } = useTranslations();
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [masterResumeItem, setMasterResumeItem] = useState<ResumeListItem | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('loading');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tailoredResumes, setTailoredResumes] = useState<ResumeListItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'title'>('updated');
  const [isMasterMenuOpen, setIsMasterMenuOpen] = useState(false);
  const [showTailorPrompt, setShowTailorPrompt] = useState(false);
  const [tailorPromptCount, setTailorPromptCount] = useState(0);
  const [tailorPromptDismissed, setTailorPromptDismissed] = useState(false);
  const [hideTailorPrompt, setHideTailorPrompt] = useState(false);
  const router = useRouter();

  // Status cache for optimistic counter updates and LLM status check
  const {
    status: systemStatus,
    isLoading: statusLoading,
    incrementResumes,
    decrementResumes,
    setHasMasterResume,
  } = useStatusCache();

  // Request id guard for concurrent loadTailoredResumes invocations
  const loadRequestIdRef = useRef(0);
  // Lightweight in-memory cache for job snippets to avoid N+1 refetches
  const jobSnippetCacheRef = useRef<Record<string, string>>({});
  const masterMenuRef = useRef<HTMLDivElement>(null);

  // Check if LLM is configured (API key is set)
  const isLlmConfigured = !statusLoading && systemStatus?.llm_configured;

  const isTailorEnabled =
    Boolean(masterResumeId) && processingStatus === 'ready' && isLlmConfigured;

  const formatDate = (value: string) => {
    if (!value) return t('common.unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('common.unknown');

    const dateLocale =
      locale === 'es' ? 'es-ES' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';

    return date.toLocaleDateString(dateLocale, {
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
      console.error('Failed to check resume status:', err);
      // If resume not found (404), clear the stale localStorage
      if (err instanceof Error && err.message.includes('404')) {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
        return;
      }
      setProcessingStatus('failed');
    }
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    const storedId = localStorage.getItem('master_resume_id');
    if (storedId) {
      setMasterResumeId(storedId);
      checkResumeStatus(storedId);
    }
  }, [authStatus, checkResumeStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCount = Number(localStorage.getItem(TAILOR_PROMPT_COUNT_KEY) || '0');
    setTailorPromptCount(Number.isFinite(savedCount) ? savedCount : 0);
    setTailorPromptDismissed(localStorage.getItem(TAILOR_PROMPT_DISMISSED_KEY) === 'true');
  }, []);

  const loadTailoredResumes = useCallback(async () => {
    try {
      const data = await fetchResumeList(true);
      const masterFromList = data.find((r) => r.is_master);
      const storedId = localStorage.getItem('master_resume_id');
      const resolvedMasterId = masterFromList?.resume_id || storedId;

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
  }, [authStatus, loadTailoredResumes, checkResumeStatus]);

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

  const handleUploadComplete = (resumeId: string) => {
    localStorage.setItem('master_resume_id', resumeId);
    setMasterResumeId(resumeId);
    setIsUploadDialogOpen(false);
    // Check status after upload completes
    checkResumeStatus(resumeId);
    // Update cached counters
    incrementResumes();
    setHasMasterResume(true);
  };

  const handleRetryProcessing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!masterResumeId) return;
    setIsRetrying(true);
    try {
      const result = await retryProcessing(masterResumeId);
      if (result.processing_status === 'ready') {
        setProcessingStatus('ready');
      } else if (
        result.processing_status === 'processing' ||
        result.processing_status === 'pending'
      ) {
        setProcessingStatus(result.processing_status);
      } else {
        setProcessingStatus('failed');
      }
    } catch (err) {
      console.error('Retry processing failed:', err);
      setProcessingStatus('failed');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDeleteAndReupload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMasterMenuOpen(false);
    setShowDeleteDialog(true);
  };

  const confirmDeleteAndReupload = async () => {
    if (!masterResumeId) return;
    try {
      await deleteResume(masterResumeId);
      decrementResumes();
      setHasMasterResume(false);
      localStorage.removeItem('master_resume_id');
      setMasterResumeId(null);
      setProcessingStatus('loading');
      setIsUploadDialogOpen(true);
      await loadTailoredResumes();
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const persistTailorPromptPreference = useCallback(
    (shouldHide: boolean) => {
      if (!shouldHide || tailorPromptCount < 3) return;
      localStorage.setItem(TAILOR_PROMPT_DISMISSED_KEY, 'true');
      setTailorPromptDismissed(true);
    },
    [tailorPromptCount]
  );

  const handleTailorPromptOpenChange = (open: boolean) => {
    if (!open) {
      persistTailorPromptPreference(hideTailorPrompt);
      setHideTailorPrompt(false);
    }
    setShowTailorPrompt(open);
  };

  const handleTailorResumeClick = () => {
    if (!isTailorEnabled) return;
    if (tailorPromptDismissed) {
      router.push('/tailor');
      return;
    }

    const nextCount = tailorPromptCount + 1;
    setTailorPromptCount(nextCount);
    localStorage.setItem(TAILOR_PROMPT_COUNT_KEY, String(nextCount));
    setHideTailorPrompt(false);
    setShowTailorPrompt(true);
  };

  const handleTailorPromptContinue = () => {
    persistTailorPromptPreference(hideTailorPrompt);
    setShowTailorPrompt(false);
    setHideTailorPrompt(false);
    router.push('/tailor');
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

  const handleExportJson = useCallback(
    async (resumeId: string, fallbackTitle: string) => {
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
    },
    []
  );

  const renderStatusPill = (status: ResumeListItem['processing_status'] | ProcessingStatus) => {
    const baseClass =
      'inline-flex items-center border border-black px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em]';
    switch (status) {
      case 'failed':
        return <span className={cn(baseClass, 'bg-red-50 text-red-700')}>{status}</span>;
      case 'processing':
      case 'pending':
        return <span className={cn(baseClass, 'bg-blue-50 text-blue-700')}>{status}</span>;
      default:
        return <span className={cn(baseClass, 'bg-[#E5E5E0] text-gray-500')}>{status}</span>;
    }
  };

  const masterButtonLabel = masterResumeId
    ? t('dashboard.masterResume')
    : t('dashboard.addMasterResume');
  const masterStatusText = masterResumeId ? getStatusDisplay().text : t('dashboard.uploadResume');
  const masterStatusTone =
    processingStatus === 'failed'
      ? 'text-red-700'
      : processingStatus === 'processing' || processingStatus === 'pending'
        ? 'text-blue-700'
        : 'text-gray-500';

  const handleOpenMasterResume = () => {
    if (!masterResumeId) {
      setIsUploadDialogOpen(true);
      return;
    }
    router.push(`/resumes/${masterResumeId}`);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Warning Banner */}
      {masterResumeId && !isLlmConfigured && !statusLoading && (
        <div className="border-2 border-warning bg-amber-50 p-4 shadow-sw-default mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-amber-800">
                {t('dashboard.llmNotConfiguredTitle')}
              </p>
              <p className="font-mono text-xs text-amber-700 mt-0.5">
                {t('dashboard.llmNotConfiguredMessage')}
              </p>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="border-warning text-amber-700">
              <Settings className="w-4 h-4 mr-2" />
              {t('nav.settings')}
            </Button>
          </Link>
        </div>
      )}

      <SwissGrid
        title={t('dashboard.myResumes')}
        subtitle={t('dashboard.subtitle')}
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
                        'flex h-5 w-5 items-center justify-center border border-black text-[9px] font-bold',
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
                      'border border-black border-l-0 bg-[#E5E5E0] px-3 text-black shadow-[2px_2px_0px_0px_#000000] transition-all duration-150 hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
                      'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100'
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {isMasterMenuOpen ? (
                    <div className="absolute right-0 top-full z-40 mt-2 min-w-[13rem] border border-black bg-canvas shadow-[4px_4px_0px_0px_#000000]">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMasterMenuOpen(false);
                          handleOpenMasterResume();
                        }}
                        className="flex w-full items-center justify-between border-b border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-[#EAEAE2]"
                      >
                        <span>{t('dashboard.openMasterResume')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMasterMenuOpen(false);
                          setIsUploadDialogOpen(true);
                        }}
                        className="flex w-full items-center justify-between border-b border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-[#EAEAE2]"
                      >
                        <span>{t('dashboard.replaceMasterResume')}</span>
                        <Upload className="h-3.5 w-3.5" />
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
                        className="flex w-full items-center justify-between border-b border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-wide hover:bg-[#EAEAE2]"
                      >
                        <span>{t('dashboard.exportJson')}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAndReupload}
                        className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs uppercase tracking-wide text-red-700 hover:bg-red-50"
                      >
                        <span>{t('dashboard.removeMasterResume')}</span>
                        <AlertCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <ResumeUploadDialog
                  open={isUploadDialogOpen}
                  onOpenChange={setIsUploadDialogOpen}
                  onUploadComplete={handleUploadComplete}
                  trigger={
                    <Button variant="outline" className="h-10 min-w-[15rem] justify-start px-4">
                      <span className="flex h-5 w-5 items-center justify-center border border-black bg-blue-700 text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-col items-start">
                        <span className="truncate">{masterButtonLabel}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] leading-none text-gray-500">
                          {masterStatusText}
                        </span>
                      </span>
                    </Button>
                  }
                />
              )}
            </div>
            <Button onClick={handleTailorResumeClick} disabled={!isTailorEnabled}>
              <Plus className="w-4 h-4" />
              {t('dashboard.tailorResume')}
            </Button>
            <AccountControl />
            <Link href="/settings">
              <Button variant="outline" size="icon" aria-label={t('nav.settings')}>
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </>
        }
      >
        {masterResumeId ? (
          <ResumeUploadDialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
            onUploadComplete={handleUploadComplete}
            trigger={null}
          />
        ) : null}
        <div className="space-y-6">
          <div className="border border-black bg-canvas overflow-hidden flex min-h-[32rem] flex-col">
            <div className="sticky top-0 z-10 border-b border-black bg-canvas px-6 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-serif text-3xl">{t('dashboard.tailoredResumes')}</h2>
                  <p className="mt-2 font-mono text-xs uppercase tracking-wide text-gray-500">
                    {filteredTailoredResumes.length} / {tailoredResumes.length} resumes
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('common.search')}
                    className="h-10 min-w-[16rem] border border-black bg-canvas px-4 font-mono text-sm uppercase tracking-wide outline-none focus:border-blue-700"
                  />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'updated' | 'title')}
                    className="h-10 min-w-[12rem] border border-black bg-canvas px-4 font-mono text-sm uppercase tracking-wide outline-none focus:border-blue-700"
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
                  {tailoredResumes.length === 0
                    ? t('dashboard.noResumes')
                    : t('dashboard.noMatchingResumes')}
                </p>
                <p className="mt-2 font-mono text-sm text-gray-500 uppercase tracking-wide">
                  {tailoredResumes.length === 0
                    ? t('dashboard.noTailoredResumesDescription')
                    : t('dashboard.tryDifferentSearch')}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto bg-canvas">
                {filteredTailoredResumes.map((resume, index) => {
                  const title = getResumeTitle(resume);
                  const color = cardPalette[hashTitle(title) % cardPalette.length];
                  return (
                    <button
                      key={resume.resume_id}
                      type="button"
                      onClick={() => router.push(`/resumes/${resume.resume_id}`)}
                      className={cn(
                        'flex w-full items-center gap-4 bg-canvas px-6 py-3 text-left transition-colors hover:bg-[#EAEAE2]',
                        index > 0 && 'border-t border-black'
                      )}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-black"
                        style={{ backgroundColor: color.bg, color: color.fg }}
                      >
                        <span className="font-mono text-xs font-bold">{getMonogram(title)}</span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <h3 className="truncate font-serif text-[1.2rem] leading-tight">
                          {title}
                        </h3>
                        <p className="mt-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-gray-500">
                          {t('dashboard.edited', {
                            date: formatDate(resume.updated_at || resume.created_at),
                          })}
                        </p>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2 self-center">
                        {renderStatusPill(resume.processing_status)}
                        <span className="flex h-6 w-6 items-center justify-center border border-black bg-[#E5E5E0] text-black">
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={t('confirmations.deleteMasterResumeTitle')}
          description={t('confirmations.deleteMasterResumeDescription')}
          confirmLabel={t('dashboard.deleteAndReupload')}
          cancelLabel={t('confirmations.keepResumeCancelLabel')}
          onConfirm={confirmDeleteAndReupload}
          variant="danger"
        />

        <Dialog open={showTailorPrompt} onOpenChange={handleTailorPromptOpenChange}>
          <DialogContent className="max-w-[32rem] p-0 gap-0">
            <DialogHeader className="border-b border-black p-6 pb-4">
              <DialogTitle className="font-serif text-2xl">
                {t('dashboard.chromeExtensionPrompt.title')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 p-6">
              <p className="text-sm leading-relaxed text-black">
                {t('dashboard.chromeExtensionPrompt.body')}
              </p>

              {tailorPromptCount >= 3 ? (
                <label className="flex items-start gap-3 border border-black px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={hideTailorPrompt}
                    onChange={(event) => setHideTailorPrompt(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded-none border border-black accent-blue-700"
                  />
                  <span>{t('dashboard.chromeExtensionPrompt.hideOption')}</span>
                </label>
              ) : null}
            </div>

            <DialogFooter className="border-t border-black bg-[#E5E5E0] p-4 flex-row justify-end gap-3">
              <Button variant="outline" onClick={() => handleTailorPromptOpenChange(false)}>
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
