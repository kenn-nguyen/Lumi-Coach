import type { Metadata } from 'next';
import { ResumeBuilder } from '@/components/builder/resume-builder';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Resume Builder',
  'Authenticated resume builder workspace in Lumi Coach.'
);

export default function BuilderPage() {
  return <ResumeBuilder />;
}
