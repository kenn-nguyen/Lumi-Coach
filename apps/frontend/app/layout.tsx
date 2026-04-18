import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Space_Grotesk } from 'next/font/google';
import { AuthExtensionBridgeClient } from '@/components/auth/auth-extension-bridge-client';
import { AuthSessionProvider } from '@/components/auth/auth-session-provider';
import { PostHogProvider } from '@/components/analytics/posthog-provider';
import './(default)/css/globals.css';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lumi Coach',
  description: 'Build your resume with Lumi Coach',
  applicationName: 'Lumi Coach',
  keywords: ['resume', 'matcher', 'job', 'application'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className="h-full" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${spaceGrotesk.variable} antialiased bg-[#F0F0E8] text-gray-900 min-h-full`}
      >
        <AuthSessionProvider>
          <Suspense fallback={children}>
            <PostHogProvider>
              <AuthExtensionBridgeClient />
              {children}
            </PostHogProvider>
          </Suspense>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
