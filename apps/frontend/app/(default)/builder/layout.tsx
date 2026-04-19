import type { Metadata } from 'next';
import { AuthenticatedAppShell } from '@/components/auth/authenticated-app-shell';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Resume Builder',
  'Authenticated resume builder workspace in Lumi Coach.'
);

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
