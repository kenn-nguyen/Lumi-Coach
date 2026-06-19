import DashboardClient from './DashboardClient';
import { fetchDashboardInitialData } from '@/lib/api/server';

// Prefetch the dashboard's first-paint state on the server using the session
// cookie. The page arrives fully formed — no blank/skeleton flash on refresh.
// initialData is null when unauthenticated or the backend is unreachable; the
// client component then loads its own data.
export default async function DashboardPage() {
  const initialData = await fetchDashboardInitialData();
  return <DashboardClient initialData={initialData} />;
}
