'use client';

import React from 'react';
import { Building2, CalendarDays, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateDisplayMode, ExperienceHeaderOrder } from '@/lib/types/template-settings';

interface QuickLayoutControlLabels {
  yearOnly: string;
  yearOnlyHint: string;
  companyFirst: string;
  companyFirstHint: string;
  fitOnePage: string;
  fitOnePageHint: string;
}

interface QuickLayoutControlsProps {
  dateDisplay: DateDisplayMode;
  experienceHeaderOrder: ExperienceHeaderOrder;
  fitOnePage: boolean;
  onDateDisplayChange?: (dateDisplay: DateDisplayMode) => void;
  onExperienceHeaderOrderChange?: (order: ExperienceHeaderOrder) => void;
  onFitOnePageChange?: (fitOnePage: boolean) => void;
  labels: QuickLayoutControlLabels;
  disabled?: boolean;
  labelMode?: 'full' | 'compact';
  wrap?: boolean;
  className?: string;
}

export function QuickLayoutControls({
  dateDisplay,
  experienceHeaderOrder,
  fitOnePage,
  onDateDisplayChange,
  onExperienceHeaderOrderChange,
  onFitOnePageChange,
  labels,
  disabled = false,
  labelMode = 'full',
  wrap = false,
  className,
}: QuickLayoutControlsProps) {
  const items = [
    {
      key: 'year-only',
      label: labels.yearOnly,
      compactLabel: 'Years',
      title: labels.yearOnlyHint,
      active: dateDisplay === 'year-only',
      disabled: disabled || !onDateDisplayChange,
      icon: CalendarDays,
      onClick: () =>
        onDateDisplayChange?.(dateDisplay === 'year-only' ? 'month-year' : 'year-only'),
    },
    {
      key: 'company-first',
      label: labels.companyFirst,
      compactLabel: 'Company',
      title: labels.companyFirstHint,
      active: experienceHeaderOrder === 'company-first',
      disabled: disabled || !onExperienceHeaderOrderChange,
      icon: Building2,
      onClick: () =>
        onExperienceHeaderOrderChange?.(
          experienceHeaderOrder === 'company-first' ? 'role-first' : 'company-first'
        ),
    },
    {
      key: 'fit-one-page',
      label: labels.fitOnePage,
      compactLabel: '1 page',
      title: labels.fitOnePageHint,
      active: fitOnePage,
      disabled: disabled || !onFitOnePageChange,
      icon: FileText,
      onClick: () => onFitOnePageChange?.(!fitOnePage),
    },
  ];

  return (
    <div
      className={cn(
        wrap
          ? 'flex max-w-full flex-wrap items-center gap-1 overflow-visible rounded-none bg-transparent p-0'
          : 'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[#d8cfbf] bg-[#fbf8f2] p-0.5 shadow-xs',
        disabled && 'opacity-60',
        className
      )}
      aria-label="Quick resume layout"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            aria-label={item.label}
            aria-pressed={item.active}
            disabled={item.disabled}
            title={item.title}
            onClick={item.onClick}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-mono font-bold uppercase tracking-[0.08em] transition-colors sm:px-3',
              item.active
                ? 'border-[#c7baa7] bg-white text-foreground shadow-[0_1px_0_rgba(17,24,39,0.05)]'
                : 'border-transparent bg-transparent text-[#697386] hover:bg-white/70 hover:text-foreground',
              item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{labelMode === 'compact' ? item.compactLabel : item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
