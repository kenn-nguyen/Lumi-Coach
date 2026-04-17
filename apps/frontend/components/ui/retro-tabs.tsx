'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface RetroTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  variant?: 'default' | 'folder';
}

export const RetroTabs: React.FC<RetroTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className,
  variant = 'default',
}) => {
  return (
    <div
      className={cn(
        variant === 'folder'
          ? 'flex flex-nowrap items-start gap-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex flex-wrap gap-2',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.disabled;

        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            className={cn(
              'inline-flex items-center gap-2 text-xs font-medium tracking-[0.08em] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2',
              variant === 'folder' &&
                'relative rounded-t-[18px] rounded-b-[8px] border px-4 py-2.5 shadow-[0_3px_10px_rgba(15,23,42,0.04)]',
              variant !== 'folder' && 'rounded-xl border px-4 py-2',
              variant === 'folder' &&
                isActive &&
                'border-border bg-[rgba(243,247,255,0.98)] text-foreground shadow-[0_10px_18px_rgba(37,99,235,0.10)]',
              variant === 'folder' &&
                !isActive &&
                !isDisabled &&
                '-ml-px border-border bg-[rgba(255,252,246,0.92)] text-muted-foreground hover:bg-[rgba(255,255,255,0.96)]',
              variant === 'folder' &&
                isDisabled &&
                '-ml-px cursor-not-allowed border-border/60 bg-secondary/50 text-muted-foreground/60',
              variant !== 'folder' && isActive && 'border-primary/15 bg-accent text-foreground shadow-xs',
              variant !== 'folder' &&
                !isActive &&
                !isDisabled &&
                'border-border bg-card text-muted-foreground hover:bg-secondary',
              variant !== 'folder' &&
                isDisabled &&
                'cursor-not-allowed border-border/60 bg-secondary/60 text-muted-foreground/60'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
