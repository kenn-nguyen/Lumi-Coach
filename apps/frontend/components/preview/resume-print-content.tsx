import React from 'react';
import Resume, {
  type ResumeData,
  type AdditionalSectionLabels,
  type ResumeSectionHeadings,
  type ResumeFallbackLabels,
} from '@/components/dashboard/resume-component';
import { type TemplateSettings } from '@/lib/types/template-settings';

interface ResumePrintContentProps {
  resumeData: ResumeData;
  settings: TemplateSettings;
  additionalSectionLabels?: Partial<AdditionalSectionLabels>;
  sectionHeadings?: Partial<ResumeSectionHeadings>;
  fallbackLabels?: Partial<ResumeFallbackLabels>;
  className?: string;
}

/**
 * Shared render core for both builder preview and print route.
 * Keeping this wrapper identical reduces drift between what the user sees
 * in the builder and what Chromium ultimately prints to PDF.
 */
export function ResumePrintContent({
  resumeData,
  settings,
  additionalSectionLabels,
  sectionHeadings,
  fallbackLabels,
  className,
}: ResumePrintContentProps) {
  return (
    <div className={['resume-print bg-white', className].filter(Boolean).join(' ')}>
      <Resume
        resumeData={resumeData}
        template={settings.template}
        settings={settings}
        additionalSectionLabels={additionalSectionLabels}
        sectionHeadings={sectionHeadings}
        fallbackLabels={fallbackLabels}
      />
    </div>
  );
}
