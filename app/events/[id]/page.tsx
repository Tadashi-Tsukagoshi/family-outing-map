import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_EMOJIS, type Category, type Spot } from '@/lib/spots'
import { eventToSpot } from '@/lib/events'
import { getDateDisplay, getEventStatus, STATUS_CONFIG } from '@/lib/date-utils'
import { supabaseAdmin } from '@/lib/supabase'
import type { Metadata } from 'next'

const CATEGORY_IMAGES: Record<Category, string> = {
  event:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  music:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  exhibition: 'https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=800&q=80',
}

async function getSpot(id: string): Promise<Spot | null> {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return eventToSpot({
    id:          data.id,
    name:        data.name,
    description: data.description,
    startDate:   data.start_date,
    endDate:     data.end_date,
    venue:       data.venue,
    fee:         data.fee ?? undefined,
    imageUrl:    data.image_url ?? undefined,
    lat:         data.lat,
    lng:         data.lng,
    category:    data.category,
    url:          data.url ?? undefined,
    collectedAt:  data.collected_at,
    postedBy:     data.posted_by,
    posterType:   data.poster_type,
    scheduleNote: data.schedule_note ?? undefined,
    likes:        data.likes ?? 0,
  })
}

async function fetchOgpImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGPFetcher/1.0)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const spot = await getSpot(id)
  if (!spot) return {}
  return { title: `${spot.name} | 群馬県おでかけまっぷ` }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const spot = await getSpot(id)
  if (!spot) notFound()

  const heroImage =
    spot.imageUrl ||
    (spot.url ? await fetchOgpImage(spot.url) : null) ||
    CATEGORY_IMAGES[spot.category]

  const status    = getEventStatus(spot.startDate, spot.endDate)
  const dateRange = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate)
  const statusCfg = status ? STATUS_CONFIG[status] : null
  const catColor  = CATEGORY_COLORS[spot.category]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-5 py-3.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← 地図に戻る
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* ヒーロー画像 */}
          <div className="w-full h-56 sm:h-72 bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt={spot.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6 space-y-5">

            {/* カテゴリ + ステータスバッジ */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ backgroundColor: catColor + '22', color: catColor }}
              >
                {CATEGORY_EMOJIS[spot.category]} {CATEGORY_LABELS[spot.category]}
              </span>
              {statusCfg && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}
                >
                  {statusCfg.label}
                </span>
              )}
            </div>

            {/* イベント名 */}
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{spot.name}</h1>

            {/* 日程・会場 */}
            {(dateRange || spot.venue) && (
              <dl className="space-y-2">
                {dateRange && (
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <dt className="w-5 flex-shrink-0 text-base leading-snug">📅</dt>
                    <dd>{dateRange}</dd>
                  </div>
                )}
                {spot.venue && (
                  <div className="flex items-start gap-2 text-sm text-gray-700">
                    <dt className="w-5 flex-shrink-0 text-base leading-snug">📍</dt>
                    <dd>{spot.venue}</dd>
                  </div>
                )}
              </dl>
            )}

            <hr className="border-gray-100" />

            {/* 説明文（全文） */}
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {spot.description}
            </p>

            {/* ボタン群 */}
            <div className="space-y-2">
              <a
                href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                  bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
              >
                Googleマップで開く
                <span className="text-xs opacity-75">↗</span>
              </a>
              {spot.url && (
                <a
                  href={spot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl
                    bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                >
                  公式サイトを見る
                  <span className="text-xs opacity-75">↗</span>
                </a>
              )}
            </div>

          </div>
        </article>
      </main>
    </div>
  )
}
