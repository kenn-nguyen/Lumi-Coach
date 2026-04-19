import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Print View',
  'Printable document route for Lumi Coach exports.'
);

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
