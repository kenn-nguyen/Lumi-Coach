import type { Metadata } from 'next';
import { AuthenticatedAppShell } from '@/components/auth/authenticated-app-shell';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Tailor Resume',
  'Authenticated job tailoring workflow in Lumi Coach.'
);

export default function TailorLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
