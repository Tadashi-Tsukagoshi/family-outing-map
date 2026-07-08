import type { MetadataRoute } from 'next'

const BASE_URL = 'https://family-outing-map.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/ended-events`,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
  ]
}
