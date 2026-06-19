'use client';

import React, { useId, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileText, AlertCircle } from 'lucide-react';
import { importMasterResume } from '@/lib/api/resume';
import { useStatusCache } from '@/lib/context/status-cache';

interface ImportMasterResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (payload: { resumeId: string }) => void;
}

export function ImportMasterResumeDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ImportMasterResumeDialogProps) {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status: systemStatus } = useStatusCache();

  const fileLabel = useMemo(() => {
    if (!selectedFile) return 'No file chosen';
    const sizeKb = Math.max(1, Math.round(selectedFile.size / 1024));
    return `${selectedFile.name} (${sizeKb} KB)`;
  }, [selectedFile]);

  const resetForm = () => {
    setSelectedFile(null);
    setError(null);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) resetForm();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Please choose a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await importMasterResume(selectedFile);
      handleOpenChange(false);
      onImportComplete({ resumeId: response.resume_id });
    } catch (submitError) {
      const base =
        submitError instanceof Error ? submitError.message : 'Failed to import master resume.';
      const freeTierSuffix =
        systemStatus?.using_free_llm && !systemStatus?.has_user_api_key
          ? ' This may be due to free tier instability — try again or add your own API key in Settings.'
          : '';
      setError(base + freeTierSuffix);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <DialogHeader className="border-b border-border bg-white p-6">
          <DialogTitle className="font-serif text-2xl font-bold">Import Master Resume</DialogTitle>
        </DialogHeader>

        <form className="space-y-5 bg-[#faf7ef] p-6" onSubmit={handleSubmit}>
          <p className="text-sm leading-relaxed text-gray-600">
            Upload your resume as a PDF, DOCX, Markdown, or plain text file. The AI will parse and
            structure it automatically. Processing takes about 1–2 minutes.
          </p>

          <div className="space-y-2">
            <label
              htmlFor={fileInputId}
              className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gray-700"
            >
              Resume File
            </label>
            <label
              htmlFor={fileInputId}
              className="block cursor-pointer rounded-2xl border border-border bg-white p-4 shadow-xs transition-colors hover:border-primary focus-within:border-primary"
            >
              <input
                id={fileInputId}
                type="file"
                accept=".pdf,.doc,.docx,.md,.txt,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/x-markdown,text/plain,application/json"
                onChange={(event) => {
                  setError(null);
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
                className="sr-only"
              />
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{fileLabel}</span>
                </div>
                <span className="shrink-0 rounded-xl border border-border px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-gray-700">
                  Choose file
                </span>
              </div>
            </label>
            <p className="font-mono text-[10px] uppercase tracking-wide text-gray-400">
              PDF, DOCX, MD, TXT, or JSON
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Resume
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
