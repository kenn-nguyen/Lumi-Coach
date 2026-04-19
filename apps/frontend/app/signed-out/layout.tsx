import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Signed Out',
  'Transition page used while ending a Lumi Coach session.'
);

export default function SignedOutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
