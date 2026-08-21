import type { MetadataRoute } from 'next';

/** Stage 2 adds every page it creates here. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return [{ url: `${base}/`, lastModified: new Date(), changeFrequency: 'monthly', priority: 1 }];
}
