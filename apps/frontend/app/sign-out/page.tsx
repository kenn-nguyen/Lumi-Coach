'use client';

import { SignOutForm } from '@/components/auth/sign-out-form';

export default function SignOutPage() {
  return (
    <main className="skin-page-brand min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <SignOutForm />
      </div>
    </main>
  );
}
