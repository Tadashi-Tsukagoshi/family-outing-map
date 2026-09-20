import { notFound } from 'next/navigation'
import { BADGE_BG_COLOR, DEFAULT_NOTICE, type Spot } from '@/lib/spots'
import { eventToSpot } from '@/lib/events'
import { supabaseAdmin } from '@/lib/supabase'
import type { Metadata } from 'next'
import { getDateDisplay, fmtTimeRange } from '@/lib/date-utils'
import EventLocationMap from './EventLocationMap'

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
  const noticeText = spot.notice || DEFAULT_NOTICE

  const badgeLabelStyle: React.CSSProperties = {
    display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
    background: BADGE_BG_COLOR, color: '#111', fontSize: 14, fontWeight: 500,
  }
  const infoRowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14, fontWeight: 500, color: '#111', margin: '0 0 8px',
  }
  const ctaLinkStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none',
  }
  const footerLinkStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, color: '#3b82f6', textDecoration: 'none',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <main style={{ minHeight: '100vh', background: '#fff' }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
              <span style={{ display: 'block', width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <img src="/gunmap_icon_02.png" alt="グンマップ" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </span>
              <span style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>グンマップ｜GUNMAp</span>
            </a>
            <a href="/" style={{ fontSize: 14, color: '#6b7280', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ← 地図に戻る
            </a>
          </div>
        </header>

        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ padding: '10px 0 0' }}>
            <EventLocationMap eventId={spot.id} latitude={spot.lat} longitude={spot.lng} eventName={spot.name} category={spot.category} />
          </div>

          <div style={{ padding: '10px 16px 8px' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111', lineHeight: 1.4, margin: 0 }}>
              {spot.name}
            </h1>
            {dateTimeText && (
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: '2px 0 0' }}>
                {dateTimeText}
              </p>
            )}
            <p style={{ fontSize: 12, fontWeight: 500, color: '#111', margin: '2px 0 0', whiteSpace: 'pre-line' }}>
              {noticeText}
            </p>
          </div>

          {spot.imageUrl && (
            <img
              src={spot.imageUrl}
              alt={spot.name}
              style={{ display: 'block', width: '100%', maxHeight: 500, objectFit: 'contain', backgroundColor: '#f3f4f6' }}
            />
          )}

          <div style={{ padding: '12px 16px 20px' }}>
            {spot.venue && (
              <p style={infoRowStyle}>
                <span style={badgeLabelStyle}>会場</span>
                <span style={{ whiteSpace: 'pre-line' }}>{spot.venue}</span>
              </p>
            )}

            {spot.address && (
              <p style={infoRowStyle}>
                <span style={badgeLabelStyle}>住所</span>
                <span>{spot.address}</span>
              </p>
            )}

            {spot.fee && (
              <p style={infoRowStyle}>
                <span style={badgeLabelStyle}>料金</span>
                <span style={{ whiteSpace: 'pre-line' }}>{spot.fee}</span>
              </p>
            )}

            {spot.description && (
              <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.65, margin: '0 0 14px' }}>
                <span style={badgeLabelStyle}>説明</span>
                <span>{spot.description}</span>
              </p>
            )}

            <p style={{ display: 'flex', alignItems: 'baseline', fontSize: 11, color: '#111', margin: '0 0 24px' }}>
              <span style={badgeLabelStyle}>投稿</span>
              <span style={{ marginLeft: 6, fontSize: 14, fontWeight: 500, color: '#374151' }}>{spot.postedBy || 'グンマップ'}</span>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {spot.url && (
                <a href={spot.url} target="_blank" rel="noopener noreferrer" style={ctaLinkStyle}>
                  公式サイトを開く
                </a>
              )}
              <a
                href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={ctaLinkStyle}
              >
                Googleマップで開く
              </a>
            </div>

            <div style={{ marginTop: 16, paddingTop: 10, borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href={buildCorrectionFormUrl(spot.name)} target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                情報の修正を依頼する
              </a>
              <a href={buildPhotoFormUrl(spot.name)} target="_blank" rel="noopener noreferrer" style={footerLinkStyle}>
                掲載用のチラシや写真を提供する
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
