import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { AREA_DEFS } from '@/lib/areas'

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

  // /area/[slug]：終了イベントしかない（現在チップに表示されない）エリアも含め、全slug分を出力する
  const areaUrls: MetadataRoute.Sitemap = AREA_DEFS.map((area) => ({
    url: `${BASE_URL}/area/${area.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }))

  return [
    {
      url: BASE_URL,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...areaUrls,
    ...eventUrls,
  ]
}
