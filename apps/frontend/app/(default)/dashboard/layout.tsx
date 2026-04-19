import type { Metadata } from 'next';
import { createNoIndexMetadata } from '@/lib/seo';

export const metadata: Metadata = createNoIndexMetadata(
  'Dashboard',
  'Authenticated Lumi Coach dashboard.'
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
