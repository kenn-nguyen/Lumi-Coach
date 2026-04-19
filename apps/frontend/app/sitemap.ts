import type { MetadataRoute } from 'next';
import { toAbsoluteUrl } from '@/lib/seo';

const PUBLIC_ROUTES = [
  {
    path: '/',
    changeFrequency: 'weekly' as const,
    priority: 1,
  },
  {
    path: '/story-bank',
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  },
  {
    path: '/privacy',
    changeFrequency: 'monthly' as const,
    priority: 0.4,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((route) => ({
    url: toAbsoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
