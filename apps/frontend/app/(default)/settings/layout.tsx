import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Settings',
  'Authenticated settings workspace in Lumi Coach.'
);

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
