import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CATEGORY_LABELS, DEFAULT_NOTICE, type Spot } from '@/lib/spots'
import { eventToSpot } from '@/lib/events'
import { supabaseAdmin } from '@/lib/supabase'
import { getDateDisplay, fmtTimeRange } from '@/lib/date-utils'
import type { Metadata } from 'next'

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
    prefecture:  data.prefecture,
    startDate:   data.start_date,
    endDate:     data.end_date,
    venue:       data.venue,
    fee:         data.fee ?? undefined,
    imageUrl:    data.image_url ?? undefined,
    lat:         data.lat,
    lng:         data.lng,
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

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const spot = await getSpot(id)
  if (!spot) return {}
  const description = spot.description
    ? spot.description.slice(0, 80).replace(/\n/g, ' ')
    : `${spot.venue ?? '群馬'}で開催のイベント情報 | グンマップ`
  const title = `${spot.name}｜${spot.prefecture ?? '群馬県'}のイベント - グンマップ｜GUNMAp`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(spot.imageUrl ? { images: [{ url: spot.imageUrl }] } : {}),
    },
  }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const spot = await getSpot(id)
  if (!spot) notFound()

  const supabase = supabaseAdmin()
  const { data: imageRows } = await supabase
    .from('event_images')
    .select('image_url, caption')
    .eq('event_id', id)
    .is('event_date_id', null)
    .order('sort_order', { ascending: true })

  const galleryImages = imageRows ?? []

  const dateDisplay = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
  const timeDisplay = fmtTimeRange(spot.startTime, spot.endTime)

  const eventJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: spot.name,
    ...(spot.startDate ? { startDate: spot.startDate } : {}),
    ...(spot.endDate ? { endDate: spot.endDate } : {}),
    ...(spot.description ? { description: spot.description } : {}),
    location: {
      '@type': 'Place',
      ...(spot.venue ? { name: spot.venue } : {}),
      address: {
        '@type': 'PostalAddress',
        addressRegion: spot.prefecture ?? '群馬県',
        ...(spot.venue ? { addressLocality: spot.venue } : {}),
        addressCountry: 'JP',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: spot.lat,
        longitude: spot.lng,
      },
    },
    ...(spot.imageUrl ? { image: spot.imageUrl } : {}),
    url: `https://gunma-odekakemap.jp/events/event-${spot.id}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
      url: spot.url ?? `https://gunma-odekakemap.jp/events/event-${spot.id}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <div className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
          <Link href="/" className="inline-block mb-5">
            <img src="/logo-pc_10.png" alt="グンマップ" className="h-7 w-auto" />
          </Link>

          <span className="inline-block bg-[#dbeafe] text-gray-700 text-xs font-medium px-2 py-1 rounded mb-3">
            {CATEGORY_LABELS[spot.category]}
          </span>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug mb-4">
            {spot.name}
          </h1>

          <div className="space-y-1.5 mb-5 text-sm text-gray-800">
            {dateDisplay && (
              <p>
                <span className="font-semibold">日程：</span>
                {dateDisplay}
                {timeDisplay ? ` ${timeDisplay}` : ''}
              </p>
            )}
            {spot.venue && (
              <p>
                <span className="font-semibold">会場：</span>
                {spot.venue}
              </p>
            )}
            {spot.address && (
              <p>
                <span className="font-semibold">住所：</span>
                {spot.address}
              </p>
            )}
          </div>

          {spot.imageUrl && (
            <div className="mb-5">
              <img
                src={spot.imageUrl}
                alt={spot.name}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}

          {galleryImages.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              {galleryImages.map((img, i) => (
                <figure key={i}>
                  <img
                    src={img.image_url}
                    alt={img.caption ?? `${spot.name}の写真`}
                    className="w-full h-auto rounded-lg"
                  />
                  {img.caption && (
                    <figcaption className="text-xs text-gray-500 mt-1">{img.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}

          {spot.description && (
            <p
              className="text-sm text-gray-800 leading-relaxed mb-4"
              style={{ whiteSpace: 'pre-line' }}
            >
              {spot.description}
            </p>
          )}

          <p className="text-xs text-gray-500 mb-5" style={{ whiteSpace: 'pre-line' }}>
            {spot.notice ?? DEFAULT_NOTICE}
          </p>

          {spot.url && (
            <p className="mb-2">
              <a
                href={spot.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline"
              >
                公式サイトを見る
              </a>
            </p>
          )}

          {spot.posterType === 'staff' && (
            <p className="text-xs text-gray-500 mb-6">情報提供元：グンマップ</p>
          )}

          <Link
            href={`/?event=${spot.id}`}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg mb-10 transition-colors"
          >
            <span>📍</span>
            <span>地図で見る</span>
          </Link>

          <footer className="border-t border-gray-200 pt-4 pb-8 text-center text-xs text-gray-400 space-y-1">
            <p>© グンマップ｜GUNMAp</p>
            <p>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfjd2ErqEMLI7gDMk4O5iutIRSUMI6AD0hkJSnN3tAT5UjIXA/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                お問い合わせ
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}
