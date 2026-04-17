'use client';

import React, { useEffect, useRef, useState } from 'react';
import { rewriteSummary } from '@/lib/api/resume';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, Eye, Loader2, Sparkles, X } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface SummaryFormProps {
  resumeId?: string | null;
  linkedJobDescription?: string | null;
  originalValue?: string | null;
  value: string;
  onChange: (value: string) => void;
}

type PopoverType = 'original' | 'rewrite';

export const SummaryForm: React.FC<SummaryFormProps> = ({
  resumeId,
  linkedJobDescription,
  originalValue,
  value,
  onChange,
}) => {
  const { t } = useTranslations();
  const [activePopover, setActivePopover] = useState<{ type: PopoverType } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const summaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const instructionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const generatedSummaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Explicitly allow Enter key to create newlines
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  const resizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTextarea(summaryTextareaRef.current);
  }, [value]);

  useEffect(() => {
    resizeTextarea(instructionTextareaRef.current);
  }, [instruction]);

  useEffect(() => {
    resizeTextarea(generatedSummaryTextareaRef.current);
  }, [generatedSummary]);

  const togglePopover = (_event: React.MouseEvent<HTMLButtonElement>, type: PopoverType) => {
    setActivePopover((current) => (current?.type === type ? null : { type }));
  };

  const handleGenerateRewrite = async () => {
    if (!resumeId || !value.trim()) {
      return;
    }

    try {
      setIsGenerating(true);
      const response = await rewriteSummary(resumeId, {
        current_summary: value,
        original_summary: originalValue,
        job_description: linkedJobDescription,
        user_instruction: instruction,
      });
      setGeneratedSummary(response.rewritten_summary);
    } catch (error) {
      console.error('Failed to rewrite summary:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseGeneratedSummary = () => {
    const nextSummary = generatedSummary.trim();
    if (!nextSummary) {
      return;
    }
    onChange(nextSummary);
    setActivePopover(null);
  };

  const renderPopover = (type: PopoverType) => {
    if (type === 'original') {
      return (
        <div className="rounded-2xl border border-border bg-[rgba(255,253,248,0.96)] p-3 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.original.title')}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActivePopover(null)}
              className="h-6 w-6 text-muted-foreground hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-5 text-black">
            {originalValue?.trim() || t('builder.forms.summary.original.empty')}
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-border bg-[rgba(255,253,248,0.96)] p-3 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
            {t('builder.forms.summary.aiRewrite.title')}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActivePopover(null)}
            className="h-6 w-6 text-muted-foreground hover:text-black"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.original.title')}
            </Label>
            <div className="whitespace-pre-wrap rounded-xl border border-border bg-white px-3 py-2 text-sm leading-6 text-foreground shadow-xs">
              {originalValue?.trim() || t('builder.forms.summary.original.empty')}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.aiRewrite.instructionLabel')}
            </Label>
            <Textarea
              ref={instructionTextareaRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t('builder.forms.summary.aiRewrite.instructionPlaceholder')}
              rows={1}
              className="min-h-0 resize-none overflow-hidden rounded-xl border-border bg-white px-3 py-2 text-sm leading-6 shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
            />
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.aiRewrite.resultLabel')}
            </Label>
            <Textarea
              ref={generatedSummaryTextareaRef}
              value={generatedSummary}
              onChange={(e) => setGeneratedSummary(e.target.value)}
              placeholder={t('builder.forms.summary.aiRewrite.resultPlaceholder')}
              rows={1}
              className="min-h-0 resize-none overflow-hidden rounded-xl border-border bg-white px-3 py-2 text-sm leading-6 shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateRewrite}
              disabled={!resumeId || isGenerating || !value.trim()}
              className="rounded-xl border-border bg-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('builder.forms.summary.aiRewrite.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('builder.forms.summary.aiRewrite.generate')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePopover(null)}
              className="rounded-xl border-border bg-white"
            >
              {t('builder.forms.summary.aiRewrite.cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleUseGeneratedSummary}
              disabled={!generatedSummary.trim()}
              className="rounded-xl"
            >
              <Check className="mr-2 h-4 w-4" />
              {t('builder.forms.summary.aiRewrite.use')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const popover = activePopover ? renderPopover(activePopover.type) : null;

  return (
    <div className="space-y-4">
      <div data-summary-row className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label
            htmlFor="summary"
            className="font-mono text-xs uppercase tracking-wider text-gray-500"
          >
            {t('resume.sections.summary')}
          </Label>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={(event) => togglePopover(event, 'rewrite')}
              disabled={!resumeId}
              title={t('builder.forms.summary.aiRewrite.button')}
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
            {originalValue?.trim() ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => togglePopover(event, 'original')}
                title={t('builder.forms.summary.original.button')}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <Textarea
          id="summary"
          ref={summaryTextareaRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('builder.placeholders.summary')}
          className="min-h-[72px] resize-none overflow-hidden rounded-xl border-border bg-white text-foreground shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
        />
        {popover}
      </div>
    </div>
  );
};
