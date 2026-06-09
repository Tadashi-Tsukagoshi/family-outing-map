'use client'

import { useRef } from 'react'

const PEEK_HEIGHT = 72

export type SheetState = 'closed' | 'mid' | 'full'

const SHEET_HEIGHTS: Record<SheetState, string> = {
  closed: `${PEEK_HEIGHT}px`,
  mid:    '50vh',
  full:   '85vh',
}

type Props = {
  spotCount: number
  children: React.ReactNode
  sheetState: SheetState
  onSheetStateChange: (v: SheetState) => void
}

export default function BottomSheet({ spotCount, children, sheetState, onSheetStateChange }: Props) {
  const startY   = useRef(0)
  const currentY = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current   = e.touches[0].clientY
    currentY.current = e.touches[0].clientY
  }
  const onTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY
  }
  const onTouchEnd = () => {
    const delta = currentY.current - startY.current
    if (delta < -50) {
      if (sheetState === 'closed') onSheetStateChange('mid')
      else if (sheetState === 'mid') onSheetStateChange('full')
    }
    if (delta > 50) {
      if (sheetState === 'full') onSheetStateChange('mid')
      else if (sheetState === 'mid') onSheetStateChange('closed')
    }
  }

  const handleTap = () => {
    if (sheetState === 'closed') onSheetStateChange('mid')
    else if (sheetState === 'mid') onSheetStateChange('closed')
    else onSheetStateChange('mid')
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white flex flex-col overflow-hidden"
      style={{
        height:       SHEET_HEIGHTS[sheetState],
        transition:   'height 0.3s cubic-bezier(0.32,0.72,0,1)',
        borderRadius: '16px 16px 0 0',
        boxShadow:    '0 -4px 24px rgba(0,0,0,0.12)',
        zIndex:       1000,
      }}
    >
      {/* ハンドル + ピーク時ヘッダー */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleTap}
        className="flex-shrink-0 select-none cursor-pointer"
        style={{ touchAction: 'none' }}
      >
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-[22px] py-2">
          <span className="text-base font-semibold text-gray-900">イベント一覧</span>
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
