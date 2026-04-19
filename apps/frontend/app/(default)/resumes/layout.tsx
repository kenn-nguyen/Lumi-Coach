import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Resume Workspace',
  'Authenticated resume workspace in Lumi Coach.'
);

export default function ResumesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
