import type { Metadata } from 'next';
import { AuthenticatedAppShell } from '@/components/auth/authenticated-app-shell';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata('My Runs', 'Tailor pipeline run history.');

export default function RunsLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
