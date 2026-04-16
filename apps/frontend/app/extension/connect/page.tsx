import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ExtensionConnectClient } from '@/components/auth/extension-connect-client';

type ExtensionConnectPageProps = {
  searchParams?: Promise<{
    extensionId?: string;
  }>;
};

export default async function ExtensionConnectPage({
  searchParams,
}: ExtensionConnectPageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const extensionId = resolvedSearchParams?.extensionId ?? '';
  const callbackUrl = extensionId
    ? `/extension/connect?extensionId=${encodeURIComponent(extensionId)}`
    : '/extension/connect';

  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return <ExtensionConnectClient extensionId={extensionId} />;
}
