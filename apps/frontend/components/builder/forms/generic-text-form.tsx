'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';

interface GenericTextFormProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Generic Text Form Component
 *
 * Used for TEXT type sections (like Summary).
 * Renders a single textarea for text content.
 */
export const GenericTextForm: React.FC<GenericTextFormProps> = ({
  value,
  onChange,
  label,
  placeholder,
}) => {
  const { t } = useTranslations();
  const finalLabel = label ?? t('builder.customSections.contentLabel');
  const finalPlaceholder = placeholder ?? t('builder.customSections.defaultTextPlaceholder');

  // Explicitly allow Enter key to create newlines
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card/80 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
        {finalLabel}
      </Label>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={finalPlaceholder}
        className="min-h-[150px] rounded-xl border-border bg-white text-foreground shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
      />
    </div>
  );
};
