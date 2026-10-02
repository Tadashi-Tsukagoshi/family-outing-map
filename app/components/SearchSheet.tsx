'use client'

import { useEffect, useRef, useState } from 'react'
import type { Spot } from '@/lib/spots'
import { buildSheetPositionStyle } from './BottomSheet'
import GunmapSearch from './GunmapSearch'

/** キーボード表示中・半開きのとき、見えている範囲（visualViewport）のうち上から何割を地図に残すか */
const KEYBOARD_MAP_RATIO = 0.4

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

/** 見えている範囲（visualViewport）の上端・高さと、その下端からレイアウト上の画面下端までの距離 */
type ViewportRect = { top: number; height: number; bottomInset: number }

function readViewportRect(vv: VisualViewport): ViewportRect {
  return {
    top: vv.offsetTop,
    height: vv.height,
    bottomInset: Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)),
  }
}

/** イベント検索のボトムシート（モバイル専用）。置き方・見た目はモバイル版の詳細シートと揃える */
export default function SearchSheet({ open, query, onQueryChange, spots, onSelect, onClose, bottomOffset, endedYear }: Props) {
  // 開いた直後は半開き。段階はヘッダーのスワイプ・タップでだけ変わる（検索窓のフォーカスでは変えない）。
  // シートは open の間だけマウントされるため、開くたびに 50dvh から始まる
  const [height, setHeight] = useState<'50dvh' | '100dvh'>('50dvh')
  const expanded = height === '100dvh'
  const startY   = useRef(0)
  const currentY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  // 検索窓にフォーカスしている間（＝キーボード表示中）は、見えている範囲（visualViewport）を基準に配置する。
  // iOS Safari はキーボード表示で visualViewport.height が縮み、useBottomOffset の bottomOffset がキーボードの高さ分まで
  // 大きくなるため、通常配置のままだとシートが持ち上がる。キーボード表示中は bottomOffset を使わず、
  // 下端をレイアウト上の画面下端（キーボードと半透明の帯の裏）に置いて地図が透けないようにする。
  // visualViewport が無い環境では viewportRect は null のままで、今までどおりの配置になる
  const [inputFocused, setInputFocused] = useState(false)
  const [viewportRect, setViewportRect] = useState<ViewportRect | null>(null)
  // キーボード表示中にヘッダー操作で段階を切り替えたときだけ top をアニメーションする（キーボード開閉の追従では切る）
  const [animateTop, setAnimateTop] = useState(false)

  const handleInputFocus = () => {
    setInputFocused(true)
    const vv = window.visualViewport
    if (vv) setViewportRect(readViewportRect(vv))
  }

  useEffect(() => {
    if (!viewportRect) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setAnimateTop(false)
      // フォーカスが外れた後は、キーボードが閉じた（resize が来た）時点で通常の配置に戻す。
      // 閉じきる前に戻すと bottomOffset がまだキーボード分大きく、一瞬シートが持ち上がるため
      if (!inputFocused) {
        setViewportRect(null)
        return
      }
      // Safari がフォーカス時にページ自体をスクロールした場合は戻す（地図など fixed でない要素がずれるため）
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
      setViewportRect(readViewportRect(vv))
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

  const changeStage = (next: '50dvh' | '100dvh') => {
    if (next === height) return
    if (viewportRect) setAnimateTop(true)
    setHeight(next)
  }

  // 閉じるときは検索窓のフォーカスも外してキーボードを閉じる
  const closeSheet = () => {
    const active = document.activeElement
    if (active instanceof HTMLElement && sheetRef.current?.contains(active)) active.blur()
    onClose()
  }

  // ヘッダーのスワイプ・タップ（DetailPanel のモバイル版と同じ動き。キーボード表示中も同じ）
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
      changeStage('100dvh')
    } else if (expanded) {
      changeStage('50dvh')
    } else {
      closeSheet()
    }
  }

  if (!open) return null

  const keyboardStyle: React.CSSProperties | null = viewportRect && {
    top: expanded ? viewportRect.top : viewportRect.top + viewportRect.height * KEYBOARD_MAP_RATIO,
    bottom: 0,
    height: 'auto',
    transition: animateTop ? 'top 0.3s cubic-bezier(0.32,0.72,0,1)' : 'none',
  }

  return (
    <div
      ref={sheetRef}
      className="detail-sheet-enter fixed left-0 right-0 z-[1001] overflow-hidden bg-white flex flex-col"
      style={{
        ...buildSheetPositionStyle({ height, bottomOffset }),
        ...keyboardStyle,
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

      {/* 本文（スクロール領域）。キーボード表示中は、キーボードと半透明の帯の裏に結果が隠れないよう下に余白をつける */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: `12px 16px ${12 + (viewportRect?.bottomInset ?? 0)}px`,
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      >
        <GunmapSearch
          query={query}
          onQueryChange={onQueryChange}
          spots={spots}
          onSelect={onSelect}
          onInputFocus={handleInputFocus}
          onInputBlur={() => setInputFocused(false)}
          endedYear={endedYear}
        />
      </div>
    </div>
  )
}
