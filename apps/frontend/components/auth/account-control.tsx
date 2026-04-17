'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import User from 'lucide-react/dist/esm/icons/user';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import { cn } from '@/lib/utils';
import { captureEvent, POSTHOG_EVENTS } from '@/lib/analytics/posthog';

export function AccountControl({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const user = session?.user;
  const initials = useMemo(() => {
    const source = user?.name || user?.email || 'U';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }, [user?.email, user?.name]);

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'rounded-full border border-transparent opacity-0',
          compact ? 'h-11 w-[168px]' : 'h-10 w-[160px]'
        )}
      />
    );
  }

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border bg-card text-sm font-semibold leading-none text-foreground shadow-xs transition-colors hover:bg-secondary',
          compact ? 'h-11 px-4' : 'h-10 px-3'
        )}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white',
            compact ? 'h-7 w-7' : 'h-6 w-6'
          )}
        >
          {initials || <User className="h-3 w-3" />}
        </span>
        <span className="hidden max-w-[12rem] truncate md:inline">
          {user.name || user.email}
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[16rem] overflow-hidden rounded-2xl border border-border bg-card shadow-sw-default">
          <div className="border-b border-border px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Signed in
            </p>
            <p className="mt-1 truncate font-serif text-base text-foreground">
              {user.name || 'User'}
            </p>
            {user.email ? (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              captureEvent(POSTHOG_EVENTS.AUTH_SIGN_OUT_CLICKED);
              signOut({ callbackUrl: '/sign-in' });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-secondary"
          >
            <span>Sign out</span>
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
