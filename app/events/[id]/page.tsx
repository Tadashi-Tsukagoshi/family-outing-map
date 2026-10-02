import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildEventMetadata, getApprovedEventSpot } from '@/lib/seo'
import EventRedirect from './EventRedirect'

// イベント登録内容はSupabase更新のたびに変わりうるため、一定間隔でSSRを再生成する（/area/[slug]と同じ値）
export const revalidate = 1800

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const spot = await getApprovedEventSpot(id)
  if (!spot) return {}
  return buildEventMetadata(spot)
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const spot = await getApprovedEventSpot(id)
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
