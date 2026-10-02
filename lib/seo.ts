import type { Metadata } from 'next'
import { type Spot } from '@/lib/spots'
import { eventToSpot } from '@/lib/events'
import { supabaseAdmin } from '@/lib/supabase'
import { buildEventTitle, getEventArea } from '@/lib/event-title'

/** SNS 共有用メタタグ（OGP）で使う共通の値 */
export const SITE_NAME = 'グンマップ'

/** 画像が無いページで使う共通の OGP 画像（app/layout.tsx の既定と同じ） */
export const DEFAULT_OGP_IMAGE = { url: '/gunmap_OGP_05.png', width: 1200, height: 630 }

/** 承認済みのイベントを1件取得する（未承認・却下・存在しない ID は null） */
export async function getApprovedEventSpot(id: string): Promise<Spot | null> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    // 承認済みのイベントだけを対象にする
    .eq('status', 'approved')
    .single()
  if (error || !data) return null
  return eventToSpot({
    id:          data.id,
    name:        data.name,
    description: data.description,
    prefecture:  data.prefecture,
    startDate:   data.start_date,
    endDate:     data.end_date,
    venue:       data.venue,
    fee:         data.fee ?? undefined,
    imageUrl:    data.image_url ?? undefined,
    lat:         data.lat,
    lng:         data.lng,
    address:     data.address ?? undefined,
    category:    data.category,
    type:        data.type ?? undefined,
    url:          data.url ?? undefined,
    collectedAt:  data.collected_at,
    postedBy:     data.posted_by,
    posterType:   data.poster_type,
    scheduleNote: data.schedule_note ?? undefined,
    specificDates: data.specific_dates ?? undefined,
    notice:       data.notice ?? undefined,
    likes:        data.likes ?? 0,
  })
}

function buildFallbackDescription(spot: Spot, area: string): string {
  const parts: string[] = [spot.name]
  if (spot.startDate) {
    const d = new Date(spot.startDate + 'T00:00:00')
    const month = d.getMonth() + 1
    const day = d.getDate()
    parts.push(`${month}/${day}開催`)
  }
  if (spot.venue) {
    parts.push(spot.venue)
  }
  parts.push(`${area}のイベント情報`)
  parts.push('グンマップ')
  return parts.join(' - ')
}

/**
 * イベントの OGP・メタタグ（/events/[id] と、トップページの /?event={id} で共通）。
 * canonical・og:url は /events/[id] に揃える
 */
export function buildEventMetadata(spot: Spot): Metadata {
  const area = getEventArea(spot)
  const description = spot.description
    ? spot.description.slice(0, 80).replace(/\n/g, ' ')
    : buildFallbackDescription(spot, area)
  const title = buildEventTitle(spot)
  const url = `https://gunma-odekakemap.jp/events/${spot.id}`
  // イベント画像があれば OGP・X 用ともにそれを使い、無ければ共通画像を使う。
  // （子ページで openGraph / twitter を指定すると layout の既定はまるごと置き換わるため、ここで明示する）
  const image = spot.imageUrl ? { url: spot.imageUrl } : DEFAULT_OGP_IMAGE
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: SITE_NAME,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
    alternates: { canonical: url },
  }
}
