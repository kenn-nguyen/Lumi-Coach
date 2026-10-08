import type { Metadata } from 'next';

import { TrackerClient } from '@/components/tracker/tracker-client';

export const metadata: Metadata = {
  title: 'Job Tracker',
  description: 'LinkedIn roles scraped, scored against your profile and ranked.',
};

/** The data is per-request and edited constantly, so nothing here is cached. */
export const dynamic = 'force-dynamic';

export default function TrackerPage() {
  return <TrackerClient />;
}
