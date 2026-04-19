import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Space_Grotesk } from 'next/font/google';
import { AuthExtensionBridgeClient } from '@/components/auth/auth-extension-bridge-client';
import { AuthSessionProvider } from '@/components/auth/auth-session-provider';
import { PostHogProvider } from '@/components/analytics/posthog-provider';
import { DEFAULT_OG_IMAGE_PATH, SITE_DESCRIPTION, SITE_NAME, siteUrl } from '@/lib/seo';
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
  metadataBase: siteUrl,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'ai resume builder',
    'resume tailoring',
    'linkedin resume tool',
    'chrome extension for job applications',
    'mba resume',
    'resume optimization',
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'career',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} preview image`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  referrer: 'origin-when-cross-origin',
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
