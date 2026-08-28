'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { BADGE_BG_COLOR, DEFAULT_NOTICE, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, STATUS_CONFIG, PARK_STATUS, fmtTimeRange } from '@/lib/date-utils'
import PhotoCarousel from './PhotoCarousel'
import PinchZoomImage from './PinchZoomImage'
import Lightbox from './Lightbox'

const POSTER_TYPE_LABELS: Record<string, string> = {
  general:   '一般ユーザー',
  organizer: '主催者',
  business:  '事業者',
  staff:     'GUNMAP',
}

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
    [INQUIRY_TYPE_ENTRY_ID]:   '写真のご提供',
    [INQUIRY_DETAIL_ENTRY_ID]: `【${eventName}】の写真提供：`,
  })
  return `${CONTACT_FORM_URL}?${params.toString()}`
}

const LIKED_EVENTS_KEY = 'outing-map-liked-events'

function hasLiked(id: string): boolean {
  try {
    const raw = localStorage.getItem(LIKED_EVENTS_KEY)
    return raw ? (JSON.parse(raw) as string[]).includes(id) : false
  } catch {
    return false
  }
}

function rememberLiked(id: string) {
  try {
    const raw = localStorage.getItem(LIKED_EVENTS_KEY)
    const ids = raw ? (JSON.parse(raw) as string[]) : []
    if (!ids.includes(id)) localStorage.setItem(LIKED_EVENTS_KEY, JSON.stringify([...ids, id]))
  } catch {}
}

function forgetLiked(id: string) {
  try {
    const raw = localStorage.getItem(LIKED_EVENTS_KEY)
    const ids = raw ? (JSON.parse(raw) as string[]) : []
    localStorage.setItem(LIKED_EVENTS_KEY, JSON.stringify(ids.filter((x) => x !== id)))
  } catch {}
}

const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土']
function fmtDateLabel(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEK_JA[d.getDay()]})`
}

function generateIcs(params: {
  title: string
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string
  venue?: string
  url?: string
}): void {
  const { title, startDate, endDate, startTime, endTime, venue, url } = params

  let dtStart: string
  let dtEnd: string

  if (startTime) {
    const toUtc = (date: string, time: string) => {
      const [y, m, d] = date.split('-').map(Number)
      const [h, min] = time.split(':').map(Number)
      const dt = new Date(Date.UTC(y, m - 1, d, h - 9, min))
      return dt.toISOString().replace(/[-:]/g, '').replace('.000', '')
    }
    dtStart = toUtc(startDate, startTime)
    dtEnd = endTime ? toUtc(endDate, endTime) : toUtc(endDate, startTime)
  } else {
    const toDate = (date: string) => date.replace(/-/g, '')
    dtStart = toDate(startDate)
    const end = new Date(endDate)
    end.setDate(end.getDate() + 1)
    const y = end.getFullYear()
    const mo = String(end.getMonth() + 1).padStart(2, '0')
    const d = String(end.getDate()).padStart(2, '0')
    dtEnd = `${y}${mo}${d}`
  }

  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//family-outing-map//JP',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@family-outing-map`,
    startTime ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    startTime ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escape(title)}`,
    venue ? `LOCATION:${escape(venue)}` : '',
    url ? `URL:${escape(url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${title}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}

type Props = {
  spot: Spot
  onClose: () => void
  onExpand?: () => void
  onCollapse?: () => void
  expanded?: boolean
  mobile?: boolean
}

export default function DetailPanel({ spot, onClose, onExpand, onCollapse, expanded = false, mobile = false }: Props) {
  // event_plus は複数ピンに分裂して spot.id がピンごとの合成idになるため、
  // 画像・いいねなど実イベントに紐づくAPI呼び出しは常に eventId（実イベントのid）を使う
  const eventId = spot.eventId ?? spot.id
  const [likes, setLikes] = useState(spot.likes ?? 0)
  const [liked, setLiked] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [galleryImages, setGalleryImages] = useState<{ imageUrl: string; caption: string | null }[]>([])
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  const startY   = useRef(0)
  const currentY = useRef(0)
  const likeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const likeRequestIdRef = useRef(0)

  const onHandleTouchStart = (e: React.TouchEvent) => {
    startY.current   = e.touches[0].clientY
    currentY.current = e.touches[0].clientY
  }
  const onHandleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY
  }
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    const delta = currentY.current - startY.current
    if (delta < -30) {
      onExpand?.()
    } else if (delta > 30) {
      if (expanded) onCollapse?.()
      else onClose()
    } else {
      if (expanded) onCollapse?.()
      else onClose()
    }
  }

  useEffect(() => {
    setLightboxIndex(null)
  }, [spot.id])

  useEffect(() => {
    setGalleryImages([])
    fetch(`/api/events/${eventId}/images`)
      .then(r => r.json())
      .then(d => setGalleryImages(Array.isArray(d.images)
        ? d.images.map((img: { imageUrl: string; caption?: string | null }) => ({ imageUrl: img.imageUrl, caption: img.caption ?? null }))
        : []))
      .catch(() => {})
  }, [eventId])

  useEffect(() => {
    const zoomControl = document.querySelector('.mapboxgl-ctrl-top-right .mapboxgl-ctrl-group') as HTMLElement | null
    if (zoomControl) {
      zoomControl.style.display = lightboxIndex !== null ? 'none' : ''
    }
    return () => {
      if (zoomControl) {
        zoomControl.style.display = ''
      }
    }
  }, [lightboxIndex])

  useEffect(() => {
    setLikes(spot.likes ?? 0)
    setLiked(hasLiked(eventId))
  }, [eventId, spot.likes])

  useEffect(() => {
    return () => {
      if (likeDebounceRef.current) clearTimeout(likeDebounceRef.current)
    }
  }, [])

  const handleLike = () => {
    const next = !liked
    setLiked(next)
    setLikes((n) => n + (next ? 1 : -1))
    if (next) rememberLiked(eventId)
    else      forgetLiked(eventId)

    if (likeDebounceRef.current) clearTimeout(likeDebounceRef.current)
    likeDebounceRef.current = setTimeout(() => {
      likeDebounceRef.current = null
      const requestId = ++likeRequestIdRef.current
      fetch(`/api/events/${eventId}/like`, { method: next ? 'POST' : 'DELETE' })
        .then((res) => res.json())
        .then((d) => {
          if (requestId === likeRequestIdRef.current && typeof d.likes === 'number') setLikes(d.likes)
        })
        .catch(() => {})
    }, 300)
  }

  const isPark      = spot.category === 'park'
  const status      = getEventStatus(spot.startDate, spot.endDate)
  const dateRange   = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
  const timeRange   = fmtTimeRange(spot.startTime, spot.endTime)
  const statusCfg   = isPark ? { ...PARK_STATUS, label: spot.spotLabel || PARK_STATUS.label } : (status ? STATUS_CONFIG[status] : null)
  const showStatus  = isPark || status === 'ended'
  const showDisclaimer = !isPark && status !== 'ended'
  const image       = spot.imageUrl || null
  const badgeBg     = BADGE_BG_COLOR
  const badgeColor  = '#4b5563'

  useEffect(() => {
    setImageLoadFailed(false)
  }, [image])

  const calendarButtonStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none',
    background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
  }

  const calendarButtons = spot.category === 'event_plus'
    ? (spot.eventDates ?? []).map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => generateIcs({
            title: spot.name,
            startDate: entry.startDate,
            endDate: entry.endDate,
            startTime: entry.startTime || undefined,
            endTime: entry.endTime || undefined,
            venue: entry.useCustomVenue ? entry.venue : spot.venue,
            url: spot.url || undefined,
          })}
          style={calendarButtonStyle}
        >
          📅 {fmtDateLabel(entry.startDate)} カレンダーに追加
        </button>
      ))
    : (!spot.scheduleNote && spot.startDate) ? (
        <button
          type="button"
          onClick={() => generateIcs({
            title: spot.name,
            startDate: spot.startDate!,
            endDate: spot.endDate || spot.startDate!,
            startTime: spot.startTime || undefined,
            endTime: spot.endTime || undefined,
            venue: spot.venue,
            url: spot.url || undefined,
          })}
          style={calendarButtonStyle}
        >
          📅 カレンダーに追加
        </button>
      ) : null

  const showImagePlaceholder = !image || imageLoadFailed

  const galleryImageUrls = useMemo(() => galleryImages.map(g => g.imageUrl), [galleryImages])
  const galleryCaptions  = useMemo(() => galleryImages.map(g => g.caption), [galleryImages])

  const hasGallery    = galleryImages.length > 0
  const isManualImage = !!spot.imageUrl
  const lightboxImages = hasGallery ? galleryImages.map(g => g.imageUrl) : (spot.imageUrl ? [spot.imageUrl] : [])

  const handleImageClick = () => {
    if (isManualImage) {
      setLightboxIndex(0)
    }
  }

  if (mobile) {
    return (
      <>
      <aside className="bg-white flex flex-col w-full h-full overflow-hidden">
        {/* ① ヘッダー層（固定） */}
        <div
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          className="shrink-0 select-none cursor-pointer"
          style={{ borderBottom: '1px solid #f3f4f6', touchAction: 'none' }}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-9 h-1 rounded-full bg-gray-300" />
          </div>
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{
                  fontSize: 18, fontWeight: 600, color: '#111', lineHeight: 1.4, margin: 0,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minWidth: 0,
                }}>
                  {spot.name}
                </h2>
                {isPark ? (
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>
                    {spot.businessHours || '未登録'}
                  </p>
                ) : (
                  dateRange && (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: 0 }}>
                        {dateRange}{timeRange ? ` ${timeRange}` : ''}
                      </p>
                      {showDisclaimer && (
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#111', margin: 0, whiteSpace: 'pre-line' }}>
                          {spot.notice || DEFAULT_NOTICE}
                        </p>
                      )}
                    </>
                  )
                )}
              </div>
              {statusCfg && showStatus && (
                <span style={{ fontSize: 14, fontWeight: 600, color: statusCfg.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {statusCfg.label}
                </span>
              )}
              {!statusCfg && spot.scheduleNote && (
                <span style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af', flexShrink: 0, whiteSpace: 'nowrap' }}>
                  日程未確定
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ②③④ スクロール領域 */}
        <div className="flex-1 overflow-y-auto">
          {/* ② 画像層 */}
          {hasGallery ? (
            <PhotoCarousel
              images={galleryImageUrls}
              captions={galleryCaptions}
              onPhotoClick={() => {}}
              mobile
            />
          ) : showImagePlaceholder ? (
            <div className="w-full bg-gray-100 flex items-center justify-center" style={{ height: 200 }}>
              <span className="text-base text-gray-500">画像なし</span>
            </div>
          ) : (
            <PinchZoomImage
              src={image}
              className="bg-gray-100"
              style={{ display: 'block', width: '100%', height: 'auto' }}
              onError={() => setImageLoadFailed(true)}
            />
          )}

          {/* ③ アクションバー層 */}
          <div style={{ padding: '6px 16px 8px' }}>
            <button
              onClick={handleLike}
              aria-pressed={liked}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: 0, border: 'none', background: 'none',
                cursor: 'pointer', alignSelf: 'flex-start',
              }}
            >
              <svg viewBox="0 0 24 24" width={20} height={20}>
                {liked ? (
                  <path
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    fill="#e11d48"
                  />
                ) : (
                  <path
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth={2}
                  />
                )}
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: liked ? '#e11d48' : '#6b7280' }}>
                {likes}
              </span>
            </button>
          </div>

          {/* ④ キャプション層 */}
          <div style={{ padding: '0 16px 20px' }}>
            {spot.venue && (
              <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>
                <span style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  background: badgeBg, color: '#111', fontSize: 14, fontWeight: 500,
                }}>
                  会場
                </span>
                <span style={{ whiteSpace: 'pre-line' }}>{spot.venue}</span>
              </p>
            )}

            {spot.address && (
              <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>
                <span style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  background: badgeBg, color: '#111', fontSize: 14, fontWeight: 500,
                }}>
                  住所
                </span>
                <span>{spot.address}</span>
              </p>
            )}

            <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>
              <span style={{
                display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                background: badgeBg, color: '#111', fontSize: 14, fontWeight: 500,
              }}>
                料金
              </span>
              {spot.fee && <span style={{ whiteSpace: 'pre-line' }}>{spot.fee}</span>}
            </p>

            <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 14, fontWeight: 500, color: '#111', lineHeight: 1.65, margin: '0 0 14px' }}>
              <span style={{
                display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                background: badgeBg, color: '#111', fontSize: 14, fontWeight: 500,
              }}>
                説明
              </span>
              {spot.description && <span>{spot.description}</span>}
            </p>

            {spot.postedBy && (
              <>
                <p style={{ display: 'flex', alignItems: 'baseline', fontSize: 11, color: '#111', margin: '0 0 24px' }}>
                  <span style={{
                    display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                    background: badgeBg, color: '#111', fontSize: 14, fontWeight: 500,
                  }}>
                    投稿
                  </span>
                  {spot.posterType && (
                    <span style={{
                      marginLeft: 6, marginRight: 6, padding: '1px 5px', borderRadius: 3,
                      background: '#f3f4f6', color: '#374151', fontSize: 12,
                    }}>
                      {POSTER_TYPE_LABELS[spot.posterType] ?? spot.posterType}
                    </span>
                  )}
                  {spot.posterType !== 'staff' && (
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{spot.postedBy}</span>
                  )}
                </p>
                {spot.editedAt && spot.posterType !== 'staff' && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', margin: '-18px 0 24px' }}>
                    <span aria-hidden style={{
                      display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                      fontSize: 10, fontWeight: 400, visibility: 'hidden',
                    }}>
                      投稿
                    </span>
                    運営により編集（{new Date(spot.editedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}）
                  </p>
                )}
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {calendarButtons}
              {spot.url && (
                <a
                  href={spot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
                >
                  公式サイトを開く
                </a>
              )}
              {spot.instagramUrl && (
                <a
                  href={spot.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
                >
                  Instagramを開く
                </a>
              )}
              {spot.xUrl && (
                <a
                  href={spot.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
                >
                  Xを開く
                </a>
              )}
              <a
                href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 0', borderRadius: 6,
                  color: '#374151',
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                  alignSelf: 'flex-start',
                  marginTop: -8,
                }}
              >
                Googleマップで開く
              </a>
            </div>

            <a
              href={buildCorrectionFormUrl(spot.name)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', marginTop: 16, paddingTop: 10,
                borderTop: '1px solid #f3f4f6',
                fontSize: 12, color: '#3b82f6', textDecoration: 'none',
              }}
            >
              情報の修正を依頼する
            </a>

            <a
              href={buildPhotoFormUrl(spot.name)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', marginTop: 8,
                fontSize: 12, color: '#3b82f6', textDecoration: 'none',
              }}
            >
              写真を提供する
            </a>
          </div>
        </div>
      </aside>

      {lightboxIndex !== null && typeof document !== 'undefined' && createPortal(
        <Lightbox
          images={lightboxImages}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />,
        document.body
      )}
      </>
    )
  }

  return (
    <>
    <aside className="bg-white flex flex-col overflow-hidden w-80 h-full shadow-lg">
      {/* ヘッダー層（固定） */}
      <div className="shrink-0" style={{ borderBottom: '1px solid #f3f4f6', padding: '14px 16px 12px' }}>
        {((statusCfg && showStatus) || (!statusCfg && spot.scheduleNote)) && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            {statusCfg && showStatus && (
              <span style={{ fontSize: 12, fontWeight: 600, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                {statusCfg.label}
              </span>
            )}
            {!statusCfg && spot.scheduleNote && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                日程未確定
              </span>
            )}
          </div>
        )}
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#111', lineHeight: 1.4, margin: 0 }}>
          {spot.name}
        </h2>
        {isPark ? (
          <p style={{ fontSize: 14, fontWeight: 400, color: '#4b5563', margin: '1px 0 0' }}>
            {spot.businessHours || '未登録'}
          </p>
        ) : (
          dateRange && (
            <>
              <p style={{ fontSize: 14, fontWeight: 400, color: '#111', margin: '1px 0 0' }}>
                {dateRange}{timeRange ? ` ${timeRange}` : ''}
              </p>
              {showDisclaimer && (
                <p style={{ fontSize: 12, fontWeight: 400, color: '#4b5563', margin: '1px 0 0', whiteSpace: 'pre-line' }}>
                  {spot.notice || DEFAULT_NOTICE}
                </p>
              )}
            </>
          )
        )}
      </div>

      {/* スクロール領域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 画像層 */}
        <div className="shrink-0">
          {hasGallery ? (
            <PhotoCarousel
              images={galleryImageUrls}
              captions={galleryCaptions}
              onPhotoClick={setLightboxIndex}
            />
          ) : showImagePlaceholder ? (
            <div className="w-full bg-gray-100 flex items-center justify-center" style={{ height: 200 }}>
              <span className="text-base text-gray-500">画像なし</span>
            </div>
          ) : (
            <img
              src={image}
              alt=""
              onClick={isManualImage ? handleImageClick : undefined}
              className="bg-gray-100"
              style={{
                display: 'block', width: '100%', height: 'auto',
                cursor: isManualImage ? 'pointer' : undefined,
              }}
              onError={() => setImageLoadFailed(true)}
            />
          )}
        </div>

        {/* アクションバー層 */}
        <div style={{ padding: '6px 16px 8px' }}>
          <button
            onClick={handleLike}
            aria-pressed={liked}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: 0, border: 'none', background: 'none',
              cursor: 'pointer', alignSelf: 'flex-start',
            }}
          >
            <svg viewBox="0 0 24 24" width={20} height={20}>
              {liked ? (
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="#e11d48"
                />
              ) : (
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth={2}
                />
              )}
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: liked ? '#e11d48' : '#6b7280' }}>
              {likes}
            </span>
          </button>
        </div>

        {/* コンテンツ層 */}
        <div style={{ padding: '0 16px 20px' }}>
        {spot.venue && (
          <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
            <span style={{
              display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
              background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 400,
            }}>
              会場
            </span>
            <span style={{ whiteSpace: 'pre-line' }}>{spot.venue}</span>
          </p>
        )}

        {spot.address && (
          <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
            <span style={{
              display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
              background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 400,
            }}>
              住所
            </span>
            <span>{spot.address}</span>
          </p>
        )}

        <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
          <span style={{
            display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
            background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 400,
          }}>
            料金
          </span>
          {spot.fee && <span style={{ whiteSpace: 'pre-line' }}>{spot.fee}</span>}
        </p>

        <p style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: '#4b5563', lineHeight: 1.65, margin: '0 0 14px' }}>
          <span style={{
            display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
            background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 400,
          }}>
            説明
          </span>
          {spot.description && <span>{spot.description}</span>}
        </p>

        {spot.postedBy && (
          <>
            <p style={{ display: 'flex', alignItems: 'baseline', fontSize: 11, color: '#6b7280', margin: '0 0 24px' }}>
              <span style={{
                display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                background: badgeBg, color: badgeColor, fontSize: 12, fontWeight: 400,
              }}>
                投稿
              </span>
              {spot.posterType && (
                <span style={{
                  marginLeft: 6, marginRight: 6, padding: '1px 5px', borderRadius: 3,
                  background: '#f3f4f6', color: '#374151', fontSize: 12,
                }}>
                  {POSTER_TYPE_LABELS[spot.posterType] ?? spot.posterType}
                </span>
              )}
              {spot.posterType !== 'staff' && (
                <span style={{ fontSize: 12, color: '#374151' }}>{spot.postedBy}</span>
              )}
            </p>
            {spot.editedAt && spot.posterType !== 'staff' && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', margin: '-18px 0 24px' }}>
                <span aria-hidden style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  fontSize: 10, fontWeight: 400, visibility: 'hidden',
                }}>
                  投稿
                </span>
                運営により編集（{new Date(spot.editedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })}）
              </p>
            )}
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calendarButtons}
          {spot.url && (
            <a
              href={spot.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
            >
              公式サイトを開く
            </a>
          )}
          {spot.instagramUrl && (
            <a
              href={spot.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
            >
              Instagramを開く
            </a>
          )}
          {spot.xUrl && (
            <a
              href={spot.xUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: '#374151', textDecoration: 'none' }}
            >
              Xを開く
            </a>
          )}
          <a
            href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 0', borderRadius: 6,
              color: '#374151',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
              alignSelf: 'flex-start',
              marginTop: -8,
            }}
          >
            Googleマップで開く
          </a>
        </div>

        <a
          href={buildCorrectionFormUrl(spot.name)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', marginTop: 16, paddingTop: 10,
            borderTop: '1px solid #f3f4f6',
            fontSize: 12, color: '#3b82f6', textDecoration: 'none',
          }}
        >
          情報の修正を依頼する
        </a>

        <a
          href={buildPhotoFormUrl(spot.name)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', marginTop: 8,
            fontSize: 12, color: '#3b82f6', textDecoration: 'none',
          }}
        >
          写真を提供する
        </a>
        </div>
      </div>
    </aside>

    {lightboxIndex !== null && typeof document !== 'undefined' && createPortal(
      <Lightbox
        images={lightboxImages}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />,
      document.body
    )}
    </>
  )
}
