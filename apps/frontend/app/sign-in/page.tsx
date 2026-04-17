import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { ExtensionLoginRequiredClient } from '@/components/auth/extension-login-required-client';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

type SignInPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    extensionId?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const callbackUrl = resolvedSearchParams?.callbackUrl || '/dashboard';
  const extensionId = resolvedSearchParams?.extensionId || '';

  if (session?.user) {
    redirect(callbackUrl);
  }

  async function signInWithGoogle() {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }

  return (
    <main className="skin-page-brand min-h-screen flex items-center justify-center px-6">
      {extensionId ? <ExtensionLoginRequiredClient extensionId={extensionId} /> : null}
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border border-border bg-white/90 p-8 shadow-sw-card backdrop-blur-[10px]">
          <div className="space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              SOM Career Coach
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
