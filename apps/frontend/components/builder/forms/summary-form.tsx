'use client';

import React, { useState } from 'react';
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
type PopoverPlacement = 'above' | 'below';

export const SummaryForm: React.FC<SummaryFormProps> = ({
  resumeId,
  linkedJobDescription,
  originalValue,
  value,
  onChange,
}) => {
  const { t } = useTranslations();
  const [activePopover, setActivePopover] = useState<{
    type: PopoverType;
    placement: PopoverPlacement;
  } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [generatedSummary, setGeneratedSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Explicitly allow Enter key to create newlines
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  const getPopoverPlacement = (
    event: React.MouseEvent<HTMLButtonElement>,
    estimatedHeight: number
  ): PopoverPlacement => {
    if (typeof window === 'undefined') {
      return 'below';
    }

    const row = (event.currentTarget as HTMLElement).closest('[data-summary-row]');
    if (!(row instanceof HTMLElement)) {
      return 'below';
    }

    const rect = row.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      return 'above';
    }

    return 'below';
  };

  const togglePopover = (
    event: React.MouseEvent<HTMLButtonElement>,
    type: PopoverType
  ) => {
    const estimatedHeight = type === 'rewrite' ? 360 : 180;
    const placement = getPopoverPlacement(event, estimatedHeight);

    setActivePopover((current) =>
      current?.type === type ? null : { type, placement }
    );
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
        <div className="border border-black bg-[#F0F0E8] p-3 shadow-[4px_4px_0_0_#000]">
          <div className="mb-2 flex items-center justify-between">
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
      <div className="border border-black bg-[#F0F0E8] p-3 shadow-[4px_4px_0_0_#000]">
        <div className="mb-3 flex items-center justify-between">
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

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.original.title')}
            </Label>
            <div className="min-h-[72px] whitespace-pre-wrap border border-black bg-white px-3 py-2 text-sm leading-5 text-black">
              {originalValue?.trim() || t('builder.forms.summary.original.empty')}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.aiRewrite.instructionLabel')}
            </Label>
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t('builder.forms.summary.aiRewrite.instructionPlaceholder')}
              className="min-h-[76px] bg-white text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.summary.aiRewrite.resultLabel')}
            </Label>
            <Textarea
              value={generatedSummary}
              onChange={(e) => setGeneratedSummary(e.target.value)}
              placeholder={t('builder.forms.summary.aiRewrite.resultPlaceholder')}
              className="min-h-[120px] bg-white text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateRewrite}
              disabled={!resumeId || isGenerating || !value.trim()}
              className="rounded-none border-black bg-white"
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
              className="rounded-none border-black bg-white"
            >
              {t('builder.forms.summary.aiRewrite.cancel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUseGeneratedSummary}
              disabled={!generatedSummary.trim()}
              className="rounded-none border-black bg-black text-white hover:bg-white hover:text-black"
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
        {activePopover?.placement === 'above' ? popover : null}
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
              className="h-[28px] w-8 text-muted-foreground hover:text-black"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </Button>
            {originalValue?.trim() ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => togglePopover(event, 'original')}
                title={t('builder.forms.summary.original.button')}
                className="h-[28px] w-8 text-muted-foreground hover:text-black"
              >
                <Eye className="w-3.5 h-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
        <Textarea
          id="summary"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('builder.placeholders.summary')}
          className="min-h-[150px] text-black rounded-none border-black focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-blue-700 bg-white"
        />
        {activePopover?.placement === 'below' ? popover : null}
      </div>
    </div>
  );
};
