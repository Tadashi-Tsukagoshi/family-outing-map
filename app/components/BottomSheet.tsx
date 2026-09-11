'use client'

import { useEffect, useRef, useState } from 'react'

export type SheetState = 'closed' | 'mid' | 'full'

// Android Chromeのボトムナビバー対応: visualViewportの下端とウィンドウ下端の差分をオフセットとして適用
// イベント一覧・イベント詳細の両ボトムシートで共有する単一のインスタンスとして、呼び出し元（MapApp）で一度だけ使う
export function useBottomOffset(): number {
  const [bottomOffset, setBottomOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setBottomOffset(window.innerHeight - vv.height - vv.offsetTop)
    }
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  return bottomOffset
}

// イベント一覧・イベント詳細の両ボトムシートで共通の位置決めスタイルを生成する。
// 高さ・下端位置の計算式を1箇所に集約し、2つのシートの見た目のズレを防ぐ。
export function buildSheetPositionStyle(params: { height: string; bottomOffset: number }): React.CSSProperties {
  const { height, bottomOffset } = params
  return {
    height,
    bottom:     `${bottomOffset > 0 ? bottomOffset + 10 : 0}px`,
    borderRadius: '16px 16px 0 0',
    transition: 'height 0.3s cubic-bezier(0.32,0.72,0,1)',
  }
}

type Props = {
  title?: string
  spotCount: number
  children: React.ReactNode
  sheetState: SheetState
  onSheetStateChange: (v: SheetState) => void
  bottomOffset: number
  /** 現在のシート高さ（CSS height文字列）が変わるたびに通知する。エリアチップ行の追従に使う */
  onHeightChange?: (height: string) => void
}

export default function BottomSheet({ title = 'イベント一覧', spotCount, children, sheetState, onSheetStateChange, bottomOffset, onHeightChange }: Props) {
  const startY   = useRef(0)
  const currentY = useRef(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const [peekHeight, setPeekHeight] = useState(72)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const update = () => setPeekHeight(el.offsetHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sheetHeights: Record<SheetState, string> = {
    closed: `${peekHeight}px`,
    mid:    '50dvh',
    full:   '100dvh',
  }
  const currentHeight = sheetHeights[sheetState]

  useEffect(() => {
    onHeightChange?.(currentHeight)
  }, [currentHeight, onHeightChange])

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
      if (sheetState === 'closed') onSheetStateChange('mid')
      else if (sheetState === 'mid') onSheetStateChange('full')
    } else if (delta > 30) {
      if (sheetState === 'full') onSheetStateChange('mid')
      else if (sheetState === 'mid') onSheetStateChange('closed')
    } else {
      if (sheetState === 'closed') onSheetStateChange('mid')
      else if (sheetState === 'mid') onSheetStateChange('closed')
      else onSheetStateChange('mid')
    }
  }

  return (
    <div
      className="fixed left-0 right-0 bg-white flex flex-col overflow-hidden"
      style={{
        ...buildSheetPositionStyle({ height: currentHeight, bottomOffset }),
        boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        zIndex:    1000,
      }}
    >
      {/* ハンドル + ピーク時ヘッダー */}
      <div
        ref={headerRef}
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
          <span className="text-base font-semibold text-gray-900">{title}</span>
          <span className="text-white px-2 py-0.5 rounded-full text-xs font-medium" style={{background: 'linear-gradient(to right, #2f50c7, #5fb48c)'}}>{spotCount}件表示中</span>
        </div>
      </div>

      {/* スクロール可能なサイドバーコンテンツ */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}
