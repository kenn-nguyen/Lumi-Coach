'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export interface DropdownOption {
  id: string;
  label: string;
  description?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}: DropdownProps) {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </label>
      )}

      {description && <p className="text-sm text-muted-foreground">{description}</p>}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-xs transition-colors duration-150 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="min-w-0 flex-1 text-left">
            {selectedOption ? (
              <div>
                <div className="truncate font-semibold text-foreground">{selectedOption.label}</div>
                {selectedOption.description && (
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {selectedOption.description}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{t('common.selectOption')}</span>
            )}
          </div>
          <ChevronDown
            className={`ml-2 h-4 w-4 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl border border-border bg-card p-2 shadow-sw-default">
            <div className="max-h-64 overflow-y-auto">
              {options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(option.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                    option.id === value
                      ? 'bg-accent text-foreground'
                      : 'text-foreground hover:bg-secondary/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{option.label}</div>
                    {option.description && (
                      <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                    )}
                  </div>
                  {option.id === value ? <Check className="mt-0.5 h-4 w-4 text-primary" /> : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
