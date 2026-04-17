'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import User from 'lucide-react/dist/esm/icons/user';
import LogOut from 'lucide-react/dist/esm/icons/log-out';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import { cn } from '@/lib/utils';
import { captureEvent } from '@/lib/analytics/posthog';

export function AccountControl({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-2 border border-black bg-[#E5E5E0] px-3 text-black shadow-[2px_2px_0px_0px_#000000] transition-all hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-none',
          compact ? 'h-9' : 'h-10'
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center border border-black bg-blue-700 text-[10px] font-bold text-white">
          {initials || <User className="h-3 w-3" />}
        </span>
        <span className="hidden max-w-[12rem] truncate font-mono text-xs uppercase tracking-[0.08em] md:inline">
          {user.name || user.email}
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[16rem] border border-black bg-[#F0F0E8] shadow-[4px_4px_0px_0px_#000000]">
          <div className="border-b border-black px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">
              Signed in
            </p>
            <p className="mt-1 truncate font-serif text-base text-black">
              {user.name || 'User'}
            </p>
            {user.email ? (
              <p className="truncate font-mono text-[11px] text-gray-600">{user.email}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              captureEvent('sign_out_clicked');
              signOut({ callbackUrl: '/sign-in' });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.12em] hover:bg-[#E5E5E0]"
          >
            <span>Sign out</span>
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
