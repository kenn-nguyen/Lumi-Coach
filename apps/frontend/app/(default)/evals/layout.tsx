import type { Metadata } from 'next';
import { AuthenticatedAppShell } from '@/components/auth/authenticated-app-shell';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata('My Evals', 'Eval cases and scoring.');

export default function EvalsLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
