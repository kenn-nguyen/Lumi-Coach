import { AuthenticatedAppShell } from '@/components/auth/authenticated-app-shell';

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
