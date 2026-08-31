import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/ota-admin'],
    },
    sitemap: 'https://gunma-odekakemap.jp/sitemap.xml',
  }
}
