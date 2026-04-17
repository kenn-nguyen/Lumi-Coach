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
    <div
      className="h-screen w-full flex justify-center items-start py-12 px-4 md:px-8 overflow-hidden bg-[#F0F0E8]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(29, 78, 216, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 78, 216, 0.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="w-full max-w-[86rem] max-h-full border border-black bg-[#F0F0E8] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
        <div className="border-b border-black px-8 py-5 md:px-10 md:py-6 shrink-0 bg-[#F0F0E8] relative z-30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl text-black tracking-tight leading-[0.95] uppercase">
                {title || t('nav.dashboard')}
              </h1>
              <p className="mt-3 text-xs md:text-sm font-mono text-blue-700 uppercase tracking-wide max-w-xl font-bold">
                {'// '}
                {subtitle || t('dashboard.selectModule')}
              </p>
            </div>
            {headerActions ? (
              <div className="flex flex-wrap items-center gap-3 lg:justify-end">{headerActions}</div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
          <div className={cn('p-6 md:p-8', contentClassName)}>
            <div className="min-h-full">
              {children}
            </div>
          </div>
        </div>

        <div className="p-4 bg-[#F0F0E8] flex justify-between items-center font-mono text-xs text-blue-700 border-t border-black shrink-0 relative z-30">
          <Link href="/" className="flex items-center gap-2 uppercase font-bold hover:underline">
            <Image
              src="/logo.svg"
              alt="SOM Career Coach"
              width={20}
              height={20}
              className="w-5 h-5"
            />
            <span>SOM Career Coach</span>
          </Link>
          {footerContent ? <div className="flex items-center gap-4">{footerContent}</div> : null}
        </div>
      </div>
    </div>
  );
};
