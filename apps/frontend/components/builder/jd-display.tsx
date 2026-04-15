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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-gray-200 bg-gray-50">
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
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Textarea
          value={content}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('builder.jdMatch.editorPlaceholder')}
          className="min-h-full h-full resize-none border-black/20 bg-white text-sm leading-relaxed text-gray-700"
        />
      </div>
    </div>
  );
}
