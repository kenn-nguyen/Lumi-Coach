'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Eye, EyeOff, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ResumeData } from '@/components/dashboard/resume-component';
import {
  getFitOnePageEffectiveSettings,
  getFitOnePageModeForMeasurements,
  getFitOnePageVerticalScale,
  shouldRenderAsSingleFitPage,
  type FitOnePageMode,
  type TemplateSettings,
} from '@/lib/types/template-settings';
import { PageContainer } from './page-container';
import { QuickLayoutControls } from './quick-layout-controls';
import { ResumePrintContent } from './resume-print-content';
import { usePagination } from './use-pagination';
import { PAGE_DIMENSIONS, mmToPx, getContentAreaPx } from '@/lib/constants/page-dimensions';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface PaginatedPreviewProps {
  resumeData: ResumeData;
  settings: TemplateSettings;
  onSettingsChange?: (settings: TemplateSettings) => void;
  onResolvedLayoutChange?: (layout: {
    fitMode: FitOnePageMode;
    fitOnePageVerticalScale: number;
  }) => void;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;
const DEFAULT_AUTO_ZOOM = 1;

/**
 * PaginatedPreview shows a WYSIWYG preview of the resume with actual page dimensions,
 * margin guides, and automatic pagination.
 */
export function PaginatedPreview({
  resumeData,
  settings,
  onSettingsChange,
  onResolvedLayoutChange,
}: PaginatedPreviewProps) {
  const { t } = useTranslations();
  const baseMeasurementRef = useRef<HTMLDivElement>(null);
  const gentleMeasurementRef = useRef<HTMLDivElement>(null);
  const balancedMeasurementRef = useRef<HTMLDivElement>(null);
  const compactMeasurementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_AUTO_ZOOM);
  const [showMargins, setShowMargins] = useState(false);
  const [autoZoom, setAutoZoom] = useState(true);
  const baseResumeSettings: TemplateSettings = {
    ...settings,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  };
  const baseContentArea = getContentAreaPx(settings.pageSize, settings.margins);
  const {
    pages: basePages,
    totalContentHeight: baseTotalContentHeight,
    isCalculating: isBaseCalculating,
  } = usePagination({
    pageSize: settings.pageSize,
    margins: settings.margins,
    measurementRef: baseMeasurementRef,
  });
  const gentleSettings = getFitOnePageEffectiveSettings(settings, 'gentle');
  const balancedSettings = getFitOnePageEffectiveSettings(settings, 'balanced');
  const compactSettings = getFitOnePageEffectiveSettings(settings, 'compact');
  const gentleContentArea = getContentAreaPx(gentleSettings.pageSize, gentleSettings.margins);
  const balancedContentArea = getContentAreaPx(balancedSettings.pageSize, balancedSettings.margins);
  const compactContentArea = getContentAreaPx(compactSettings.pageSize, compactSettings.margins);
  const {
    pages: gentlePages,
    totalContentHeight: gentleTotalContentHeight,
    isCalculating: isGentleCalculating,
  } = usePagination({
    pageSize: gentleSettings.pageSize,
    margins: gentleSettings.margins,
    measurementRef: gentleMeasurementRef,
  });
  const {
    pages: balancedPages,
    totalContentHeight: balancedTotalContentHeight,
    isCalculating: isBalancedCalculating,
  } = usePagination({
    pageSize: balancedSettings.pageSize,
    margins: balancedSettings.margins,
    measurementRef: balancedMeasurementRef,
  });
  const {
    pages: compactPages,
    totalContentHeight: compactTotalContentHeight,
    isCalculating: isCompactCalculating,
  } = usePagination({
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
    settings.fitOnePage,
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
    settings.fitOnePage,
    baseContentRatio,
    selectedContentRatio
  );
  const shouldUseSingleFitPage = shouldRenderAsSingleFitPage(
    settings.fitOnePage,
    baseContentRatio,
    fitMode
  );
  const effectiveSettings = {
    ...getFitOnePageEffectiveSettings(settings, fitMode),
    fitOnePageVerticalScale,
  };
  const resumeSettings: TemplateSettings = {
    ...effectiveSettings,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  };
  const selectedPages =
    fitMode === 'gentle'
      ? gentlePages
      : fitMode === 'balanced'
        ? balancedPages
        : fitMode === 'compact'
          ? compactPages
          : basePages;
  const effectiveContentArea = getContentAreaPx(
    effectiveSettings.pageSize,
    effectiveSettings.margins
  );
  const visiblePages = shouldUseSingleFitPage
    ? [
        {
          pageNumber: 1,
          contentOffset: 0,
          contentEnd: effectiveContentArea.height,
        },
      ]
    : selectedPages;
  const isCalculating =
    isBaseCalculating || isGentleCalculating || isBalancedCalculating || isCompactCalculating;
  const shouldHighlightPageCount = !isCalculating && visiblePages.length > 1;

  useEffect(() => {
    if (!onResolvedLayoutChange || isCalculating) return;
    onResolvedLayoutChange({ fitMode, fitOnePageVerticalScale });
  }, [fitMode, fitOnePageVerticalScale, isCalculating, onResolvedLayoutChange]);

  const additionalSectionLabels = React.useMemo(
    () => ({
      technicalSkills: t('resume.additionalLabels.technicalSkills'),
      languages: t('resume.additionalLabels.languages'),
      certifications: t('resume.additionalLabels.certifications'),
      awards: t('resume.additionalLabels.awards'),
    }),
    [t]
  );
  const sectionHeadings = React.useMemo(
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
  const fallbackLabels = React.useMemo(
    () => ({
      name: t('resume.defaults.name'),
    }),
    [t]
  );

  // Calculate auto-zoom to fit container width
  const calculateAutoZoom = useCallback(() => {
    if (!containerRef.current || !autoZoom) return;

    const containerWidth = containerRef.current.clientWidth - 48; // Padding
    const pageWidthPx = mmToPx(PAGE_DIMENSIONS[settings.pageSize].width);
    const optimalZoom = Math.min(containerWidth / pageWidthPx, MAX_ZOOM);
    setZoom(Math.max(MIN_ZOOM, Math.min(optimalZoom, DEFAULT_AUTO_ZOOM)));
  }, [settings.pageSize, autoZoom]);

  // Auto-zoom on mount and when page size changes
  useEffect(() => {
    calculateAutoZoom();
    // Add resize listener
    const handleResize = () => calculateAutoZoom();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateAutoZoom]);

  const handleZoomIn = () => {
    setAutoZoom(false);
    setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setAutoZoom(false);
    setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  };

  const toggleMargins = () => setShowMargins((s) => !s);
  const handleFitOnePageChange = (fitOnePage: boolean) => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      fitOnePage,
    });
  };
  const handleDateDisplayChange = (dateDisplay: TemplateSettings['dateDisplay']) => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      dateDisplay,
    });
  };
  const handleExperienceHeaderOrderChange = (
    experienceHeaderOrder: TemplateSettings['experienceHeaderOrder']
  ) => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      experienceHeaderOrder,
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Controls bar */}
      <div className="flex items-center justify-between border-b border-border bg-[#ece6d8] px-4 py-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="h-8 w-8"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="font-mono text-xs w-12 text-center text-gray-600">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="h-8 w-8"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          <div className="mx-2 h-5 w-px bg-[#bcb3a3]" />

          {/* Margin toggle */}
          <Button
            variant={showMargins ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleMargins}
            className="h-8 gap-1.5"
          >
            {showMargins ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="font-mono text-xs uppercase">{t('preview.margins')}</span>
          </Button>
        </div>

        {/* Page count + fit toggle */}
        <div className="flex flex-wrap items-center justify-end gap-2 text-gray-600">
          <QuickLayoutControls
            dateDisplay={settings.dateDisplay}
            experienceHeaderOrder={settings.experienceHeaderOrder}
            fitOnePage={settings.fitOnePage}
            onDateDisplayChange={handleDateDisplayChange}
            onExperienceHeaderOrderChange={handleExperienceHeaderOrderChange}
            onFitOnePageChange={handleFitOnePageChange}
            labels={{
              yearOnly: t('preview.yearOnlyDates'),
              yearOnlyHint: t('preview.yearOnlyDatesHint'),
              companyFirst: t('preview.companyFirst'),
              companyFirstHint: t('preview.companyFirstHint'),
              fitOnePage: t('preview.fitToOnePage'),
              fitOnePageHint: t('preview.fitToOnePageHint'),
            }}
            disabled={!onSettingsChange}
            labelMode="compact"
          />
          <FileText className="w-4 h-4" />
          <span
            className={cn(
              'font-mono text-xs font-bold uppercase',
              shouldHighlightPageCount ? 'text-blue-700' : 'text-gray-600'
            )}
          >
            {isCalculating
              ? t('preview.calculating')
              : visiblePages.length === 1
                ? t('preview.pageCountSingular', { count: visiblePages.length })
                : t('preview.pageCountPlural', { count: visiblePages.length })}
          </span>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#ddd6c7] p-6"
        style={{
          backgroundImage:
            'linear-gradient(rgba(82,63,29,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(82,63,29,0.05) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* Hidden base measurement - used only to decide whether fit mode should engage. */}
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
            resumeData={resumeData}
            settings={baseResumeSettings}
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
            resumeData={resumeData}
            settings={{ ...gentleSettings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }}
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
            resumeData={resumeData}
            settings={{ ...balancedSettings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }}
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
            resumeData={resumeData}
            settings={{ ...compactSettings, margins: { top: 0, bottom: 0, left: 0, right: 0 } }}
            additionalSectionLabels={additionalSectionLabels}
            sectionHeadings={sectionHeadings}
            fallbackLabels={fallbackLabels}
          />
        </div>

        {/* Visible pages */}
        <div className="flex flex-col items-center gap-4">
          {visiblePages.map((page, index) => (
            <React.Fragment key={page.pageNumber}>
              {index > 0 && (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-px w-8 bg-gray-400" />
                  <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
                    {t('preview.pageBreak')}
                  </span>
                  <div className="h-px w-8 bg-gray-400" />
                </div>
              )}
              <PageContainer
                pageSize={effectiveSettings.pageSize}
                margins={effectiveSettings.margins}
                pageNumber={page.pageNumber}
                totalPages={visiblePages.length}
                scale={zoom}
                showMarginGuides={showMargins}
                contentOffset={page.contentOffset}
                contentEnd={page.contentEnd}
              >
                <ResumePrintContent
                  resumeData={resumeData}
                  settings={resumeSettings}
                  additionalSectionLabels={additionalSectionLabels}
                  sectionHeadings={sectionHeadings}
                  fallbackLabels={fallbackLabels}
                />
              </PageContainer>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
