import { notFound } from 'next/navigation'
import { CATEGORY_LABELS, DEFAULT_NOTICE, type Spot } from '@/lib/spots'
import { eventToSpot } from '@/lib/events'
import { supabaseAdmin } from '@/lib/supabase'
import type { Metadata } from 'next'
import { getDateDisplay, fmtTimeRange } from '@/lib/date-utils'

const CONTACT_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfjd2ErqEMLI7gDMk4O5iutIRSUMI6AD0hkJSnN3tAT5UjIXA/viewform'
const INQUIRY_TYPE_ENTRY_ID   = 'entry.811558340'
const INQUIRY_DETAIL_ENTRY_ID = 'entry.662119723'

function buildCorrectionFormUrl(eventName: string): string {
  const params = new URLSearchParams({
    usp: 'pp_url',
    [INQUIRY_TYPE_ENTRY_ID]:   '情報の修正依頼',
    [INQUIRY_DETAIL_ENTRY_ID]: `【${eventName}】の修正依頼：`,
  })
  return `${CONTACT_FORM_URL}?${params.toString()}`
}

function buildPhotoFormUrl(eventName: string): string {
  const params = new URLSearchParams({
    usp: 'pp_url',
    [INQUIRY_TYPE_ENTRY_ID]:   'チラシ・写真のご提供',
    [INQUIRY_DETAIL_ENTRY_ID]: `【${eventName}】のチラシ・写真提供：`,
  })
  return `${CONTACT_FORM_URL}?${params.toString()}`
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

function extractCity(address?: string, prefecture?: string): string | null {
  if (!address) return null
  const cleaned = address.replace(/〒?\d{3}-?\d{4}\s*/, '')
  const withoutPref = prefecture
    ? cleaned.replace(prefecture, '')
    : cleaned.replace(/^.+?[都道府県]/, '')
  const match = withoutPref.match(/^(.+?市)/)
    || withoutPref.match(/^(.+?区)/)
    || withoutPref.match(/^(.+?(?:町|村))/)
  return match ? match[1] : null
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

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const spot = await getSpot(id)
  if (!spot) return {}
  const city = extractCity(spot.address, spot.prefecture)
  const area = city
    ? `${spot.prefecture ?? '群馬県'}${city}`
    : (spot.prefecture ?? '群馬県')
  const description = spot.description
    ? spot.description.slice(0, 80).replace(/\n/g, ' ')
    : buildFallbackDescription(spot, area)
  const title = `${spot.name}｜${area}のイベント｜グンマップ`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(spot.imageUrl ? { images: [{ url: spot.imageUrl }] } : {}),
    },
    alternates: { canonical: `https://gunma-odekakemap.jp/events/${spot.id}` },
  }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const spot = await getSpot(id)
  if (!spot) notFound()

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
    url: `https://gunma-odekakemap.jp/events/${spot.id}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'JPY',
      availability: 'https://schema.org/InStock',
      url: spot.url ?? `https://gunma-odekakemap.jp/events/${spot.id}`,
    },
  }

  const dateDisplay = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
  const timeDisplay = fmtTimeRange(spot.startTime, spot.endTime)
  const dateTimeText = dateDisplay ? `${dateDisplay}${timeDisplay ? ` ${timeDisplay}` : ''}` : null
  const categoryLabel = CATEGORY_LABELS[spot.category]
  const noticeText = spot.notice || DEFAULT_NOTICE

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <main className="min-h-screen bg-white">
        <header className="border-b border-gray-100 bg-white">
          <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 shrink-0">
              <span className="block rounded-full overflow-hidden" style={{ width: 40, height: 40 }}>
                <img src="/gunmap_icon_02.png" alt="グンマップ" width={40} height={40} className="h-full w-full object-cover" />
              </span>
              <span className="font-semibold text-gray-800 text-sm">グンマップ｜GUNMAp</span>
            </a>
            <a href="/" className="text-sm text-gray-500 hover:text-gray-700 whitespace-nowrap">
              ← 地図に戻る
            </a>
          </div>
        </header>

        <article className="pb-12">
          {spot.imageUrl && (
            <img
              src={spot.imageUrl}
              alt={spot.name}
              className="w-full object-cover bg-gray-100"
              style={{ maxHeight: 420 }}
            />
          )}

          <div className="max-w-[720px] mx-auto px-4">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mt-6 mb-4 leading-snug">
              {spot.name}
            </h1>

            <dl className="mb-4 text-sm text-gray-800">
              {dateTimeText && (
                <div className="flex items-baseline gap-3 py-1.5 border-b border-gray-100">
                  <dt className="shrink-0 w-16 px-1.5 py-0.5 rounded text-xs font-medium text-center" style={{ background: '#dbeafe' }}>
                    日時
                  </dt>
                  <dd>{dateTimeText}</dd>
                </div>
              )}
              {spot.venue && (
                <div className="flex items-baseline gap-3 py-1.5 border-b border-gray-100">
                  <dt className="shrink-0 w-16 px-1.5 py-0.5 rounded text-xs font-medium text-center" style={{ background: '#dbeafe' }}>
                    会場
                  </dt>
                  <dd className="whitespace-pre-line">{spot.venue}</dd>
                </div>
              )}
              {spot.address && (
                <div className="flex items-baseline gap-3 py-1.5 border-b border-gray-100">
                  <dt className="shrink-0 w-16 px-1.5 py-0.5 rounded text-xs font-medium text-center" style={{ background: '#dbeafe' }}>
                    住所
                  </dt>
                  <dd>{spot.address}</dd>
                </div>
              )}
              <div className="flex items-baseline gap-3 py-1.5 border-b border-gray-100">
                <dt className="shrink-0 w-16 px-1.5 py-0.5 rounded text-xs font-medium text-center" style={{ background: '#dbeafe' }}>
                  カテゴリ
                </dt>
                <dd>{categoryLabel}</dd>
              </div>
              {spot.fee && (
                <div className="flex items-baseline gap-3 py-1.5 border-b border-gray-100">
                  <dt className="shrink-0 w-16 px-1.5 py-0.5 rounded text-xs font-medium text-center" style={{ background: '#dbeafe' }}>
                    料金
                  </dt>
                  <dd className="whitespace-pre-line">{spot.fee}</dd>
                </div>
              )}
            </dl>

            <p className="text-xs text-gray-500 whitespace-pre-line mb-6">{noticeText}</p>

            {spot.description && (
              <section className="mb-8">
                <h2 className="text-base font-semibold text-gray-900 mb-2">イベント詳細</h2>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{spot.description}</p>
              </section>
            )}

            <div className="flex flex-col gap-3 mb-8">
              <a
                href={`/?event=${spot.id}`}
                className="block text-center text-white font-semibold rounded-full px-6 py-3"
                style={{ background: 'linear-gradient(to right, #2f50c7, #5fb48c)' }}
              >
                🗺 地図で見る
              </a>
              {spot.url && (
                <a
                  href={spot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-sm text-gray-600 underline underline-offset-2"
                >
                  公式サイトを開く
                </a>
              )}
              <a
                href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-sm text-gray-600 underline underline-offset-2"
              >
                Googleマップで開く
              </a>
            </div>

            <p className="text-xs text-gray-400 mb-6">投稿: {spot.postedBy || 'グンマップ'}</p>

            <footer className="pt-4 border-t border-gray-100 flex flex-col gap-2">
              <a
                href={buildCorrectionFormUrl(spot.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500"
              >
                情報の修正を依頼する
              </a>
              <a
                href={buildPhotoFormUrl(spot.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500"
              >
                掲載用のチラシや写真を提供する
              </a>
            </footer>
          </div>
        </article>
      </main>
    </>
  )
}
