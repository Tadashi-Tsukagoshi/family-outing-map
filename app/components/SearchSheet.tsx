'use client'

import { useRef, useState } from 'react'
import type { Spot } from '@/lib/spots'
import { buildSheetPositionStyle } from './BottomSheet'
import GunmapSearch from './GunmapSearch'

type Props = {
  open: boolean
  query: string
  onQueryChange: (query: string) => void
  spots: Spot[]
  onSelect: (spot: Spot) => void
  onClose: () => void
  bottomOffset: number
  /** 表示期間が終了イベントの年のとき、その年（それ以外は null） */
  endedYear?: number | null
}

/** イベント検索のボトムシート（モバイル専用）。置き方・見た目はモバイル版の詳細シートと揃える */
export default function SearchSheet({ open, query, onQueryChange, spots, onSelect, onClose, bottomOffset, endedYear }: Props) {
  // 開いた直後は半開き。シートは open の間だけマウントされるため、開くたびに 50dvh から始まる
  const [height, setHeight] = useState<'50dvh' | '100dvh'>('50dvh')
  const expanded = height === '100dvh'
  const startY   = useRef(0)
  const currentY = useRef(0)

  // ヘッダーのスワイプ・タップ（DetailPanel のモバイル版と同じ動き）
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current   = e.touches[0].clientY
    currentY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    const delta = currentY.current - startY.current
    if (delta < -30) {
      setHeight('100dvh')
    } else if (expanded) {
      setHeight('50dvh')
    } else {
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      className="detail-sheet-enter fixed left-0 right-0 z-[1001] overflow-hidden bg-white flex flex-col"
      style={{
        ...buildSheetPositionStyle({ height, bottomOffset }),
        boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
      }}
    >
      {/* ヘッダー（固定）：BottomSheet のヘッダーと同じ作り */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-shrink-0 select-none cursor-pointer border-b border-gray-200"
        style={{ touchAction: 'none' }}
      >
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-[22px] py-2">
          <span className="text-base font-semibold text-gray-900">イベント検索</span>
        </div>
      </div>

      {/* 本文（スクロール領域） */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: '12px 16px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <GunmapSearch
          query={query}
          onQueryChange={onQueryChange}
          spots={spots}
          onSelect={onSelect}
          onFocusExpand={() => { if (!expanded) setHeight('100dvh') }}
          endedYear={endedYear}
        />
      </div>
    </div>
  )
}
