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
    <main className="min-h-screen flex items-center justify-center bg-[#F0F0E8] px-6">
      {extensionId ? <ExtensionLoginRequiredClient extensionId={extensionId} /> : null}
      <div className="w-full max-w-md">
        <div className="border-2 border-black bg-[#E5E5E0] p-8 shadow-[8px_8px_0px_0px_#000000]">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-blue-700">
              SOM Career Coach
            </p>
            <h1 className="font-serif text-4xl text-black">Sign in</h1>
            <p className="text-sm text-gray-600">
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
