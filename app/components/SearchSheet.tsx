'use client'

import { useEffect, useRef, useState } from 'react'
import type { Spot } from '@/lib/spots'
import { buildSheetPositionStyle } from './BottomSheet'
import GunmapSearch from './GunmapSearch'

/** 半開きのとき、シート上端を画面の上から何割の位置に置くか（キーボードの有無に関係なく同じ位置） */
const SEARCH_SHEET_TOP_RATIO = 0.2
/** キーボード表示中の半開きで、見えている範囲に最低限残すシートの高さ（px）。ヘッダー・検索窓・結果1件ほど */
const SEARCH_SHEET_MIN_VISIBLE = 180
const TOP_TRANSITION = 'top 0.3s cubic-bezier(0.32,0.72,0,1)'

/** 半開きの上端位置（px）。キーボードが無い状態の見えている範囲の高さから計算する */
function calcHalfTopPx(viewportHeight: number): number {
  return viewportHeight * SEARCH_SHEET_TOP_RATIO
}

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
  // シートは open の間だけマウントされるため、開くたびに半開きから始まる
  const [stage, setStage] = useState<'half' | 'full'>('half')
  const expanded = stage === 'full'
  const startY   = useRef(0)
  const currentY = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  // 半開きの上端位置（px）。dvh（下端基準）と innerHeight（上端基準）は iOS Safari のツールバー状態で基準がずれるため、
  // シートを開いた瞬間（キーボードが無い状態）の見えている範囲の高さから1回だけ計算し、キーボードの有無に関係なく使う。
  // シートは open の間だけマウントされるため、この初期値は開いた瞬間に計算される
  const [halfTopPx, setHalfTopPx] = useState(() =>
    calcHalfTopPx(window.visualViewport?.height ?? window.innerHeight),
  )

  // 検索窓にフォーカスしている間（＝キーボード表示中）は、見えている範囲（visualViewport）を基準に配置する。
  // iOS Safari はキーボード表示で visualViewport.height が縮み、useBottomOffset の bottomOffset がキーボードの高さ分まで
  // 大きくなるため、通常配置のままだとシートが持ち上がる。キーボード表示中は bottomOffset を使わず、
  // 下端をレイアウト上の画面下端（キーボードと半透明の帯の裏）に置いて地図が透けないようにする。
  // visualViewport が無い環境では viewportRect は null のままで、今までどおりの配置になる
  const [inputFocused, setInputFocused] = useState(false)
  const inputFocusedRef = useRef(false)
  const [viewportRect, setViewportRect] = useState<ViewportRect | null>(null)
  // キーボード表示中にヘッダー操作で段階を切り替えたときだけ top をアニメーションする（キーボード開閉の追従では切る）
  const [animateTop, setAnimateTop] = useState(false)

  const handleInputFocus = () => {
    setInputFocused(true)
    inputFocusedRef.current = true
    const vv = window.visualViewport
    if (vv) setViewportRect(readViewportRect(vv))
  }
  const handleInputBlur = () => {
    setInputFocused(false)
    inputFocusedRef.current = false
  }

  // シートが開いている間は、iOS Safari がフォーカス時・キーボード表示時にページ（レイアウトビューポート）を
  // 自動スクロールして地図やチップごと画面全体が上にずれるのを防ぐ。
  // ページのスクロールを止め、それでもスクロールされた場合は scroll イベントで (0, 0) に戻す。
  // 閉じたとき（結果タップで閉じた場合を含む）・コンポーネントが外れたときは cleanup で元の値に戻す
  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    const resetScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0)
    }
    window.addEventListener('scroll', resetScroll)
    return () => {
      window.removeEventListener('scroll', resetScroll)
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [open])

  // 画面の回転などで見えている範囲の幅が変わったときだけ、半開きの上端位置を計算し直す
  // （キーボードによる高さの変化では計算し直さない）
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    let lastWidth = vv.width
    const onResize = () => {
      if (vv.width === lastWidth) return
      lastWidth = vv.width
      // キーボード表示中に回転した場合は、キーボードで縮まない innerHeight を使う
      setHalfTopPx(calcHalfTopPx(inputFocusedRef.current ? window.innerHeight : vv.height))
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [open])

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

  const changeStage = (next: 'half' | 'full') => {
    if (next === stage) return
    if (viewportRect) setAnimateTop(true)
    setStage(next)
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
      changeStage('full')
    } else if (expanded) {
      changeStage('half')
    } else {
      closeSheet()
    }
  }

  if (!open) return null

  // 半開き・全開とも上端基準（top と bottom）で配置し、height は指定しない
  const positionStyle: React.CSSProperties = viewportRect
    ? {
        // キーボード表示中：見えている範囲の上端（vvTop）を基準にし、下端はキーボードと半透明の帯の裏（bottom: 0）まで伸ばす。
        // 半開きは小さい画面で検索窓がキーボードに隠れないよう、見えている範囲に SEARCH_SHEET_MIN_VISIBLE は残す
        top: expanded
          ? viewportRect.top
          : Math.min(
              viewportRect.top + halfTopPx,
              viewportRect.top + viewportRect.height - SEARCH_SHEET_MIN_VISIBLE,
            ),
        bottom: 0,
        transition: animateTop ? TOP_TRANSITION : 'none',
      }
    : {
        // キーボードなし：下端は他のシートと同じ値（buildSheetPositionStyle の bottomOffset による持ち上げ）
        top: expanded ? 0 : halfTopPx,
        transition: TOP_TRANSITION,
      }

  return (
    <div
      ref={sheetRef}
      className="detail-sheet-enter fixed left-0 right-0 z-[1001] overflow-hidden bg-white flex flex-col"
      style={{
        ...buildSheetPositionStyle({ height: 'auto', bottomOffset }),
        ...positionStyle,
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
          onInputBlur={handleInputBlur}
          endedYear={endedYear}
        />
      </div>
    </div>
  )
}
