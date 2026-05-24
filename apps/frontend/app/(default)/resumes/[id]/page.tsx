'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { ResumeData } from '@/components/dashboard/resume-component';
import { PageContainer } from '@/components/preview/page-container';
import { QuickLayoutControls } from '@/components/preview/quick-layout-controls';
import { ResumePrintContent } from '@/components/preview/resume-print-content';
import { usePagination } from '@/components/preview/use-pagination';
import { ImportContextCard } from '@/components/resume/import-context-card';
import {
  fetchResume,
  downloadResumePdf,
  getResumePdfUrl,
  deleteResume,
  retryProcessing,
  renameResume,
  updateResumeTemplateSettings,
  warmResumePdf,
  type GenerationFeedback,
  type ResumeImportContext,
} from '@/lib/api/resume';
import { fetchOutputConfig } from '@/lib/api/config';
import { useStatusCache } from '@/lib/context/status-cache';
import { ArrowLeft, Edit, Download, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { withLocalizedDefaultSections } from '@/lib/utils/section-helpers';
import { useLanguage } from '@/lib/context/language-context';
import {
  buildResumeArtifactFilename,
  downloadBlobAsFile,
  openUrlInNewTab,
} from '@/lib/utils/download';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';
import {
  mergeTemplateSettings,
  resolveEffectiveTemplateSettings,
} from '@/lib/utils/template-settings';
import {
  DEFAULT_TEMPLATE_SETTINGS,
  getFitOnePageEffectiveSettings,
  getFitOnePageModeForMeasurements,
  getFitOnePageVerticalScale,
  shouldRenderAsSingleFitPage,
  type DateDisplayMode,
  type TemplateSettings,
} from '@/lib/types/template-settings';
import { getContentAreaPx, mmToPx, PAGE_DIMENSIONS } from '@/lib/constants/page-dimensions';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed';
type ViewerResumeRecord = Awaited<ReturnType<typeof fetchResume>>;

function readPrompt2RecommendedTitle(
  artifact: Record<string, unknown> | null | undefined
): string | null {
  if (!artifact || typeof artifact !== 'object') return null;
  const recommendedTitle = artifact.recommended_title;
  return typeof recommendedTitle === 'string' && recommendedTitle.trim()
    ? recommendedTitle.trim()
    : null;
}

function buildViewerResumeTitle(data: ViewerResumeRecord): string | null {
  const storedTitle = data.title?.trim() || '';
  const filename =
    data.filename
      ?.trim()
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim() || '';
  const prompt2RecommendedTitle = readPrompt2RecommendedTitle(data.generation_artifacts?.prompt2);

  if (storedTitle.includes(' - ')) {
    return storedTitle;
  }

  if (storedTitle && prompt2RecommendedTitle) {
    return `${storedTitle} - ${prompt2RecommendedTitle}`;
  }

  if (storedTitle) {
    return storedTitle;
  }

  if (prompt2RecommendedTitle) {
    return prompt2RecommendedTitle;
  }

  if (filename) {
    return filename;
  }

  return null;
}

function buildPromptSetupFooterText(generationFeedback: GenerationFeedback | null): string | null {
  const promptSetup = generationFeedback?.prompt_setup;
  if (!promptSetup) return null;

  const parts: string[] = [];
  if (promptSetup.prompt_profile_id?.trim()) {
    parts.push(`P ${promptSetup.prompt_profile_id.trim()}`);
  }
  if (promptSetup.prompt1_version_id?.trim()) {
    parts.push(`1 ${promptSetup.prompt1_version_id.trim().slice(0, 8)}`);
  }
  if (promptSetup.prompt2_version_id?.trim()) {
    parts.push(`2 ${promptSetup.prompt2_version_id.trim().slice(0, 8)}`);
  }
  if (promptSetup.prompt3_version_id?.trim()) {
    parts.push(`3 ${promptSetup.prompt3_version_id.trim().slice(0, 8)}`);
  }
  if (promptSetup.system_prompt_version_id?.trim()) {
    parts.push(`S ${promptSetup.system_prompt_version_id.trim().slice(0, 8)}`);
  }

  return parts.length > 0 ? parts.join(' | ') : null;
}

export default function ResumeViewerPage() {
  const { status: authStatus } = useSession();
  const { t } = useTranslations();
  const { uiLanguage } = useLanguage();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { decrementResumes, setHasMasterResume } = useStatusCache();
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [isMasterResume, setIsMasterResume] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteSuccessDialog, setShowDeleteSuccessDialog] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resumeTitle, setResumeTitle] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [generationFeedback, setGenerationFeedback] = useState<GenerationFeedback | null>(null);
  const [importContext, setImportContext] = useState<ResumeImportContext | null>(null);
  const [linkedMasterResumeId, setLinkedMasterResumeId] = useState<string | null>(null);
  const [templateSettings, setTemplateSettings] =
    useState<TemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const baseMeasurementRef = useRef<HTMLDivElement>(null);
  const gentleMeasurementRef = useRef<HTMLDivElement>(null);
  const balancedMeasurementRef = useRef<HTMLDivElement>(null);
  const compactMeasurementRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const lastPdfWarmSignatureRef = useRef<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  const resumeId = params?.id as string;
  const runId = searchParams.get('runId');
  const source = searchParams.get('source');

  const localizedResumeData = useMemo(() => {
    if (!resumeData) return null;
    return withLocalizedDefaultSections(resumeData, t);
  }, [resumeData, t]);
  const previewResumeData = localizedResumeData || resumeData;
  const basePreviewPrintSettings: TemplateSettings = useMemo(
    () => ({
      ...templateSettings,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
    [templateSettings]
  );
  const baseContentArea = getContentAreaPx(templateSettings.pageSize, templateSettings.margins);
  const { pages: basePages, totalContentHeight: baseTotalContentHeight } = usePagination({
    pageSize: templateSettings.pageSize,
    margins: templateSettings.margins,
    measurementRef: baseMeasurementRef,
  });
  const gentleSettings = useMemo(
    () => getFitOnePageEffectiveSettings(templateSettings, 'gentle'),
    [templateSettings]
  );
  const balancedSettings = useMemo(
    () => getFitOnePageEffectiveSettings(templateSettings, 'balanced'),
    [templateSettings]
  );
  const compactSettings = useMemo(
    () => getFitOnePageEffectiveSettings(templateSettings, 'compact'),
    [templateSettings]
  );
  const gentlePrintSettings = useMemo(
    () => ({ ...gentleSettings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
    [gentleSettings]
  );
  const balancedPrintSettings = useMemo(
    () => ({ ...balancedSettings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
    [balancedSettings]
  );
  const compactPrintSettings = useMemo(
    () => ({ ...compactSettings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
    [compactSettings]
  );
  const gentleContentArea = getContentAreaPx(gentleSettings.pageSize, gentleSettings.margins);
  const balancedContentArea = getContentAreaPx(balancedSettings.pageSize, balancedSettings.margins);
  const compactContentArea = getContentAreaPx(compactSettings.pageSize, compactSettings.margins);
  const { pages: gentlePages, totalContentHeight: gentleTotalContentHeight } = usePagination({
    pageSize: gentleSettings.pageSize,
    margins: gentleSettings.margins,
    measurementRef: gentleMeasurementRef,
  });
  const { pages: balancedPages, totalContentHeight: balancedTotalContentHeight } = usePagination({
    pageSize: balancedSettings.pageSize,
    margins: balancedSettings.margins,
    measurementRef: balancedMeasurementRef,
  });
  const { pages: compactPages, totalContentHeight: compactTotalContentHeight } = usePagination({
    pageSize: compactSettings.pageSize,
    margins: compactSettings.margins,
    measurementRef: compactMeasurementRef,
  });
  const baseContentRatio =
    baseContentArea.height > 0 ? baseTotalContentHeight / baseContentArea.height : 0;
  const candidateContentRatios = {
    gentle: gentleContentArea.height > 0 ? gentleTotalContentHeight / gentleContentArea.height : 0,
    balanced:
      balancedContentArea.height > 0 ? balancedTotalContentHeight / balancedContentArea.height : 0,
    compact:
      compactContentArea.height > 0 ? compactTotalContentHeight / compactContentArea.height : 0,
  };
  const fitMode = getFitOnePageModeForMeasurements(
    templateSettings.fitOnePage,
    baseContentRatio,
    candidateContentRatios
  );
  const selectedContentRatio =
    fitMode === 'gentle'
      ? candidateContentRatios.gentle
      : fitMode === 'balanced'
        ? candidateContentRatios.balanced
        : fitMode === 'compact'
          ? candidateContentRatios.compact
          : baseContentRatio;
  const fitOnePageVerticalScale = getFitOnePageVerticalScale(
    templateSettings.fitOnePage,
    baseContentRatio,
    selectedContentRatio
  );
  const shouldUseSingleFitPage = shouldRenderAsSingleFitPage(
    templateSettings.fitOnePage,
    baseContentRatio,
    fitMode
  );
  const effectivePreviewSettings = useMemo(
    () => ({
      ...getFitOnePageEffectiveSettings(templateSettings, fitMode),
      fitOnePageVerticalScale,
    }),
    [templateSettings, fitMode, fitOnePageVerticalScale]
  );
  const pdfRenderLayout = useMemo(
    () => ({
      fitMode,
      fitOnePageVerticalScale,
    }),
    [fitMode, fitOnePageVerticalScale]
  );
  const pdfWarmSignature = useMemo(() => {
    if (!resumeId || !previewResumeData || processingStatus !== 'ready') {
      return null;
    }
    return JSON.stringify({
      resumeId,
      templateSettings,
      pdfRenderLayout,
      uiLanguage,
    });
  }, [
    resumeId,
    previewResumeData,
    processingStatus,
    templateSettings,
    pdfRenderLayout,
    uiLanguage,
  ]);
  const previewPrintSettings: TemplateSettings = useMemo(
    () => ({
      ...effectivePreviewSettings,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }),
    [effectivePreviewSettings]
  );
  const additionalSectionLabels = useMemo(
    () => ({
      technicalSkills: t('resume.additionalLabels.technicalSkills'),
      languages: t('resume.additionalLabels.languages'),
      certifications: t('resume.additionalLabels.certifications'),
      awards: t('resume.additionalLabels.awards'),
    }),
    [t]
  );
  const sectionHeadings = useMemo(
    () => ({
      summary: t('resume.sections.summary'),
      experience: t('resume.sections.experience'),
      education: t('resume.sections.education'),
      projects: t('resume.sections.projects'),
      certifications: t('resume.sections.certifications'),
      skills: t('resume.sections.skillsOnly'),
      languages: t('resume.sections.languages'),
      awards: t('resume.sections.awards'),
      links: t('resume.sections.links'),
    }),
    [t]
  );
  const fallbackLabels = useMemo(() => ({ name: t('resume.defaults.name') }), [t]);
  const selectedPages =
    fitMode === 'gentle'
      ? gentlePages
      : fitMode === 'balanced'
        ? balancedPages
        : fitMode === 'compact'
          ? compactPages
          : basePages;
  const effectiveContentArea = getContentAreaPx(
    effectivePreviewSettings.pageSize,
    effectivePreviewSettings.margins
  );
  const pages = shouldUseSingleFitPage
    ? [
        {
          pageNumber: 1,
          contentOffset: 0,
          contentEnd: effectiveContentArea.height,
        },
      ]
    : selectedPages;

  const calculatePreviewZoom = useCallback(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth - 48;
    const pageWidthPx = mmToPx(PAGE_DIMENSIONS[effectivePreviewSettings.pageSize].width);
    setPreviewZoom(Math.max(0.35, Math.min(1, containerWidth / pageWidthPx)));
  }, [effectivePreviewSettings.pageSize]);

  useEffect(() => {
    calculatePreviewZoom();
    window.addEventListener('resize', calculatePreviewZoom);
    return () => window.removeEventListener('resize', calculatePreviewZoom);
  }, [calculatePreviewZoom]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !resumeId) return;

    const loadResume = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, outputConfig] = await Promise.all([
          fetchResume(resumeId),
          fetchOutputConfig().catch(() => null),
        ]);
        const backendDefaultSettings = outputConfig
          ? mergeTemplateSettings(outputConfig.default_template_settings, {
              dateDisplay: outputConfig.default_date_display,
              fitOnePage: outputConfig.default_fit_one_page,
            })
          : DEFAULT_TEMPLATE_SETTINGS;
        const savedResumeSettings = Object.fromEntries(
          Object.entries(data.template_settings ?? {}).filter(
            ([, value]) => value !== null && value !== undefined
          )
        ) as Partial<TemplateSettings>;
        setTemplateSettings(
          resolveEffectiveTemplateSettings(backendDefaultSettings, savedResumeSettings)
        );

        // Get processing status
        const status = (data.raw_resume?.processing_status || 'pending') as ProcessingStatus;
        setProcessingStatus(status);

        // Capture title for editable display (always set to clear stale state)
        setResumeTitle(buildViewerResumeTitle(data));
        setGenerationFeedback(data.generation_feedback ?? null);
        setImportContext(data.import_context ?? null);
        setLinkedMasterResumeId(data.linked_master_resume_id ?? null);

        // Prioritize processed_resume if available (structured JSON)
        if (data.processed_resume) {
          setResumeData(data.processed_resume as ResumeData);
          setError(null);
        } else if (status === 'failed') {
          setError(t('resumeViewer.errors.processingFailed'));
        } else if (status === 'processing') {
          setError(t('resumeViewer.errors.stillProcessing'));
        } else if (data.raw_resume?.content) {
          // Try to parse raw_resume content as JSON (for tailored resumes stored as JSON)
          try {
            const parsed = JSON.parse(data.raw_resume.content);
            setResumeData(parsed as ResumeData);
          } catch {
            setError(t('resumeViewer.errors.notProcessedYet'));
          }
        } else {
          setError(t('resumeViewer.errors.noDataAvailable'));
        }
      } catch (err) {
        console.error('Failed to load resume:', err);
        setError(t('resumeViewer.errors.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    loadResume();
    setIsMasterResume(localStorage.getItem('master_resume_id') === resumeId);
  }, [authStatus, resumeId, t]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !resumeId || source !== 'extension') return;
    captureEvent(POSTHOG_EVENTS.RESUME_WORKSPACE_OPENED, {
      resume_id: resumeId,
      run_id: runId,
      source,
    });
  }, [authStatus, resumeId, runId, source]);

  useEffect(() => {
    if (
      authStatus !== 'authenticated' ||
      !resumeId ||
      !previewResumeData ||
      processingStatus !== 'ready' ||
      !pdfWarmSignature
    ) {
      return;
    }
    if (lastPdfWarmSignatureRef.current === pdfWarmSignature) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastPdfWarmSignatureRef.current = pdfWarmSignature;
      void warmResumePdf(resumeId, templateSettings, uiLanguage, pdfRenderLayout).catch((err) => {
        console.warn('Failed to warm resume PDF:', err);
        if (lastPdfWarmSignatureRef.current === pdfWarmSignature) {
          lastPdfWarmSignatureRef.current = null;
        }
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    authStatus,
    resumeId,
    previewResumeData,
    processingStatus,
    pdfWarmSignature,
    templateSettings,
    uiLanguage,
    pdfRenderLayout,
  ]);

  const handleRetryProcessing = async () => {
    if (!resumeId) return;
    setIsRetrying(true);
    try {
      const result = await retryProcessing(resumeId);
      if (result.processing_status === 'ready') {
        // Reload the page to show the processed resume
        window.location.reload();
      } else {
        setError(t('resumeViewer.errors.processingFailed'));
      }
    } catch (err) {
      console.error('Retry processing failed:', err);
      setError(t('resumeViewer.errors.processingFailed'));
    } finally {
      setIsRetrying(false);
    }
  };

  const handleEdit = () => {
    router.push(`/builder?id=${resumeId}`);
  };

  const handleDateDisplayChange = (dateDisplay: DateDisplayMode) => {
    setTemplateSettings((current) => {
      const nextSettings = { ...current, dateDisplay };
      void updateResumeTemplateSettings(resumeId, nextSettings).catch((err) => {
        console.error('Failed to save resume template settings:', err);
      });
      return nextSettings;
    });
  };

  const handleExperienceHeaderOrderChange = (
    experienceHeaderOrder: TemplateSettings['experienceHeaderOrder']
  ) => {
    setTemplateSettings((current) => {
      const nextSettings = { ...current, experienceHeaderOrder };
      void updateResumeTemplateSettings(resumeId, nextSettings).catch((err) => {
        console.error('Failed to save resume template settings:', err);
      });
      return nextSettings;
    });
  };

  const handleFitOnePageChange = (fitOnePage: boolean) => {
    setTemplateSettings((current) => {
      const nextSettings = { ...current, fitOnePage };
      void updateResumeTemplateSettings(resumeId, nextSettings).catch((err) => {
        console.error('Failed to save resume template settings:', err);
      });
      return nextSettings;
    });
  };

  const handleTitleSave = async () => {
    const trimmed = editingTitleValue.trim();
    if (!trimmed || trimmed === resumeTitle) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await renameResume(resumeId, trimmed);
      setResumeTitle(trimmed);
    } catch (err) {
      console.error('Failed to rename resume:', err);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    let syncedForDownload = false;
    try {
      const userName = resumeData?.personalInfo?.name?.trim() || null;
      const filename = buildResumeArtifactFilename(
        userName,
        resumeTitle,
        resumeId,
        'resume',
        'pdf'
      );
      await updateResumeTemplateSettings(resumeId, templateSettings);
      syncedForDownload = true;
      const blob = await downloadResumePdf(
        resumeId,
        templateSettings,
        uiLanguage,
        filename,
        pdfRenderLayout
      );
      downloadBlobAsFile(blob, filename);
    } catch (err) {
      console.error('Failed to download resume:', err);
      if (
        syncedForDownload &&
        err instanceof TypeError &&
        err.message.includes('Failed to fetch')
      ) {
        const userName = resumeData?.personalInfo?.name?.trim() || null;
        const filename = buildResumeArtifactFilename(
          userName,
          resumeTitle,
          resumeId,
          'resume',
          'pdf'
        );
        const fallbackUrl = getResumePdfUrl(
          resumeId,
          templateSettings,
          uiLanguage,
          filename,
          pdfRenderLayout
        );
        const didOpen = openUrlInNewTab(fallbackUrl);
        if (!didOpen) {
          alert(t('common.popupBlocked', { url: fallbackUrl }));
        }
        return;
      }
      const errorMessage =
        err instanceof Error && err.message
          ? `${t('builder.alerts.downloadFailed')}: ${err.message}`
          : t('builder.alerts.downloadFailed');
      alert(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteResume = async () => {
    try {
      setDeleteError(null);
      await deleteResume(resumeId);
      // Update cached counters
      decrementResumes();
      if (isMasterResume) {
        localStorage.removeItem('master_resume_id');
        setHasMasterResume(false);
      }
      setShowDeleteDialog(false);
      setShowDeleteSuccessDialog(true);
    } catch (err) {
      console.error('Failed to delete resume:', err);
      setDeleteError(t('resumeViewer.errors.failedToDelete'));
      setShowDeleteDialog(false);
    }
  };

  const handleDeleteSuccessConfirm = () => {
    setShowDeleteSuccessDialog(false);
    router.push('/dashboard');
  };

  const feedbackRows = [
    {
      key: 'cons',
      label: t('resumeViewer.feedback.consLabel'),
      items: generationFeedback?.cons ?? [],
      rowClassName: 'border border-amber-200 bg-amber-50/70 px-3 py-3',
      labelClassName: 'text-amber-800',
      listClassName: 'text-amber-950',
    },
    {
      key: 'pros',
      label: t('resumeViewer.feedback.prosLabel'),
      items: generationFeedback?.pros ?? [],
      rowClassName: '',
      labelClassName: '',
      listClassName: '',
    },
    {
      key: 'caveats',
      label: t('resumeViewer.feedback.caveatsLabel'),
      items: generationFeedback?.caveats ?? [],
      rowClassName: '',
      labelClassName: '',
      listClassName: '',
    },
  ].filter((row) => row.items.length > 0);

  const displayFeedbackSummary = useMemo(() => {
    const rawSummary = generationFeedback?.summary?.trim();
    if (!rawSummary) return null;
    const withoutProvider = rawSummary.replace(/^[A-Z0-9][A-Z0-9 _-]{2,}:\s+/, '');
    const withoutPromptSetup = withoutProvider.replace(/\n?Prompt setup:[^\n]*$/i, '').trim();
    return withoutPromptSetup || null;
  }, [generationFeedback?.summary]);

  const displayPromptSetupFooter = useMemo(
    () => buildPromptSetupFooterText(generationFeedback),
    [generationFeedback]
  );

  const hasGenerationFeedback = Boolean(displayFeedbackSummary || feedbackRows.length > 0);

  if (loading) {
    return (
      <div className="skin-page-work flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-700 mb-4" />
        <p className="font-mono text-sm font-bold uppercase text-blue-700">
          {t('resumeViewer.loading')}
        </p>
      </div>
    );
  }

  if (error || !resumeData) {
    const isProcessing = processingStatus === 'processing';
    const isFailed = processingStatus === 'failed';

    return (
      <div className="skin-page-work flex min-h-screen flex-col items-center justify-center p-4">
        <div
          className={`border p-6 text-center max-w-md shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] ${
            isProcessing
              ? 'bg-blue-50 border-blue-200'
              : isFailed
                ? 'bg-orange-50 border-orange-200'
                : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex justify-center mb-4">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin text-blue-700" />
            ) : isFailed ? (
              <AlertCircle className="w-8 h-8 text-orange-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-600" />
            )}
          </div>
          <p
            className={`font-bold mb-4 ${
              isProcessing ? 'text-blue-700' : isFailed ? 'text-orange-700' : 'text-red-700'
            }`}
          >
            {error || t('resumeViewer.resumeNotFound')}
          </p>
          <div className="flex flex-col gap-2">
            {isFailed && (
              <>
                <Button onClick={handleRetryProcessing} disabled={isRetrying}>
                  {isRetrying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.processing')}
                    </>
                  ) : (
                    t('resumeViewer.retryProcessing')
                  )}
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  {t('resumeViewer.deleteAndStartOver')}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              {t('resumeViewer.returnToDashboard')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="skin-page-work min-h-screen overflow-y-auto px-4 py-12 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Actions */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
            {t('nav.backToDashboard')}
          </Button>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="w-4 h-4" />
              {t('dashboard.editResume')}
            </Button>
            <QuickLayoutControls
              dateDisplay={templateSettings.dateDisplay}
              experienceHeaderOrder={templateSettings.experienceHeaderOrder}
              fitOnePage={templateSettings.fitOnePage}
              onDateDisplayChange={handleDateDisplayChange}
              onExperienceHeaderOrderChange={handleExperienceHeaderOrderChange}
              onFitOnePageChange={handleFitOnePageChange}
              labels={{
                yearOnly: t('builder.formatting.yearOnlyDates'),
                yearOnlyHint: t('builder.formatting.yearOnlyDatesHint'),
                companyFirst: t('builder.formatting.companyFirst'),
                companyFirstHint: t('builder.formatting.companyFirstHint'),
                fitOnePage: t('preview.fitToOnePage'),
                fitOnePageHint: t('preview.fitToOnePageHint'),
              }}
              labelMode="compact"
            />
            <Button variant="success" onClick={handleDownload} disabled={isDownloading}>
              <Download className="w-4 h-4" />
              {isDownloading ? t('common.generating') : t('resumeViewer.downloadResume')}
            </Button>
          </div>
        </div>

        {/* Editable Title (tailored resumes only) */}
        {!isMasterResume && (
          <div className="mb-6 no-print">
            {isEditingTitle ? (
              <input
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
                autoFocus
                maxLength={80}
                placeholder={t('resumeViewer.titlePlaceholder')}
                className="w-full max-w-xl border-b border-border bg-transparent px-0 py-1 font-serif text-2xl font-bold tracking-[-0.04em] outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setEditingTitleValue(resumeTitle || '');
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-2 cursor-pointer bg-transparent border-none p-0"
              >
                <h2
                  className={`border-b border-transparent font-serif text-2xl font-bold tracking-[-0.04em] transition-colors group-hover:border-border ${!resumeTitle ? 'text-gray-400' : ''}`}
                >
                  {resumeTitle || t('resumeViewer.titlePlaceholder')}
                </h2>
                <Pencil
                  className={`w-4 h-4 transition-opacity ${resumeTitle ? 'opacity-0 group-hover:opacity-60' : 'opacity-40 group-hover:opacity-60'}`}
                />
              </button>
            )}
          </div>
        )}

        {!isMasterResume && (
          <div className="mb-6 no-print">
            <ImportContextCard
              context={importContext}
              linkedMasterResumeId={linkedMasterResumeId}
              onOpenMaster={
                linkedMasterResumeId ? () => router.push(`/resumes/${linkedMasterResumeId}`) : null
              }
            />
          </div>
        )}

        {hasGenerationFeedback && (
          <div className="mb-6 flex justify-center no-print">
            <div className="w-full max-w-[250mm] rounded-2xl border border-border bg-white px-5 py-4 shadow-sw-default">
              {displayFeedbackSummary && (
                <div className="mb-3 grid gap-2 md:grid-cols-[132px_minmax(0,1fr)] md:items-start">
                  <p className="pt-0.5 text-xs font-mono font-bold uppercase leading-[1.15] tracking-[0.14em] text-muted-foreground">
                    {t('resumeViewer.feedback.summaryLabel')}
                  </p>
                  <p className="text-sm leading-6 text-foreground">{displayFeedbackSummary}</p>
                </div>
              )}
              <div className="space-y-2 text-sm leading-5 text-foreground">
                {feedbackRows.map((row) => (
                  <div
                    key={row.key}
                    className={`grid gap-2 md:grid-cols-[132px_minmax(0,1fr)] md:items-start ${row.rowClassName}`}
                  >
                    <p
                      className={`pt-0.5 text-xs font-mono font-bold uppercase leading-[1.15] tracking-[0.14em] text-muted-foreground ${row.labelClassName}`}
                    >
                      {row.label}
                    </p>
                    <ul className={`list-disc space-y-0.5 pl-5 ${row.listClassName}`}>
                      {row.items.map((item, index) => (
                        <li key={`${row.key}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Resume Viewer */}
        <div ref={previewContainerRef} className="relative overflow-x-auto pb-4">
          {previewResumeData && (
            <>
              <div
                ref={baseMeasurementRef}
                className="absolute opacity-0 pointer-events-none"
                style={{
                  width: baseContentArea.width,
                  left: -9999,
                  top: 0,
                }}
                aria-hidden="true"
              >
                <ResumePrintContent
                  resumeData={previewResumeData}
                  settings={basePreviewPrintSettings}
                  additionalSectionLabels={additionalSectionLabels}
                  sectionHeadings={sectionHeadings}
                  fallbackLabels={fallbackLabels}
                />
              </div>
              <div
                ref={gentleMeasurementRef}
                className="absolute opacity-0 pointer-events-none"
                style={{
                  width: gentleContentArea.width,
                  left: -9999,
                  top: 0,
                }}
                aria-hidden="true"
              >
                <ResumePrintContent
                  resumeData={previewResumeData}
                  settings={gentlePrintSettings}
                  additionalSectionLabels={additionalSectionLabels}
                  sectionHeadings={sectionHeadings}
                  fallbackLabels={fallbackLabels}
                />
              </div>
              <div
                ref={balancedMeasurementRef}
                className="absolute opacity-0 pointer-events-none"
                style={{
                  width: balancedContentArea.width,
                  left: -9999,
                  top: 0,
                }}
                aria-hidden="true"
              >
                <ResumePrintContent
                  resumeData={previewResumeData}
                  settings={balancedPrintSettings}
                  additionalSectionLabels={additionalSectionLabels}
                  sectionHeadings={sectionHeadings}
                  fallbackLabels={fallbackLabels}
                />
              </div>
              <div
                ref={compactMeasurementRef}
                className="absolute opacity-0 pointer-events-none"
                style={{
                  width: compactContentArea.width,
                  left: -9999,
                  top: 0,
                }}
                aria-hidden="true"
              >
                <ResumePrintContent
                  resumeData={previewResumeData}
                  settings={compactPrintSettings}
                  additionalSectionLabels={additionalSectionLabels}
                  sectionHeadings={sectionHeadings}
                  fallbackLabels={fallbackLabels}
                />
              </div>
            </>
          )}

          <div className="flex flex-col items-center gap-4">
            {previewResumeData &&
              pages.map((page) => (
                <PageContainer
                  key={page.pageNumber}
                  pageSize={effectivePreviewSettings.pageSize}
                  margins={effectivePreviewSettings.margins}
                  pageNumber={page.pageNumber}
                  totalPages={pages.length}
                  scale={previewZoom}
                  showMarginGuides={false}
                  contentOffset={page.contentOffset}
                  contentEnd={page.contentEnd}
                >
                  <ResumePrintContent
                    resumeData={previewResumeData}
                    settings={previewPrintSettings}
                    additionalSectionLabels={additionalSectionLabels}
                    sectionHeadings={sectionHeadings}
                    fallbackLabels={fallbackLabels}
                  />
                </PageContainer>
              ))}
          </div>
        </div>

        {displayPromptSetupFooter && (
          <div className="mt-3 flex justify-center no-print">
            <p className="w-full max-w-[250mm] px-1 text-right font-mono text-[11px] leading-5 text-muted-foreground">
              {displayPromptSetupFooter}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-4 no-print">
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            {isMasterResume
              ? t('confirmations.deleteMasterResumeTitle')
              : t('dashboard.deleteResume')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={
          isMasterResume ? t('confirmations.deleteMasterResumeTitle') : t('dashboard.deleteResume')
        }
        description={
          isMasterResume
            ? t('confirmations.deleteMasterResumeDescription')
            : t('confirmations.deleteResumeFromSystemDescription')
        }
        confirmLabel={t('confirmations.deleteResumeConfirmLabel')}
        cancelLabel={t('confirmations.keepResumeCancelLabel')}
        onConfirm={handleDeleteResume}
        variant="danger"
      />

      <ConfirmDialog
        open={showDeleteSuccessDialog}
        onOpenChange={setShowDeleteSuccessDialog}
        title={t('resumeViewer.deletedTitle')}
        description={
          isMasterResume
            ? t('resumeViewer.deletedDescriptionMaster')
            : t('resumeViewer.deletedDescriptionRegular')
        }
        confirmLabel={t('resumeViewer.returnToDashboard')}
        onConfirm={handleDeleteSuccessConfirm}
        variant="success"
        showCancelButton={false}
      />

      {deleteError && (
        <ConfirmDialog
          open={!!deleteError}
          onOpenChange={() => setDeleteError(null)}
          title={t('resumeViewer.deleteFailedTitle')}
          description={deleteError}
          confirmLabel={t('common.ok')}
          onConfirm={() => setDeleteError(null)}
          variant="danger"
          showCancelButton={false}
        />
      )}
    </div>
  );
}
