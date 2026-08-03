'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface SwissGridProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  footerContent?: React.ReactNode;
  contentClassName?: string;
}

export const SwissGrid = ({
  children,
  title,
  subtitle,
  headerActions,
  footerContent,
  contentClassName,
}: SwissGridProps) => {
  const { t } = useTranslations();

  return (
    <div className="skin-page-brand flex min-h-dvh w-full items-start justify-center px-4 py-6 md:h-screen md:overflow-hidden md:py-12 md:px-8">
      <div className="skin-shell flex w-full max-w-[86rem] flex-col rounded-[28px] md:max-h-full md:overflow-hidden">
        <div className="relative z-30 shrink-0 border-b border-border bg-white/60 px-8 py-5 md:px-10 md:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-serif text-4xl leading-[0.95] tracking-[-0.04em] text-foreground md:text-5xl">
                {title || t('nav.dashboard')}
              </h1>
              {subtitle ? (
                <p className="mt-3 max-w-xl font-mono text-xs font-bold uppercase tracking-[0.16em] text-primary md:text-sm">
                  {'// '}
                  {subtitle}
                </p>
              ) : null}
            </div>
            {headerActions ? (
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                {headerActions}
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative z-10 flex-1 overflow-x-hidden md:overflow-y-auto">
          <div className={cn('p-6 md:p-8', contentClassName)}>
            <div className="min-h-full">{children}</div>
          </div>
        </div>

        <div className="relative z-30 flex shrink-0 items-center justify-between border-t border-border bg-white/50 p-4 font-mono text-xs text-primary">
          <Link href="/" className="flex items-center gap-2 uppercase font-bold hover:underline">
            <Image src="/logo.png" alt="Lumi Coach" width={20} height={20} className="w-5 h-5" />
            <span>Lumi Coach</span>
          </Link>
          {footerContent ? <div className="flex items-center gap-4">{footerContent}</div> : null}
        </div>
      </div>
    </div>
  );
};
