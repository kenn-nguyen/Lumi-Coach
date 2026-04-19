import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Extension Sign Out',
  'Transition page used while ending an extension-driven Lumi Coach session.'
);

export default function ExtensionSignOutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
