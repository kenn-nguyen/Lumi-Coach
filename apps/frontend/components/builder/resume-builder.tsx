'use client';

import React, { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { ResumeForm } from './resume-form';
import { FormattingControls } from './formatting-controls';
import { CoverLetterEditor } from './cover-letter-editor';
import { OutreachEditor } from './outreach-editor';
import { CoverLetterPreview } from './cover-letter-preview';
import { OutreachPreview } from './outreach-preview';
import { GeneratePrompt } from './generate-prompt';
import { Button } from '@/components/ui/button';
import { RetroTabs } from '@/components/ui/retro-tabs';
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/ui/confirm-dialog';
import {
  Download,
  Save,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Copy,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useResumePreview } from '@/components/common/resume_previewer_context';
import { PaginatedPreview } from '@/components/preview';
import {
  downloadResumePdf,
  downloadCoverLetterPdf,
  getResumePdfUrl,
  getCoverLetterPdfUrl,
  fetchResume,
  type GenerationArtifacts,
  updateResume,
  updateCoverLetter,
  updateJobDescription,
  updateOutreachMessage,
  generateCoverLetter,
  generateOutreachMessage,
  fetchJobDescription,
} from '@/lib/api/resume';
import { JDComparisonView } from './jd-comparison-view';
import { StrategyMatchView } from './strategy-match-view';
import { RegenerateWizard } from './regenerate-wizard';
import { useRegenerateWizard } from '@/hooks/use-regenerate-wizard';
import { useTranslations } from '@/lib/i18n';
import { type TemplateSettings, DEFAULT_TEMPLATE_SETTINGS } from '@/lib/types/template-settings';
import { withLocalizedDefaultSections } from '@/lib/utils/section-helpers';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/context/language-context';
import { buildResumeFilename, downloadBlobAsFile, openUrlInNewTab } from '@/lib/utils/download';
import type { RegenerateItemInput } from '@/lib/api/enrichment';

type TabId = 'resume' | 'cover-letter' | 'outreach' | 'jd-match' | 'ai-strategy-match';

const STORAGE_KEY = 'resume_builder_draft';
const SETTINGS_STORAGE_KEY = 'resume_builder_settings';
const SPLIT_STORAGE_KEY = 'resume_builder_editor_width';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const buildInitialData = (t: Translate): ResumeData => ({
  personalInfo: {
    name: t('builder.personalInfoForm.placeholders.name'),
    title: t('builder.personalInfoForm.placeholders.title'),
    customTagline: t('builder.personalInfoForm.placeholders.customTagline'),
    email: t('builder.personalInfoForm.placeholders.email'),
    phone: t('builder.personalInfoForm.placeholders.phone'),
    location: t('builder.personalInfoForm.placeholders.location'),
    website: t('builder.personalInfoForm.placeholders.website'),
    linkedin: t('builder.personalInfoForm.placeholders.linkedin'),
    github: t('builder.personalInfoForm.placeholders.github'),
  },
  summary: t('builder.placeholders.summary'),
  workExperience: [],
  education: [],
  personalProjects: [],
  additional: {
    technicalSkills: [],
    languages: [],
    certificationsTraining: [],
    awards: [],
  },
});

const ResumeBuilderContent = () => {
  const { t } = useTranslations();
  const { uiLanguage, contentLanguage } = useLanguage();
  const [notificationDialog, setNotificationDialog] = useState<{
    title: string;
    description: string;
    variant: NonNullable<ConfirmDialogProps['variant']>;
  } | null>(null);

  const showNotification = useCallback(
    (
      description: string,
      variant: NonNullable<ConfirmDialogProps['variant']> = 'default',
      title?: string
    ) => {
      const fallbackTitle = variant === 'success' ? t('common.success') : t('common.error');
      setNotificationDialog({
        title: title ?? fallbackTitle,
        description,
        variant,
      });
    },
    [t]
  );

  const initialData = useMemo(() => buildInitialData(t), [t]);
  const [resumeData, setResumeData] = useState<ResumeData>(() => initialData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<ResumeData>(() => initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [, setLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [templateSettings, setTemplateSettings] =
    useState<TemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const { improvedData } = useResumePreview();
  const improvedPreview = improvedData?.data?.resume_preview;
  const improvedCoverLetter = improvedData?.data?.cover_letter;
  const improvedOutreach = improvedData?.data?.outreach_message;
  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeId = searchParams.get('id');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(() => {
    if (typeof window === 'undefined') return 48;
    const saved = Number.parseFloat(window.localStorage.getItem(SPLIT_STORAGE_KEY) || '');
    return Number.isFinite(saved) ? Math.min(60, Math.max(32, saved)) : 48;
  });
  const [isResizingPanels, setIsResizingPanels] = useState(false);
  const [isDesktopSplit, setIsDesktopSplit] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopSplit(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (resumeId || hasUnsavedChanges || improvedPreview) {
      return;
    }
    const savedDraft = localStorage.getItem(STORAGE_KEY);
    if (savedDraft) {
      return;
    }
    setResumeData(initialData);
    setLastSavedData(initialData);
  }, [initialData, resumeId, hasUnsavedChanges, improvedPreview]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('resume');

  // Cover letter & outreach state
  const [coverLetter, setCoverLetter] = useState('');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [isCoverLetterSaving, setIsCoverLetterSaving] = useState(false);
  const [isOutreachSaving, setIsOutreachSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [resumeTitle, setResumeTitle] = useState<string | null>(null);
  const [masterResumeData, setMasterResumeData] = useState<ResumeData | null>(null);
  const [generationArtifacts, setGenerationArtifacts] = useState<GenerationArtifacts | null>(null);

  // On-demand generation state
  const [isTailoredResume, setIsTailoredResume] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState<
    'cover-letter' | 'outreach' | null
  >(null);

  // JD comparison state
  const [storedJobDescription, setStoredJobDescription] = useState<string | null>(null);
  const [draftJobDescription, setDraftJobDescription] = useState<string | null>(null);
  const [isSavingJobDescription, setIsSavingJobDescription] = useState(false);

  // AI Regenerate wizard
  const regenerateWizard = useRegenerateWizard({
    resumeId: resumeId || '',
    outputLanguage: contentLanguage,
    onSuccess: async () => {
      // Reload resume data after applying changes
      if (!resumeId) {
        return;
      }

      try {
        const data = await fetchResume(resumeId);
        // Update resume title for downloads
        setResumeTitle(data.title ?? null);
        setGenerationArtifacts(data.generation_artifacts ?? null);
        if (data.processed_resume) {
          setResumeData(data.processed_resume as ResumeData);
          setLastSavedData(data.processed_resume as ResumeData);
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error('Failed to reload resume after applying regenerated changes:', error);
        showNotification(t('builder.alerts.reloadFailed'), 'danger');
        throw error;
      }
    },
    onError: (errorMessage) => {
      console.error('Error during regeneration or applying regenerated changes:', errorMessage);

      if (/network|fetch/i.test(errorMessage) || errorMessage.includes('Failed to fetch')) {
        showNotification(t('builder.regenerate.errors.networkError'), 'danger');
        return;
      }

      if (/resume content changed|uniquely matched|please regenerate/i.test(errorMessage)) {
        showNotification(t('builder.regenerate.errors.resumeChanged'), 'danger');
        return;
      }

      if (/generate/i.test(errorMessage)) {
        showNotification(t('builder.regenerate.errors.generationFailed'), 'danger');
        return;
      }

      showNotification(t('builder.regenerate.errors.applyFailed'), 'danger');
    },
  });

  // Build regenerate items from resume data
  const experienceItemsForRegenerate: RegenerateItemInput[] = useMemo(() => {
    return (resumeData.workExperience || []).map((exp, idx) => ({
      item_id: `exp_${idx}`,
      item_type: 'experience' as const,
      title: exp.title ?? '',
      subtitle: exp.company || undefined,
      current_content: Array.isArray(exp.description) ? exp.description : [],
    }));
  }, [resumeData.workExperience]);

  const projectItemsForRegenerate: RegenerateItemInput[] = useMemo(() => {
    return (resumeData.personalProjects || []).map((proj, idx) => ({
      item_id: `proj_${idx}`,
      item_type: 'project' as const,
      title: proj.name ?? '',
      subtitle: proj.role || undefined,
      current_content: Array.isArray(proj.description) ? proj.description : [],
    }));
  }, [resumeData.personalProjects]);

  const skillsItemForRegenerate: RegenerateItemInput | null = useMemo(() => {
    const skills = resumeData.additional?.technicalSkills;
    if (skills && skills.length > 0) {
      return {
        item_id: 'skills',
        item_type: 'skills' as const,
        title: t('builder.regenerate.selectDialog.skills'),
        current_content: skills,
      };
    }
    return null;
  }, [resumeData.additional?.technicalSkills, t]);

  const localizedResumeDataForPreview = useMemo(
    () => withLocalizedDefaultSections(resumeData, t),
    [resumeData, t]
  );

  // Load template settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setTemplateSettings({
          ...DEFAULT_TEMPLATE_SETTINGS,
          ...parsed,
          margins: { ...DEFAULT_TEMPLATE_SETTINGS.margins, ...parsed.margins },
          spacing: { ...DEFAULT_TEMPLATE_SETTINGS.spacing, ...parsed.spacing },
          fontSize: { ...DEFAULT_TEMPLATE_SETTINGS.fontSize, ...parsed.fontSize },
        });
      } catch {
        // Use defaults
      }
    }
  }, []);

  // Save template settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(templateSettings));
  }, [templateSettings]);

  useEffect(() => {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(editorWidthPercent));
  }, [editorWidthPercent]);

  useEffect(() => {
    if (!isResizingPanels) return;

    const handleMouseMove = (event: MouseEvent) => {
      const container = workspaceRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextPercent = ((event.clientX - rect.left) / rect.width) * 100;
      setEditorWidthPercent(Math.min(60, Math.max(32, nextPercent)));
    };

    const handleMouseUp = () => {
      setIsResizingPanels(false);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingPanels]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const loadResumeData = async () => {
      setLoadingState('loading');

      // Priority 1: Fetch from API if ID is in URL (most reliable)
      if (resumeId) {
        try {
          const data = await fetchResume(resumeId);
          // Track if this is a tailored resume (has parent_id)
          setIsTailoredResume(Boolean(data.parent_id));
          if (data.parent_id) {
            try {
              const parentData = await fetchResume(data.parent_id);
              setMasterResumeData((parentData.processed_resume as ResumeData) ?? null);
            } catch (parentError) {
              console.warn('Failed to load parent resume for original bullet lookup:', parentError);
              setMasterResumeData(null);
            }
          } else {
            setMasterResumeData(null);
          }
          // Store resume title for downloads
          setResumeTitle(data.title ?? null);
          setGenerationArtifacts(data.generation_artifacts ?? null);
          // Load cover letter and outreach message if available
          if (data.cover_letter) {
            setCoverLetter(data.cover_letter);
          }
          if (data.outreach_message) {
            setOutreachMessage(data.outreach_message);
          }
          // Prefer processed_resume if available
          if (data.processed_resume) {
            setResumeData(data.processed_resume as ResumeData);
            setLastSavedData(data.processed_resume as ResumeData);
            setLoadingState('loaded');
            return;
          }
          // Fallback to parsing raw content
          if (data.raw_resume?.content) {
            try {
              const parsed = JSON.parse(data.raw_resume.content);
              setResumeData(parsed);
              setLastSavedData(parsed);
              setLoadingState('loaded');
              return;
            } catch {
              // Raw content is markdown, not JSON
            }
          }
        } catch (err) {
          console.error('Failed to load resume from API:', err);
        }
      }

      // Priority 2: Improved Data from Context (Tailor Flow)
      if (improvedPreview) {
        setResumeData(improvedPreview);
        setLastSavedData(improvedPreview);
        setMasterResumeData(null);
        setGenerationArtifacts(null);
        // Also load cover letter and outreach if present
        if (improvedCoverLetter) {
          setCoverLetter(improvedCoverLetter);
        }
        if (improvedOutreach) {
          setOutreachMessage(improvedOutreach);
        }
        // Persist to localStorage as backup
        localStorage.setItem(STORAGE_KEY, JSON.stringify(improvedPreview));
        setLoadingState('loaded');
        return;
      }

      // Priority 3: Restore from localStorage (browser refresh recovery)
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setResumeData(parsed);
          setLastSavedData(parsed);
          setGenerationArtifacts(null);
          setHasUnsavedChanges(true); // Mark as unsaved since it's a draft
          setLoadingState('loaded');
          return;
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Fallback: Use initial data
      setGenerationArtifacts(null);
      setLoadingState('loaded');
    };

    loadResumeData();
  }, [improvedPreview, improvedCoverLetter, improvedOutreach, resumeId]);

  // Fetch job description when we have a tailored resume
  useEffect(() => {
    let cancelled = false;

    const loadJobDescription = async () => {
      if (isTailoredResume && resumeId) {
        try {
          const data = await fetchJobDescription(resumeId);
          if (!cancelled) {
            setStoredJobDescription(data.content);
            setDraftJobDescription(data.content);
          }
        } catch (err) {
          // JD might not be available for older resumes
          if (!cancelled) {
            console.warn('Could not fetch job description:', err);
            setStoredJobDescription(null);
            setDraftJobDescription(null);
          }
        }
      } else {
        // Clear job description when switching to non-tailored resume
        setStoredJobDescription(null);
        setDraftJobDescription(null);
      }
    };

    loadJobDescription();
    return () => {
      cancelled = true;
    };
  }, [isTailoredResume, resumeId]);

  const handleResetJobDescription = useCallback(() => {
    setDraftJobDescription(storedJobDescription);
  }, [storedJobDescription]);

  const handleSaveJobDescription = useCallback(async () => {
    if (!resumeId || !draftJobDescription) {
      return;
    }

    try {
      setIsSavingJobDescription(true);
      const updated = await updateJobDescription(resumeId, draftJobDescription);
      setStoredJobDescription(updated.content);
      setDraftJobDescription(updated.content);
      showNotification(t('builder.jdMatch.saveSuccess'), 'success');
    } catch (error) {
      console.error('Failed to update job description:', error);
      const message = error instanceof Error ? error.message : t('common.error');
      showNotification(
        t('builder.jdMatch.saveFailed', { error: message }),
        'danger'
      );
    } finally {
      setIsSavingJobDescription(false);
    }
  }, [draftJobDescription, resumeId, showNotification, t]);

  const handleUpdate = useCallback((newData: ResumeData) => {
    setResumeData(newData);
    setHasUnsavedChanges(true);
    // Auto-save draft to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  }, []);

  const handleSettingsChange = useCallback((newSettings: TemplateSettings) => {
    setTemplateSettings(newSettings);
  }, []);

  const handleSave = async () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.saveNotAvailable'), 'warning');
      return;
    }
    try {
      setIsSaving(true);
      const updated = await updateResume(resumeId, resumeData);
      const nextData = (updated.processed_resume || resumeData) as ResumeData;
      setResumeData(nextData);
      setLastSavedData(nextData);
      setGenerationArtifacts(updated.generation_artifacts ?? null);
      setHasUnsavedChanges(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (error) {
      console.error('Failed to save resume:', error);
      showNotification(t('builder.alerts.saveFailed'), 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setResumeData(lastSavedData);
    setHasUnsavedChanges(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastSavedData));
  };

  const getCompanyFromTitle = (title: string | null | undefined): string | null => {
    if (!title) return null;
    const atIdx = title.lastIndexOf(' @ ');
    return atIdx !== -1 ? title.substring(atIdx + 3).trim() : null;
  };

  const handleDownload = async () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.downloadNotAvailable'), 'warning');
      return;
    }
    try {
      setIsDownloading(true);
      const blob = await downloadResumePdf(resumeId, templateSettings, uiLanguage);
      const company = getCompanyFromTitle(resumeTitle);
      const userName = resumeData.personalInfo?.name?.trim() || null;
      const filename = buildResumeFilename(userName, company, resumeId, 'resume');
      downloadBlobAsFile(blob, filename);
      showNotification(t('builder.alerts.downloadSuccess'), 'success');
    } catch (error) {
      console.error('Failed to download resume:', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const fallbackUrl = getResumePdfUrl(resumeId, templateSettings, uiLanguage);
        const didOpen = openUrlInNewTab(fallbackUrl);
        if (!didOpen) {
          showNotification(t('common.popupBlocked', { url: fallbackUrl }), 'warning');
        }
        return;
      }
      let errorMessage = t('builder.alerts.downloadFailed');
      if (error instanceof Error && error.message) {
        errorMessage = `${t('builder.alerts.downloadFailed')}: ${error.message}`;
      }
      showNotification(errorMessage, 'danger');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportJson = () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.downloadNotAvailable'), 'warning');
      return;
    }

    try {
      const userName = resumeData.personalInfo?.name?.trim() || null;
      const company = resumeTitle?.trim() || null;
      const filename = buildResumeFilename(userName, company, resumeId, 'resume').replace(
        /\.pdf$/i,
        '.json'
      );
      const jsonBlob = new Blob([JSON.stringify(resumeData, null, 2)], {
        type: 'application/json',
      });
      downloadBlobAsFile(jsonBlob, filename);
    } catch (error) {
      console.error('Failed to export resume JSON:', error);
      showNotification(t('builder.alerts.downloadFailed'), 'danger');
    }
  };

  // Cover letter handlers
  const handleSaveCoverLetter = async () => {
    if (!resumeId) return;
    try {
      setIsCoverLetterSaving(true);
      await updateCoverLetter(resumeId, coverLetter);
      showNotification(t('builder.alerts.coverLetterSaveSuccess'), 'success');
    } catch (error) {
      console.error('Failed to save cover letter:', error);
      showNotification(t('builder.alerts.coverLetterSaveFailed'), 'danger');
    } finally {
      setIsCoverLetterSaving(false);
    }
  };

  const handleDownloadCoverLetter = async () => {
    if (!resumeId) {
      showNotification(t('builder.alerts.coverLetterDownloadRequiresResume'), 'warning');
      return;
    }
    if (!coverLetter) {
      showNotification(t('builder.alerts.coverLetterMissing'), 'warning');
      return;
    }
    try {
      setIsDownloading(true);
      const blob = await downloadCoverLetterPdf(resumeId, templateSettings.pageSize, uiLanguage);
      const company = getCompanyFromTitle(resumeTitle);
      const userName = resumeData.personalInfo?.name?.trim() || null;
      const filename = buildResumeFilename(userName, company, resumeId, 'cover-letter');
      downloadBlobAsFile(blob, filename);
    } catch (error) {
      console.error('Failed to download cover letter:', error);
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const fallbackUrl = getCoverLetterPdfUrl(resumeId, templateSettings.pageSize, uiLanguage);
        const didOpen = openUrlInNewTab(fallbackUrl);
        if (!didOpen) {
          showNotification(t('common.popupBlocked', { url: fallbackUrl }), 'warning');
        }
        return;
      }
      const errorMessage = error instanceof Error ? error.message : t('common.unknown');
      showNotification(
        t('builder.alerts.coverLetterDownloadFailed', { error: errorMessage }),
        'danger'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // Outreach handlers
  const handleSaveOutreach = async () => {
    if (!resumeId) return;
    try {
      setIsOutreachSaving(true);
      await updateOutreachMessage(resumeId, outreachMessage);
      showNotification(t('builder.alerts.outreachSaveSuccess'), 'success');
    } catch (error) {
      console.error('Failed to save outreach message:', error);
      showNotification(t('builder.alerts.outreachSaveFailed'), 'danger');
    } finally {
      setIsOutreachSaving(false);
    }
  };

  const handleCopyOutreach = async () => {
    try {
      await navigator.clipboard.writeText(outreachMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // On-demand generation handlers
  const doGenerateCoverLetter = async () => {
    if (!resumeId) return;
    setIsGeneratingCoverLetter(true);
    setShowRegenerateDialog(null);
    try {
      const content = await generateCoverLetter(resumeId);
      setCoverLetter(content);
    } catch (error) {
      console.error('Failed to generate cover letter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(
        t('builder.alerts.coverLetterGenerateFailed', { error: errorMessage }),
        'danger'
      );
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleGenerateCoverLetter = () => {
    if (!resumeId) return;
    // If content exists, show confirmation dialog
    if (coverLetter) {
      setShowRegenerateDialog('cover-letter');
      return;
    }
    doGenerateCoverLetter();
  };

  const doGenerateOutreach = async () => {
    if (!resumeId) return;
    setIsGeneratingOutreach(true);
    setShowRegenerateDialog(null);
    try {
      const content = await generateOutreachMessage(resumeId);
      setOutreachMessage(content);
    } catch (error) {
      console.error('Failed to generate outreach message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(
        t('builder.alerts.outreachGenerateFailed', { error: errorMessage }),
        'danger'
      );
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const handleGenerateOutreach = () => {
    if (!resumeId) return;
    // If content exists, show confirmation dialog
    if (outreachMessage) {
      setShowRegenerateDialog('outreach');
      return;
    }
    doGenerateOutreach();
  };

  return (
    <div
      className="h-screen w-full bg-[#F0F0E8] flex justify-center items-center p-4 md:p-8"
      style={{
        backgroundImage:
          'linear-gradient(rgba(29, 78, 216, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 78, 216, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Main Container */}
      <div className="w-full h-full max-w-[90%] md:max-w-[95%] xl:max-w-[1800px] border border-black bg-[#F0F0E8] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] flex flex-col">
        {/* Header Section */}
        <div className="border-b border-black px-6 py-4 md:px-8 md:py-4 bg-[#F0F0E8] no-print">
          {/* Top Row: Back button and Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <Button
                variant="link"
                onClick={() => router.push('/dashboard')}
                className="-ml-1 mb-1"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('nav.backToDashboard')}
              </Button>
              <h1 className="font-serif text-3xl md:text-[2.75rem] text-black tracking-tight leading-[0.95] uppercase">
                {t('nav.builder')}
              </h1>
              <div className="mt-2 flex items-center gap-3">
                {hasUnsavedChanges && (
                  <span className="flex items-center gap-1 text-xs font-mono text-amber-600 bg-amber-50 px-2 py-1 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    {t('builder.unsavedDraft')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 md:justify-end">
              {/* Resume tab actions */}
              {activeTab === 'resume' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJson}
                    disabled={!resumeId}
                  >
                    Export JSON
                  </Button>
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={handleReset}
                    disabled={!hasUnsavedChanges}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('common.reset')}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!resumeId || isSaving}>
                    <Save className="w-4 h-4" />
                    {isSaving ? t('common.saving') : t('common.save')}
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!resumeId || isDownloading}
                  >
                    <Download className="w-4 h-4" />
                    {isDownloading ? t('common.generating') : t('common.download')}
                  </Button>
                </>
              )}

              {/* Cover letter tab actions */}
              {activeTab === 'cover-letter' && coverLetter && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateCoverLetter}
                    disabled={isGeneratingCoverLetter}
                  >
                    {isGeneratingCoverLetter ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {t('coverLetter.regenerate')}
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleDownloadCoverLetter}
                    disabled={!resumeId || isDownloading}
                  >
                    <Download className="w-4 h-4" />
                    {isDownloading ? t('common.generating') : t('common.download')}
                  </Button>
                </>
              )}

              {/* Outreach tab actions */}
              {activeTab === 'outreach' && outreachMessage && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateOutreach}
                    disabled={isGeneratingOutreach}
                  >
                    {isGeneratingOutreach ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {t('outreach.regenerate')}
                  </Button>
                  <Button variant="success" size="sm" onClick={handleCopyOutreach}>
                    {isCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t('outreach.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        {t('outreach.copyToClipboard')}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div
          ref={workspaceRef}
          className={cn(
            'flex flex-col lg:flex-row bg-black gap-[1px] flex-1 min-h-0',
            isResizingPanels && 'select-none'
          )}
        >
          {/* Left Panel: Editor */}
          <div
            className="bg-[#F0F0E8] p-6 md:p-7 overflow-y-auto no-print"
            style={isDesktopSplit ? { width: `${editorWidthPercent}%` } : undefined}
          >
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-700"></div>
                  <h2 className="font-mono text-base font-bold uppercase tracking-wider">
                    {activeTab === 'resume' && t('builder.leftPanel.editorPanel')}
                    {activeTab === 'cover-letter' && t('builder.leftPanel.coverLetterEditor')}
                    {activeTab === 'outreach' && t('builder.leftPanel.outreachEditor')}
                    {activeTab === 'jd-match' && t('builder.leftPanel.jdMatchAnalysis')}
                    {activeTab === 'ai-strategy-match' &&
                      t('builder.leftPanel.aiStrategyMatchAnalysis')}
                  </h2>
                </div>
                {activeTab === 'resume' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => regenerateWizard.startRegenerate()}
                    disabled={!resumeId}
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('builder.regenerate.buttonLabel')}
                  </Button>
                )}
              </div>

              {/* Resume Editor */}
              {activeTab === 'resume' && (
                <>
                  <FormattingControls settings={templateSettings} onChange={handleSettingsChange} />
                  <ResumeForm
                    resumeData={resumeData}
                    resumeId={resumeId}
                    linkedJobDescription={storedJobDescription ?? draftJobDescription ?? null}
                    masterPersonalInfo={masterResumeData?.personalInfo ?? null}
                    originalSummary={masterResumeData?.summary ?? null}
                    originalWorkExperience={masterResumeData?.workExperience || []}
                    onUpdate={handleUpdate}
                  />
                </>
              )}

              {/* Cover Letter Editor */}
              {activeTab === 'cover-letter' &&
                (coverLetter ? (
                  <CoverLetterEditor
                    content={coverLetter}
                    onChange={setCoverLetter}
                    onSave={handleSaveCoverLetter}
                    isSaving={isCoverLetterSaving}
                  />
                ) : (
                  <GeneratePrompt
                    type="cover-letter"
                    isGenerating={isGeneratingCoverLetter}
                    onGenerate={handleGenerateCoverLetter}
                    isTailoredResume={isTailoredResume}
                  />
                ))}

              {/* Outreach Editor */}
              {activeTab === 'outreach' &&
                (outreachMessage ? (
                  <OutreachEditor
                    content={outreachMessage}
                    onChange={setOutreachMessage}
                    onSave={handleSaveOutreach}
                    isSaving={isOutreachSaving}
                  />
                ) : (
                  <GeneratePrompt
                    type="outreach"
                    isGenerating={isGeneratingOutreach}
                    onGenerate={handleGenerateOutreach}
                    isTailoredResume={isTailoredResume}
                  />
                ))}

              {/* JD Match Info Panel */}
              {activeTab === 'jd-match' && (
                <div className="space-y-4">
                  <div className="border-2 border-black bg-white p-4">
                    <h3 className="font-mono text-sm font-bold uppercase mb-2">
                      {t('builder.jdMatch.aboutTitle')}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {t('builder.jdMatch.aboutDescription')}
                    </p>
                  </div>

                  <div className="border-2 border-black bg-[#F0F0E8] p-4">
                    <h3 className="font-mono text-sm font-bold uppercase mb-2">
                      {t('builder.jdMatch.highlightedKeywordsTitle')}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {(() => {
                        const template = t(
                          'builder.jdMatch.highlightedKeywordsDescriptionTemplate'
                        );
                        const parts = template.split('__COLOR__');
                        if (parts.length < 2) return template;
                        return (
                          <>
                            {parts[0]}
                            <mark className="bg-yellow-200 px-1">
                              {t('builder.jdMatch.highlightColor')}
                            </mark>
                            {parts.slice(1).join('__COLOR__')}
                          </>
                        );
                      })()}
                    </p>
                  </div>

                  <div className="border-2 border-black bg-white p-4">
                    <h3 className="font-mono text-sm font-bold uppercase mb-2">
                      {t('builder.jdMatch.tipsTitle')}
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>{t('builder.jdMatch.tips.items.addMissingKeywords')}</li>
                      <li>{t('builder.jdMatch.tips.items.focusTechnicalSkills')}</li>
                      <li>{t('builder.jdMatch.tips.items.matchActionVerbs')}</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'ai-strategy-match' && (
                <div className="space-y-4">
                  <div className="border-2 border-black bg-white p-4">
                    <h3 className="font-mono text-sm font-bold uppercase mb-2">
                      {t('builder.strategyMatch.aboutTitle')}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {t('builder.strategyMatch.aboutDescription')}
                    </p>
                  </div>

                  <div className="border-2 border-black bg-[#F0F0E8] p-4">
                    <h3 className="font-mono text-sm font-bold uppercase mb-2">
                      {t('builder.strategyMatch.highlightedKeywordsTitle')}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {t('builder.strategyMatch.highlightedKeywordsDescription')}
                    </p>
                  </div>

                  <div className="border-2 border-black bg-white p-4">
                    <h3 className="font-mono text-sm font-bold uppercase mb-2">
                      {t('builder.strategyMatch.tipsTitle')}
                    </h3>
                    <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                      <li>{t('builder.strategyMatch.tips.items.followStorylines')}</li>
                      <li>{t('builder.strategyMatch.tips.items.mirrorPriorityPhrases')}</li>
                      <li>{t('builder.strategyMatch.tips.items.reinforceSkills')}</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className="relative hidden lg:flex w-3 shrink-0 cursor-col-resize items-center justify-center bg-[#E5E5E0] no-print"
            onMouseDown={() => setIsResizingPanels(true)}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and preview panels"
          >
            <div
              className={cn(
                'h-full w-px bg-black transition-colors',
                isResizingPanels && 'bg-blue-700'
              )}
            />
            <div className="absolute flex h-10 w-3 items-center justify-center">
              <div className="h-6 w-[3px] bg-black/20" />
            </div>
          </div>

          {/* Right Panel: Preview with Tabs */}
          <div className="bg-[#E5E5E0] overflow-hidden flex flex-col no-print">
            {/* Tabs Header */}
            <div className="px-6 pt-3 shrink-0 bg-[#E5E5E0]">
              <RetroTabs
                tabs={[
                  { id: 'resume', label: t('builder.previewTabs.resume') },
                  {
                    id: 'cover-letter',
                    label: t('builder.previewTabs.coverLetter'),
                    disabled: !isTailoredResume,
                  },
                  {
                    id: 'outreach',
                    label: t('builder.previewTabs.outreach'),
                    disabled: !isTailoredResume,
                  },
                  {
                    id: 'jd-match',
                    label: t('builder.previewTabs.jdMatch'),
                    disabled: !draftJobDescription,
                  },
                  {
                    id: 'ai-strategy-match',
                    label: t('builder.previewTabs.aiStrategyMatch'),
                    disabled: !generationArtifacts?.prompt2,
                  },
                ]}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as TabId)}
              />
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Resume Preview */}
              {activeTab === 'resume' && (
                <PaginatedPreview
                  resumeData={localizedResumeDataForPreview}
                  settings={templateSettings}
                  onSettingsChange={handleSettingsChange}
                />
              )}

              {/* Cover Letter Preview */}
              {activeTab === 'cover-letter' &&
                (coverLetter && resumeData.personalInfo ? (
                  <div className="p-6">
                    <CoverLetterPreview
                      content={coverLetter}
                      personalInfo={resumeData.personalInfo}
                      pageSize={templateSettings.pageSize}
                    />
                  </div>
                ) : (
                  <GeneratePrompt
                    type="cover-letter"
                    isGenerating={isGeneratingCoverLetter}
                    onGenerate={handleGenerateCoverLetter}
                    isTailoredResume={isTailoredResume}
                  />
                ))}

              {/* Outreach Preview */}
              {activeTab === 'outreach' &&
                (outreachMessage ? (
                  <div className="p-6">
                    <OutreachPreview content={outreachMessage} />
                  </div>
                ) : (
                  <GeneratePrompt
                    type="outreach"
                    isGenerating={isGeneratingOutreach}
                    onGenerate={handleGenerateOutreach}
                    isTailoredResume={isTailoredResume}
                  />
                ))}

              {/* JD Match Comparison */}
              {activeTab === 'jd-match' && draftJobDescription && (
                <JDComparisonView
                  jobDescription={draftJobDescription}
                  storedJobDescription={storedJobDescription ?? ''}
                  resumeData={resumeData}
                  onJobDescriptionChange={(value) => setDraftJobDescription(value)}
                  onResetJobDescription={handleResetJobDescription}
                  onSaveJobDescription={handleSaveJobDescription}
                  isSavingJobDescription={isSavingJobDescription}
                />
              )}

              {activeTab === 'ai-strategy-match' && generationArtifacts?.prompt2 && (
                <StrategyMatchView
                  prompt2Artifact={generationArtifacts.prompt2}
                  resumeData={resumeData}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F0F0E8] flex justify-between items-center font-mono text-xs text-blue-700 border-t border-black no-print">
          <span className="uppercase font-bold flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="Resume Matcher"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            {t('builder.footer.moduleLabel')}
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-700"></div>
              <span className="uppercase">
                {templateSettings.template === 'swiss-single' ||
                templateSettings.template === 'modern'
                  ? t('builder.footer.singleColumn')
                  : t('builder.footer.twoColumn')}
              </span>
            </div>
            <span className="text-gray-400">|</span>
            <span className="uppercase">
              {templateSettings.pageSize === 'A4' ? 'A4' : t('builder.pageSize.usLetter')}
            </span>
          </div>
        </div>
      </div>

      {/* Regenerate Confirmation Dialog */}
      <ConfirmDialog
        open={showRegenerateDialog !== null}
        onOpenChange={(open) => !open && setShowRegenerateDialog(null)}
        title={t('builder.regenerateDialog.title', {
          title:
            showRegenerateDialog === 'cover-letter' ? t('coverLetter.title') : t('outreach.title'),
        })}
        description={t('builder.regenerateDialog.description', {
          title:
            showRegenerateDialog === 'cover-letter' ? t('coverLetter.title') : t('outreach.title'),
        })}
        confirmLabel={
          showRegenerateDialog === 'cover-letter'
            ? t('coverLetter.regenerate')
            : t('outreach.regenerate')
        }
        cancelLabel={t('common.cancel')}
        variant="warning"
        onConfirm={
          showRegenerateDialog === 'cover-letter' ? doGenerateCoverLetter : doGenerateOutreach
        }
      />

      {/* Notification Dialog (replaces native alert()) */}
      <ConfirmDialog
        open={notificationDialog !== null}
        onOpenChange={(open) => !open && setNotificationDialog(null)}
        title={notificationDialog?.title ?? ''}
        description={notificationDialog?.description ?? ''}
        confirmLabel={t('common.ok')}
        showCancelButton={false}
        variant={notificationDialog?.variant ?? 'default'}
        onConfirm={() => setNotificationDialog(null)}
      />

      {/* AI Regenerate Wizard */}
      <RegenerateWizard
        step={regenerateWizard.step}
        onStepChange={regenerateWizard.setStep}
        experienceItems={experienceItemsForRegenerate}
        projectItems={projectItemsForRegenerate}
        skillsItem={skillsItemForRegenerate}
        selectedItems={regenerateWizard.selectedItems}
        onSelectionChange={regenerateWizard.setSelectedItems}
        instruction={regenerateWizard.instruction}
        onInstructionChange={regenerateWizard.setInstruction}
        regeneratedItems={regenerateWizard.regeneratedItems}
        regenerateErrors={regenerateWizard.regenerateErrors}
        isGenerating={regenerateWizard.isGenerating}
        isApplying={regenerateWizard.isApplying}
        error={regenerateWizard.error}
        onGenerate={regenerateWizard.generate}
        onAccept={regenerateWizard.acceptChanges}
        onReject={regenerateWizard.rejectAndRegenerate}
        onClose={regenerateWizard.reset}
      />
    </div>
  );
};

export const ResumeBuilder = () => {
  const { t } = useTranslations();
  return (
    <Suspense fallback={<div>{t('common.loading')}</div>}>
      <ResumeBuilderContent />
    </Suspense>
  );
};
