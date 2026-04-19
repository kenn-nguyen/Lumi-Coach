import type { Metadata } from 'next';

export const SITE_NAME = 'Lumi Coach';
export const SITE_DESCRIPTION =
  'Lumi Coach helps MBA students and recent grads tailor resumes for LinkedIn job postings with a faster, sharper application workflow.';
export const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';

function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'http://localhost:3000';
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.includes('localhost') || trimmed.startsWith('127.0.0.1')) {
    return `http://${trimmed}`;
  }

  return `https://${trimmed}`;
}

function resolveSiteUrl(): URL {
  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    'http://localhost:3000';

  return new URL(normalizeSiteUrl(configuredSiteUrl));
}

export const siteUrl = resolveSiteUrl();

export function toAbsoluteUrl(path = '/'): string {
  return new URL(path, siteUrl).toString();
}

type CreatePageMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  noIndex?: boolean;
  type?: 'website' | 'article';
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
  type = 'website',
}: CreatePageMetadataOptions): Metadata {
  const canonical = path ? toAbsoluteUrl(path) : undefined;
  const ogImage = toAbsoluteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    title,
    description,
    keywords,
    alternates: canonical
      ? {
          canonical,
        }
      : undefined,
    openGraph: {
      type,
      url: canonical,
      title,
      description,
      siteName: SITE_NAME,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} preview image`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : undefined,
  };
}

export function createNoIndexMetadata(title: string, description: string): Metadata {
  return createPageMetadata({
    title,
    description,
    noIndex: true,
  });
}
