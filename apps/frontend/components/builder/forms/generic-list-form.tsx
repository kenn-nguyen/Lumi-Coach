'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/lib/i18n';

interface GenericListFormProps {
  items: string[];
  onChange: (items: string[]) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Generic List Form Component
 *
 * Used for STRING_LIST type sections (like Skills).
 * Renders a textarea where items are separated by newlines.
 */
export const GenericListForm: React.FC<GenericListFormProps> = ({
  items,
  onChange,
  label,
  placeholder,
}) => {
  const { t } = useTranslations();
  const finalLabel = label ?? t('builder.customSections.itemsLabel');
  const finalPlaceholder = placeholder ?? t('builder.customSections.itemsPlaceholder');

  const handleChange = (value: string) => {
    // Split by newlines, filter empty lines
    const newItems = value.split('\n').filter((item) => item.trim() !== '');
    onChange(newItems);
  };

  const formatItems = (arr?: string[]) => {
    return arr?.join('\n') || '';
  };

  // Explicitly allow Enter key to create newlines
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/80 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
        {finalLabel}
      </Label>
      <p className="rounded-xl border border-border bg-card/70 px-3 py-2 font-mono text-xs text-blue-700">
        {t('builder.additionalForm.instructions')}
      </p>
      <Textarea
        value={formatItems(items)}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={finalPlaceholder}
        className="min-h-[150px] rounded-xl border-border bg-white text-foreground shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
      />
    </div>
  );
};
