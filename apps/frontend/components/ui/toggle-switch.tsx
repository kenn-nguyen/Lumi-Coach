'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ToggleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  display?: 'card' | 'inline';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
  display = 'card',
}) => {
  const labelId = React.useId();

  const toggleButton = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2',
        checked
          ? 'border-primary/15 bg-primary'
          : 'border-[#cfc7b8] bg-[#f3eee3]',
        disabled && 'opacity-50'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-6 border border-primary/10' : 'translate-x-1 border border-[#bcae96]'
        )}
      />
    </button>
  );

  if (display === 'inline') {
    return (
      <label
        className={cn(
          'flex items-center gap-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
      >
        {toggleButton}
        <span id={labelId} className="font-mono text-xs text-gray-700">
          {label}
        </span>
      </label>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <div className="mr-4 flex-1">
        <div id={labelId} className="font-semibold text-foreground">
          {label}
        </div>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {toggleButton}
    </div>
  );
};
