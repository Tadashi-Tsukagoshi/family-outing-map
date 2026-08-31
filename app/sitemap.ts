import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

const BASE_URL = 'https://gunma-odekakemap.jp'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = supabaseAdmin()
  const { data } = await supabase
    .from('events')
    .select('id, created_at')
    .order('created_at', { ascending: false })

  const eventUrls: MetadataRoute.Sitemap = (data ?? []).map((e) => ({
    url: `${BASE_URL}/events/${e.id}`,
    lastModified: e.created_at ? new Date(e.created_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: BASE_URL,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...eventUrls,
  ]
}
