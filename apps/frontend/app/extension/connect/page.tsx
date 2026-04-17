import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ExtensionConnectClient } from '@/components/auth/extension-connect-client';

type ExtensionConnectPageProps = {
  searchParams?: Promise<{
    extensionId?: string;
    sourceTabId?: string;
  }>;
};

export default async function ExtensionConnectPage({
  searchParams,
}: ExtensionConnectPageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const extensionId = resolvedSearchParams?.extensionId ?? '';
  const sourceTabId = resolvedSearchParams?.sourceTabId ?? '';
  const callbackUrl = extensionId
    ? `/extension/connect?extensionId=${encodeURIComponent(extensionId)}${sourceTabId ? `&sourceTabId=${encodeURIComponent(sourceTabId)}` : ''}`
    : '/extension/connect';

  if (!session?.user) {
    const signInParams = new URLSearchParams({
      callbackUrl,
    });
    if (extensionId) {
      signInParams.set('extensionId', extensionId);
    }
    redirect(`/sign-in?${signInParams.toString()}`);
  }

  return <ExtensionConnectClient extensionId={extensionId} />;
}
