'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORY_LABELS, getVisualCategory, type Category, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, fmtTimeRange, STATUS_CONFIG } from '@/lib/date-utils'
import { distanceKm } from '@/lib/geo'

type Props = {
  /** 表示順にソート済みのspot一覧 */
  spots: Spot[]
  userLocation: [number, number] | null
  onClose: () => void
  onOpenDetail: (spot: Spot) => void
}

function DiscoverCard({ spot, userLocation, onOpenDetail }: { spot: Spot; userLocation: [number, number] | null; onOpenDetail: () => void }) {
  const status = getEventStatus(spot.startDate, spot.endDate, spot.endTime)
  const dateLabel = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
  const timeLabel = fmtTimeRange(spot.startTime, spot.endTime)
  const categoryLabel = CATEGORY_LABELS[getVisualCategory(spot) as Category] ?? null
  const distanceLabel = userLocation ? distanceKm(userLocation, [spot.lat, spot.lng]).toFixed(1) : null

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', background: '#000' }}>
      {spot.imageUrl ? (
        <img
          src={spot.imageUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1f2937' }}>
          <span style={{ fontSize: 16, color: '#6b7280' }}>画像なし</span>
        </div>
      )}

      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '80px 20px max(28px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.55) 50%, rgba(0,0,0,0))',
          color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {categoryLabel && (
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.2)' }}>
              {categoryLabel}
            </span>
          )}
          {status === 'ended' && (
            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: STATUS_CONFIG.ended.bg, color: STATUS_CONFIG.ended.color }}>
              {STATUS_CONFIG.ended.label}
            </span>
          )}
          {distanceLabel && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              約 {distanceLabel} km
            </span>
          )}
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.35 }}>{spot.name}</h3>
        {dateLabel && <p style={{ fontSize: 14, margin: '0 0 4px', color: 'rgba(255,255,255,0.9)' }}>{dateLabel}{timeLabel ? ` ${timeLabel}` : ''}</p>}
        {spot.venue && <p style={{ fontSize: 14, margin: '0 0 16px', color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-line' }}>{spot.venue}</p>}

        <button
          type="button"
          onClick={onOpenDetail}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px 20px', borderRadius: 999, border: 'none',
            background: '#fff', color: '#111', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          詳細を見る
        </button>
      </div>
    </div>
  )
}

export default function DiscoverMode({ spots, userLocation, onClose, onOpenDetail }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1003, background: '#000' }}>
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'white', color: '#111',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          zIndex: 1,
        }}
      >
        ×
      </button>

      {spots.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14, padding: '0 32px', textAlign: 'center' }}>
          表示できるイベントがありません
        </div>
      ) : (
        <div
          className="no-scrollbar"
          style={{ height: '100dvh', overflowY: 'auto', scrollSnapType: 'y mandatory', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {spots.map((spot) => (
            <div key={spot.id} style={{ height: '100dvh', scrollSnapAlign: 'start', scrollSnapStop: 'always' }}>
              <DiscoverCard spot={spot} userLocation={userLocation} onOpenDetail={() => onOpenDetail(spot)} />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
