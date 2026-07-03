'use client'

import { useState, useEffect } from 'react'
import { CATEGORY_LIGHT_COLORS, type Category, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, STATUS_CONFIG } from '@/lib/date-utils'

const POSTER_TYPE_LABELS: Record<string, string> = {
  general:   '一般ユーザー',
  organizer: '主催者',
  business:  '事業者',
  staff:     '運営',
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

const CATEGORY_IMAGES: Record<Category, string> = {
  event:     'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
  fireworks: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
  festival:  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
}

type Props = {
  spot: Spot
  onClose: () => void
  mobile?: boolean
}

export default function DetailPanel({ spot, onClose, mobile = false }: Props) {
  const [ogpImage, setOgpImage] = useState<string | null>(null)
  const [likes, setLikes] = useState(spot.likes ?? 0)
  const [liked, setLiked] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    setOgpImage(null)
    if (!spot.url || spot.imageUrl) return
    fetch(`/api/ogp?url=${encodeURIComponent(spot.url)}`)
      .then(r => r.json())
      .then(d => setOgpImage((d.imageUrl as string | null) ?? null))
      .catch(() => {})
  }, [spot.id, spot.url, spot.imageUrl])

  useEffect(() => {
    setLightboxOpen(false)
  }, [spot.id])

  useEffect(() => {
    setLikes(spot.likes ?? 0)
    setLiked(hasLiked(spot.id))
  }, [spot.id, spot.likes])

  const handleLike = async () => {
    const next = !liked
    setLiked(next)
    setLikes((n) => n + (next ? 1 : -1))
    if (next) rememberLiked(spot.id)
    else      forgetLiked(spot.id)
    try {
      const res = await fetch(`/api/events/${spot.id}/like`, { method: next ? 'POST' : 'DELETE' })
      const d = await res.json()
      if (typeof d.likes === 'number') setLikes(d.likes)
    } catch {}
  }

  const status      = getEventStatus(spot.startDate, spot.endDate)
  const dateRange   = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate)
  const statusCfg   = status ? STATUS_CONFIG[status] : null
  const image       = spot.imageUrl || ogpImage || CATEGORY_IMAGES[spot.category]
  const badgeBg     = CATEGORY_LIGHT_COLORS[spot.category]
  const badgeColor  = '#374151'

  const isManualImage = !!spot.imageUrl
  const isOgpImage    = !spot.imageUrl && !!ogpImage && !!spot.url

  const handleImageClick = () => {
    if (isManualImage) {
      setLightboxOpen(true)
    } else if (isOgpImage) {
      window.open(spot.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
    <aside className={`bg-white flex flex-col overflow-hidden ${mobile ? 'w-full h-full' : 'w-72 h-full shadow-lg'}`}>
      {/* ヘッダー画像 */}
      <div className="relative shrink-0">
        <img
          src={image}
          alt=""
          onClick={(isManualImage || isOgpImage) ? handleImageClick : undefined}
          style={{
            display: 'block', width: '100%', height: 160, objectFit: 'cover',
            cursor: (isManualImage || isOgpImage) ? 'pointer' : undefined,
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = CATEGORY_IMAGES[spot.category] }}
        />
        <button
          onClick={onClose}
          aria-label="閉じる"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 28, height: 28, borderRadius: '50%',
            background: 'white', color: '#111',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, lineHeight: 1,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        >
          ×
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 16px 20px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 400, color: '#111', lineHeight: 1.4, margin: '0 0 1px' }}>
          {spot.name}
        </h2>

        {(statusCfg || spot.scheduleNote || dateRange) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 8 }}>
            {statusCfg && (
              <span style={{ fontSize: 14, fontWeight: 600, color: statusCfg.color }}>
                {statusCfg.label}
              </span>
            )}
            {!statusCfg && spot.scheduleNote && (
              <span style={{ fontSize: 14, fontWeight: 600, color: '#9ca3af' }}>
                日程未確定
              </span>
            )}
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
            {dateRange && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', margin: 0 }}>
                <span style={{
                  display: 'inline-block', padding: '1px 4px', borderRadius: 4,
                  background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 400,
                }}>
                  日時
                </span>
                {dateRange}
              </p>
            )}
          </div>
        )}

        {spot.venue && (
          <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
            <span style={{
              display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
              background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 400,
            }}>
              会場
            </span>
            <span>{spot.venue}</span>
          </p>
        )}

        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#374151', margin: '0 0 8px' }}>
          <span style={{
            display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
            background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 400,
          }}>
            料金
          </span>
          {spot.fee && <span>{spot.fee}</span>}
        </p>

        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#4b5563', lineHeight: 1.65, margin: '0 0 14px' }}>
          <span style={{
            display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
            background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 400,
          }}>
            説明
          </span>
          {spot.description && <span>{spot.description}</span>}
        </p>

        {spot.postedBy && (
          <>
            <p style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: '#6b7280', margin: '0 0 24px' }}>
              <span style={{
                display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 400,
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
              <span style={{ fontSize: 12, color: '#374151' }}>{spot.postedBy}</span>
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
      </div>
    </aside>

    {lightboxOpen && isManualImage && (
      <div
        onClick={() => setLightboxOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <button
          onClick={() => setLightboxOpen(false)}
          aria-label="閉じる"
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 36, height: 36, borderRadius: '50%',
            background: 'white', color: '#111',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, lineHeight: 1,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          ×
        </button>
        <img
          src={spot.imageUrl}
          alt=""
          style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
        />
      </div>
    )}
    </>
  )
}
