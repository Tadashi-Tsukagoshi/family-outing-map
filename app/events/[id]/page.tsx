import { notFound } from 'next/navigation'
import { type Spot } from '@/lib/spots'
import { eventToSpot } from '@/lib/events'
import { supabaseAdmin } from '@/lib/supabase'
import type { Metadata } from 'next'
import EventRedirect from './EventRedirect'

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
      <EventRedirect eventId={id} />
    </>
  )
}
