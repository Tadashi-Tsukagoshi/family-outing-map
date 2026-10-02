'use client'

import { useMemo, useState } from 'react'
import { getVisualCategory, type Spot } from '@/lib/spots'
import { getDateDisplayPadded } from '@/lib/date-utils'
import { searchSpots } from '@/lib/search'
import { CategoryIcon } from './Sidebar'

const MAX_RESULTS = 50

type Props = {
  spots: Spot[]
  onSelect: (spot: Spot) => void
  onFocusExpand?: () => void
}

/** ロゴピンのパネル内に置くイベント検索（β）。モバイル専用 */
export default function GunmapSearch({ spots, onSelect, onFocusExpand }: Props) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSpots(spots, query), [spots, query])
  const hasQuery = query.trim() !== ''

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>イベントを検索（β）</div>
      <div style={{ position: 'relative' }}>
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => onFocusExpand?.()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="イベント名・会場・地名で検索（β）"
          style={{
            display: 'block',
            width: '100%',
            fontSize: 16,
            padding: query ? '8px 36px 8px 12px' : '8px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            outline: 'none',
            background: '#fff',
            WebkitAppearance: 'none',
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="検索語をクリア"
            onClick={() => setQuery('')}
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#9ca3af', background: 'none', border: 'none',
            }}
          >
            ×
          </button>
        )}
      </div>

      {hasQuery && (
        results.length === 0 ? (
          <p style={{ marginTop: 10, fontSize: 13, color: '#9ca3af' }}>
            該当するイベントが見つかりませんでした
          </p>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{results.length}件</div>
            {results.slice(0, MAX_RESULTS).map((spot, idx) => {
              const dateText = getDateDisplayPadded(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
              const subText = [dateText, spot.venue].filter(Boolean).join('　')
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => onSelect(spot)}
                  className="w-full text-left flex items-center"
                  style={{
                    gap: 8,
                    padding: '10px 0',
                    borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none',
                    background: 'none',
                  }}
                >
                  <CategoryIcon category={getVisualCategory(spot)} size={20} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 14, color: '#111827' }}>{spot.name}</div>
                    {subText && (
                      <div className="truncate" style={{ fontSize: 12, color: '#6b7280' }}>{subText}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
