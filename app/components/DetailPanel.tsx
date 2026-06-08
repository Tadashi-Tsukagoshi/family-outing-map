'use client'

import { useState, useEffect } from 'react'
import { CATEGORY_COLORS, ICON_PATHS, type Category, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, STATUS_CONFIG } from '@/lib/date-utils'

const POSTER_TYPE_LABELS: Record<string, string> = {
  general:   '一般ユーザー',
  organizer: '主催者',
  business:  '事業者',
  staff:     'サイト管理者',
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
  park:       'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=400',
  museum:     'https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=400',
  playground: 'https://images.unsplash.com/photo-1576398289164-c48dc021b4e1?w=400',
  food:       'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400',
  event:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400',
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

  useEffect(() => {
    setOgpImage(null)
    if (!spot.url) return
    fetch(`/api/ogp?url=${encodeURIComponent(spot.url)}`)
      .then(r => r.json())
      .then(d => setOgpImage((d.imageUrl as string | null) ?? null))
      .catch(() => {})
  }, [spot.id, spot.url])

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

  const status    = getEventStatus(spot.startDate, spot.endDate)
  const dateRange = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate)
  const statusCfg = status ? STATUS_CONFIG[status] : null
  const image     = ogpImage ?? CATEGORY_IMAGES[spot.category]
  const iconSize  = 11

  return (
    <aside className={`bg-white flex flex-col overflow-hidden ${mobile ? 'w-full h-full' : 'w-72 border-r border-gray-200'}`}>
      {/* ヘッダー画像 */}
      <div className="relative shrink-0">
        <img
          src={image}
          alt=""
          style={{ display: 'block', width: '100%', height: 160, objectFit: 'cover' }}
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
        {/* カテゴリアイコン */}
        <span style={{
          position: 'absolute', bottom: 8, left: 12,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: '50%',
          backgroundColor: CATEGORY_COLORS[spot.category],
          boxShadow: '0 1px 4px rgba(0,0,0,.3)',
        }}>
          <svg viewBox="0 0 24 24" width={iconSize} height={iconSize} fill="white">
            <path d={ICON_PATHS[spot.category]} fillRule="nonzero" />
          </svg>
        </span>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '14px 16px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111', lineHeight: 1.4, margin: '0 0 8px' }}>
          {spot.name}
        </h2>

        <button
          onClick={handleLike}
          aria-pressed={liked}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 999,
            border: liked ? '1px solid #fda4af' : '1px solid #e5e7eb',
            background: liked ? '#fff1f2' : '#fff',
            color: liked ? '#e11d48' : '#6b7280',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            margin: '0 0 10px',
          }}
        >
          <span aria-hidden="true">{liked ? '❤️' : '🤍'}</span>
          いいね
          <span>{likes}</span>
        </button>

        {(statusCfg || dateRange) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {statusCfg && (
              <span style={{
                padding: '2px 6px', borderRadius: 4, fontSize: 10,
                fontWeight: 700, background: statusCfg.bg, color: statusCfg.color,
              }}>
                {statusCfg.label}
              </span>
            )}
            {dateRange && (
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>📅 {dateRange}</p>
            )}
          </div>
        )}

        {spot.venue && (
          <p style={{ fontSize: 12, color: '#374151', margin: '0 0 8px' }}>📍 {spot.venue}</p>
        )}

        {spot.description && (
          <p style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.65, margin: '0 0 14px' }}>
            {spot.description}
          </p>
        )}

        {spot.postedBy && (
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 12px' }}>
            👤
            {spot.posterType && (
              <span style={{
                marginLeft: 6, marginRight: 6, padding: '1px 5px', borderRadius: 3,
                background: '#f3f4f6', color: '#6b7280', fontSize: 10,
              }}>
                {POSTER_TYPE_LABELS[spot.posterType] ?? spot.posterType}
              </span>
            )}
            {spot.postedBy}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {spot.url && (
            <a
              href={spot.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
            >
              公式サイトを開く ↗
            </a>
          )}
          <a
            href={`https://maps.google.com/?q=${spot.lat},${spot.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 6,
              background: '#f0fdf4', color: '#15803d',
              fontSize: 12, fontWeight: 600, textDecoration: 'none',
              alignSelf: 'flex-start',
            }}
          >
            Googleマップで開く ↗
          </a>
        </div>
      </div>
    </aside>
  )
}
