import type { Metadata } from 'next';
import { AuthenticatedAppShell } from '@/components/auth/authenticated-app-shell';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Admin',
  'Authenticated Lumi Coach admin tools.'
);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
