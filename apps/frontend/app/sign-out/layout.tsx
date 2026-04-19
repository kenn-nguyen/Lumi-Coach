import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Sign Out',
  'Sign out of your Lumi Coach session.'
);

export default function SignOutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
