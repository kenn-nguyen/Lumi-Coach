'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Eye, EyeOff, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { type TemplateSettings } from '@/lib/types/template-settings';
import { PageContainer } from './page-container';
import { ResumePrintContent } from './resume-print-content';
import { usePagination } from './use-pagination';
import { PAGE_DIMENSIONS, mmToPx, getContentAreaPx } from '@/lib/constants/page-dimensions';
import { useTranslations } from '@/lib/i18n';

interface PaginatedPreviewProps {
  resumeData: ResumeData;
  settings: TemplateSettings;
  onSettingsChange?: (settings: TemplateSettings) => void;
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
}: PaginatedPreviewProps) {
  const { t } = useTranslations();
  const measurementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(DEFAULT_AUTO_ZOOM);
  const [showMargins, setShowMargins] = useState(false);
  const [autoZoom, setAutoZoom] = useState(true);
  const resumeSettings: TemplateSettings = {
    ...settings,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  };

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

  const { pages, isCalculating } = usePagination({
    pageSize: settings.pageSize,
    margins: settings.margins,
    measurementRef,
  });

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
  const toggleFitOnePage = (nextChecked?: boolean) => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      fitOnePage: typeof nextChecked === 'boolean' ? nextChecked : !settings.fitOnePage,
    });
  };
  const toggleDateDisplay = (nextChecked?: boolean) => {
    if (!onSettingsChange) return;
    const checked =
      typeof nextChecked === 'boolean' ? nextChecked : settings.dateDisplay !== 'year-only';
    onSettingsChange({
      ...settings,
      dateDisplay: checked ? 'year-only' : 'month-year',
    });
  };

  // Get content area dimensions for the hidden measurement container
  const contentArea = getContentAreaPx(settings.pageSize, settings.margins);
  const measuredContentHeight = pages[pages.length - 1]?.contentEnd ?? contentArea.height;
  const fitContentScale =
    settings.fitOnePage && pages.length > 0
      ? Math.max(0.1, Math.min(1, contentArea.height / Math.max(1, measuredContentHeight)))
      : 1;
  const visiblePages = settings.fitOnePage
    ? [
        {
          pageNumber: 1,
          contentOffset: 0,
          contentEnd: Math.max(1, measuredContentHeight),
        },
      ]
    : pages;

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
          <div title={t('preview.yearOnlyDatesHint')}>
            <ToggleSwitch
              checked={settings.dateDisplay === 'year-only'}
              onCheckedChange={toggleDateDisplay}
              label={t('preview.yearOnlyDates')}
              display="inline"
              disabled={!onSettingsChange}
            />
          </div>
          <div title={t('preview.fitToOnePageHint')}>
            <ToggleSwitch
              checked={settings.fitOnePage}
              onCheckedChange={toggleFitOnePage}
              label={t('preview.fitToOnePage')}
              display="inline"
              disabled={!onSettingsChange}
              className={
                !isCalculating && !settings.fitOnePage && pages.length > 1
                  ? '[&_span:last-child]:text-blue-700 [&_span:last-child]:font-bold'
                  : ''
              }
            />
          </div>
          <FileText className="w-4 h-4" />
          <span className="font-mono text-xs uppercase">
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
        {/* Hidden measurement container - renders content at actual size */}
        <div
          ref={measurementRef}
          className="absolute opacity-0 pointer-events-none"
          style={{
            width: contentArea.width,
            left: -9999,
            top: 0,
          }}
          aria-hidden="true"
        >
          <ResumePrintContent
            resumeData={resumeData}
            settings={resumeSettings}
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
                pageSize={settings.pageSize}
                margins={settings.margins}
                pageNumber={page.pageNumber}
                totalPages={visiblePages.length}
                scale={zoom}
                showMarginGuides={showMargins}
                contentOffset={page.contentOffset}
                contentEnd={page.contentEnd}
                contentScale={settings.fitOnePage ? fitContentScale : 1}
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
