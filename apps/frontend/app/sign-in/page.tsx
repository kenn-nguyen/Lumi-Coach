import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { signIn } from '@/auth-node';
import { ExtensionLoginRequiredClient } from '@/components/auth/extension-login-required-client';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignInRedirectClient } from '@/components/auth/sign-in-redirect-client';

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    extensionId?: string;
  }>;
};

function getSourceTabIdFromCallbackUrl(callbackUrl?: string): string {
  if (!callbackUrl) return '';

  try {
    const parsed = callbackUrl.startsWith('/')
      ? new URL(callbackUrl, 'http://localhost')
      : new URL(callbackUrl);
    return parsed.searchParams.get('sourceTabId') || '';
  } catch {
    return '';
  }
}

function getAuthenticatedRedirectTarget(callbackUrl?: string): string {
  if (!callbackUrl || callbackUrl === '/sign-in') {
    return '/dashboard';
  }

  if (callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  return '/';
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackUrl = resolvedSearchParams?.callbackUrl || '/dashboard';
  const extensionId = resolvedSearchParams?.extensionId || '';
  const sourceTabId = getSourceTabIdFromCallbackUrl(resolvedSearchParams?.callbackUrl);

  if (session?.user) {
    redirect(getAuthenticatedRedirectTarget(resolvedSearchParams?.callbackUrl));
  }

  async function signInWithGoogle() {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }

  return (
    <main className="skin-page-brand min-h-screen flex items-center justify-center px-6">
      <SignInRedirectClient callbackUrl={callbackUrl} />
      {extensionId ? (
        <ExtensionLoginRequiredClient extensionId={extensionId} sourceTabId={sourceTabId} />
      ) : null}
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border border-border bg-white/90 p-8 shadow-sw-card backdrop-blur-[10px]">
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Lumi Coach
            </p>
            <h1 className="font-serif text-4xl tracking-[-0.04em] text-foreground">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Continue with Google to access your resumes and generated documents.
            </p>
          </div>

          <form action={signInWithGoogle} className="mt-8">
            <GoogleSignInButton />
          </form>
        </div>

        <div className="pt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-700 underline underline-offset-4 transition hover:text-black"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
