'use client';

import { FileText, Loader2, RotateCcw, Save } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface JDDisplayProps {
  content: string;
  onChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
  canReset: boolean;
  canSave: boolean;
  isSaving: boolean;
}

export function JDDisplay({
  content,
  onChange,
  onReset,
  onSave,
  canReset,
  canSave,
  isSaving,
}: JDDisplayProps) {
  const { t } = useTranslations();

  return (
    <div className="h-full flex flex-col bg-[#fcfaf4]">
      <div className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#ddd5c4] bg-[#f6f1e6] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-gray-600 shrink-0" />
          <h3 className="font-mono text-sm font-bold uppercase text-gray-700">
            {t('builder.jdMatch.jobDescriptionTitle')}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onReset}
            disabled={!canReset || isSaving}
            title={t('builder.jdMatch.resetButton')}
            aria-label={t('builder.jdMatch.resetButton')}
            className="h-9 w-9 rounded-full border-[#d9d1c0] bg-white text-gray-600 hover:bg-[#f7f2e8]"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            onClick={onSave}
            disabled={!canSave || isSaving}
            title={t('builder.jdMatch.useForFutureGeneration')}
            aria-label={t('builder.jdMatch.useForFutureGeneration')}
            className="h-9 w-9 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-[#fcfaf4]">
        <Textarea
          value={content}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('builder.jdMatch.editorPlaceholder')}
          className="h-full min-h-full resize-none rounded-[18px] border-[#ddd5c4] bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-none"
        />
      </div>
    </div>
  );
}
