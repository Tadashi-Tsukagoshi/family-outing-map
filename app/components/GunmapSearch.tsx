'use client'

import { useMemo } from 'react'
import { getVisualCategory, type Spot } from '@/lib/spots'
import { getDateDisplayPadded } from '@/lib/date-utils'
import { searchSpots } from '@/lib/search'
import { CategoryIcon } from './Sidebar'

const MAX_RESULTS = 50

type Props = {
  query: string
  onQueryChange: (query: string) => void
  spots: Spot[]
  onSelect: (spot: Spot) => void
  /** 検索窓のフォーカス・フォーカス解除の通知（キーボード表示中のシート配置に使う） */
  onInputFocus?: () => void
  onInputBlur?: () => void
  /** 表示期間が終了イベントの年のとき、その年。検索対象はその年の終了イベントになり、終了日の新しい順に並べる */
  endedYear?: number | null
}

/** イベント検索シートの中身（検索窓と結果一覧）。モバイル専用。入力値は親が保持する */
export default function GunmapSearch({ query, onQueryChange, spots, onSelect, onInputFocus, onInputBlur, endedYear }: Props) {
  const results = useMemo(
    () => searchSpots(spots, query, endedYear ? 'endDesc' : 'startAsc'),
    [spots, query, endedYear],
  )
  const hasQuery = query.trim() !== ''

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onTouchStart={(e) => {
            // iOS Safari はフォーカス時に入力欄が見えるようページを自動スクロールするため、
            // タップの瞬間だけ入力欄を画面外に置いて「スクロールしても見えない」と判断させ、スクロールを起こさせない。
            // 次のフレームで必ず元に戻す（実際のタップによるフォーカスは元の位置で行われる）
            const input = e.currentTarget
            if (document.activeElement === input) return
            input.style.transform = 'translateY(-2000px)'
            input.focus({ preventScroll: true })
            requestAnimationFrame(() => { input.style.transform = '' })
          }}
          onFocus={(e) => {
            const input = e.currentTarget
            requestAnimationFrame(() => { input.style.transform = '' })
            onInputFocus?.()
          }}
          onBlur={() => onInputBlur?.()}
          onKeyDown={(e) => {
            // 日本語変換の確定 Enter で blur すると文字が二重に入力されるため、変換中は何もしない
            // （Safari は確定 Enter で isComposing が false になることがあるため keyCode 229 も判定する）
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder={endedYear ? `${endedYear}年の終了イベントから検索` : 'イベント名・会場・地名で検索'}
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
            onClick={() => onQueryChange('')}
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
