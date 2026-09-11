import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AREA_DEFS, getAreaBySlug } from '@/lib/areas'
import { fetchApprovedEvents } from '@/lib/events-server'
import { eventToSpot } from '@/lib/events'
import { EVENT_CATEGORIES, getVisualCategory, matchesCityArea } from '@/lib/spots'
import { getDateDisplay, getEventStatus, fmtTimeRange } from '@/lib/date-utils'
import AreaRedirect from './AreaRedirect'

// イベント登録内容はSupabase更新のたびに変わりうるため、一定間隔でSSRを再生成する
export const revalidate = 1800

// このページの本文はGoogle等クローラー向けのSSRコンテンツで、実ユーザーは/?area=へ即リダイレクトされる。
// display:noneではなくCSSクリップで画面外に追いやる方式（スクリーンリーダー用の visually-hidden と同じ手法）を使い、
// JS非依存でクローラーからは通常どおり読める状態を保ったまま、人の目には一切見えないようにする。
const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return AREA_DEFS.map((a) => ({ slug: a.slug }))
}

async function getAreaEvents(areaName: string) {
  const events = await fetchApprovedEvents()
  const spots = events.map(eventToSpot)

  return spots
    .filter((spot) => {
      if (spot.type === 'permanent') return false
      const visualCategory = getVisualCategory(spot)
      if (!(EVENT_CATEGORIES as readonly string[]).includes(visualCategory)) return false
      if (getEventStatus(spot.startDate, spot.endDate, spot.endTime) === 'ended') return false
      return matchesCityArea(spot.address, areaName)
    })
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const area = getAreaBySlug(slug)
  if (!area) return {}

  const title = `${area.name}のイベント・おでかけ情報 | グンマップ`
  const description = `${area.name}で開催されるイベント・お祭り・マルシェなどのおでかけ情報をマップで探せます。`

  return {
    title,
    description,
    openGraph: { title, description },
    alternates: { canonical: `https://gunma-odekakemap.jp/area/${slug}` },
  }
}

export default async function AreaPage({ params }: Props) {
  const { slug } = await params
  const area = getAreaBySlug(slug)
  if (!area) notFound()

  const spots = await getAreaEvents(area.name)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${area.name}のイベント・おでかけ情報`,
    about: {
      '@type': 'Place',
      name: area.name,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: spots.map((spot, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
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
              addressLocality: area.name,
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
        },
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main style={visuallyHiddenStyle}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          {area.name}のイベント・おでかけ情報
        </h1>
        <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 24px' }}>
          {area.name}で開催されるイベント・お祭り・マルシェなどのおでかけ情報をマップで探せます。
        </p>

        {spots.length === 0 ? (
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            現在{area.name}で開催予定のイベントは登録されていません。
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {spots.map((spot) => {
              const dateDisplay = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
              const timeDisplay = fmtTimeRange(spot.startTime, spot.endTime)
              return (
                <li key={spot.id} style={{ borderBottom: '1px solid #e5e7eb', padding: '16px 0' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>{spot.name}</h2>
                  {dateDisplay && (
                    <p style={{ fontSize: 13, color: '#374151', margin: '0 0 2px' }}>
                      {dateDisplay}{timeDisplay ? ` ${timeDisplay}` : ''}
                    </p>
                  )}
                  {spot.venue && (
                    <p style={{ fontSize: 13, color: '#374151', margin: '0 0 2px' }}>会場：{spot.venue}</p>
                  )}
                  {spot.description && (
                    <p style={{ fontSize: 13, color: '#4b5563', margin: '4px 0 0' }}>{spot.description}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
      <AreaRedirect slug={slug} />
    </>
  )
}
