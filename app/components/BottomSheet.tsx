'use client'

import { useEffect, useRef, useState } from 'react'

export type SheetState = 'closed' | 'mid' | 'full'

type Props = {
  spotCount: number
  children: React.ReactNode
  sheetState: SheetState
  onSheetStateChange: (v: SheetState) => void
}

export default function BottomSheet({ spotCount, children, sheetState, onSheetStateChange }: Props) {
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
    mid:    '50vh',
    full:   '85vh',
  }

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
      className="fixed bottom-0 left-0 right-0 bg-white flex flex-col overflow-hidden"
      style={{
        height:       sheetHeights[sheetState],
        transition:   'height 0.3s cubic-bezier(0.32,0.72,0,1)',
        borderRadius: '16px 16px 0 0',
        boxShadow:    '0 -4px 24px rgba(0,0,0,0.12)',
        zIndex:       1000,
      }}
    >
      {/* ハンドル + ピーク時ヘッダー */}
      <div
        ref={headerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex-shrink-0 select-none cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-[22px] py-2">
          <span className="text-base font-semibold text-gray-900">スポット一覧</span>
          <span className="text-xs text-gray-500">{spotCount}件表示中</span>
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
