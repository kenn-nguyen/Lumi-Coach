'use client';

import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileJson, AlertCircle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { importTailoredResumeJson } from '@/lib/api/resume';

interface ResumeJsonImportDialogProps {
  trigger?: React.ReactNode | null;
  disabled?: boolean;
  onImportComplete?: (payload: { resumeId: string }) => void;
}

export function ResumeJsonImportDialog({
  trigger,
  disabled = false,
  onImportComplete,
}: ResumeJsonImportDialogProps) {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jdUrl, setJdUrl] = useState('');
  const [jdText, setJdText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileLabel = useMemo(() => {
    if (!selectedFile) return t('dashboard.importResumeJson.fileEmpty');
    const sizeKb = Math.max(1, Math.round(selectedFile.size / 1024));
    return `${selectedFile.name} (${sizeKb} KB)`;
  }, [selectedFile, t]);

  const resetForm = () => {
    setSelectedFile(null);
    setJdUrl('');
    setJdText('');
    setError(null);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError(t('dashboard.importResumeJson.fileRequired'));
      return;
    }
    if (!jdText.trim()) {
      setError(t('dashboard.importResumeJson.jdTextRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await importTailoredResumeJson(selectedFile, jdUrl, jdText);
      setOpen(false);
      resetForm();
      onImportComplete?.({ resumeId: response.resume_id });
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : t('dashboard.importResumeJson.failed');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" disabled={disabled}>
              <Upload className="mr-2 h-4 w-4" />
              {t('dashboard.importResumeJson.button')}
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="border-b border-border bg-white p-6">
          <DialogTitle className="font-serif text-2xl font-bold">
            {t('dashboard.importResumeJson.title')}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-5 bg-[#faf7ef] p-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="resume-json-file"
              className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gray-700"
            >
              {t('dashboard.importResumeJson.fileLabel')}
            </label>
            <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
              <input
                id="resume-json-file"
                type="file"
                accept=".json,application/json,text/json"
                onChange={(event) => {
                  setError(null);
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
                className="block w-full font-mono text-sm"
              />
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <FileJson className="h-4 w-4" />
                <span>{fileLabel}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="resume-json-jd-url"
              className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gray-700"
            >
              {t('dashboard.importResumeJson.jdUrlLabel')}
            </label>
            <input
              id="resume-json-jd-url"
              type="url"
              value={jdUrl}
              onChange={(event) => setJdUrl(event.target.value)}
              placeholder={t('dashboard.importResumeJson.jdUrlPlaceholder')}
              className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="resume-json-jd-text"
              className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gray-700"
            >
              {t('dashboard.importResumeJson.jdTextLabel')}
            </label>
            <textarea
              id="resume-json-jd-text"
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.stopPropagation();
              }}
              placeholder={t('dashboard.importResumeJson.jdTextPlaceholder')}
              rows={7}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-primary"
            />
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('dashboard.importResumeJson.submit')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
