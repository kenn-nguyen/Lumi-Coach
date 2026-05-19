'use client';

import React from 'react';
import type { ResumeImportContext } from '@/lib/api/resume';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface ImportContextCardProps {
  context: ResumeImportContext | null | undefined;
  linkedMasterResumeId?: string | null;
  onOpenMaster?: (() => void) | null;
  className?: string;
}

export function ImportContextCard({
  context,
  linkedMasterResumeId,
  onOpenMaster,
  className = '',
}: ImportContextCardProps) {
  const { t } = useTranslations();

  const jdUrl = context?.jd_url?.trim() || '';
  const jdText = context?.jd_text?.trim() || '';
  const hasContext = Boolean(jdUrl || jdText || linkedMasterResumeId);

  if (!hasContext) {
    return null;
  }

  return (
    <div className={`rounded-2xl border border-border bg-white p-4 shadow-xs ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gray-600">
            {t('resumeImportContext.label')}
          </p>
          <p className="mt-1 text-sm text-gray-600">{t('resumeImportContext.description')}</p>
        </div>
        {linkedMasterResumeId && onOpenMaster ? (
          <Button variant="outline" size="sm" onClick={onOpenMaster}>
            {t('resumeImportContext.openMaster')}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {jdUrl ? (
          <div>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
              {t('resumeImportContext.jdUrlLabel')}
            </p>
            <a
              href={jdUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all text-sm text-blue-700 underline underline-offset-2"
            >
              {jdUrl}
            </a>
          </div>
        ) : null}

        {jdText ? (
          <details className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
            <summary className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-600">
              {t('resumeImportContext.jdTextLabel')}
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{jdText}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}
