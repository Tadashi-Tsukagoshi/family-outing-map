'use client'

import { useEffect, useRef, useState } from 'react'
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

  // 検索窓にフォーカスしている間（＝キーボード表示中）は、実際に見えている範囲（visualViewport）に合わせて配置する。
  // iOS Safari はキーボード表示で visualViewport.height が縮み、useBottomOffset の bottomOffset がキーボードの高さ分まで
  // 大きくなる一方、100dvh はキーボードで縮まないため、bottom 基準のままだとシート上部が画面外に押し出される。
  // visualViewport が無い環境では viewportRect は null のままで、今までどおりの配置になる
  const [inputFocused, setInputFocused] = useState(false)
  const [viewportRect, setViewportRect] = useState<{ top: number; height: number } | null>(null)

  const handleInputFocus = () => {
    setInputFocused(true)
    const vv = window.visualViewport
    if (vv) setViewportRect({ top: vv.offsetTop, height: vv.height })
  }

  useEffect(() => {
    if (!viewportRect) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      // フォーカスが外れた後は、キーボードが閉じた（resize が来た）時点で通常の配置に戻す。
      // 閉じきる前に戻すと bottomOffset がまだキーボード分大きく、一瞬シート上部が画面外に出るため
      if (!inputFocused) {
        setViewportRect(null)
        return
      }
      // Safari がフォーカス時にページ自体をスクロールした場合は戻す（地図など fixed でない要素がずれるため）
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
      setViewportRect({ top: vv.offsetTop, height: vv.height })
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    // キーボードを閉じても resize が来ない環境向けに、フォーカス解除後は一定時間で通常の配置に戻す
    const fallback = inputFocused ? undefined : setTimeout(() => setViewportRect(null), 600)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      if (fallback) clearTimeout(fallback)
    }
  }, [viewportRect, inputFocused])

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
        // キーボード表示中は見えている範囲に top 基準で合わせ、開閉中のちらつきを防ぐため高さの transition を切る
        ...(viewportRect
          ? { top: viewportRect.top, height: viewportRect.height, bottom: 'auto', transition: 'none' }
          : {}),
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
          onInputFocus={handleInputFocus}
          onInputBlur={() => setInputFocused(false)}
          endedYear={endedYear}
        />
      </div>
    </div>
  )
}
