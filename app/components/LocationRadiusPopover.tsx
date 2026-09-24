'use client'

import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type Position = { top: number; right: number }

export type LocationOption =
  | { kind: 'off' }
  | { kind: 'radius'; value: number }

type Props = {
  radiusOptions: number[]
  currentValue: 'off' | number
  anchorEl: HTMLElement | null
  onSelect: (option: LocationOption) => void
  onClose: () => void
}

export default function LocationRadiusPopover({
  radiusOptions,
  currentValue,
  anchorEl,
  onSelect,
  onClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  // アンカー（現在地チップ）の現在位置を追従
  useLayoutEffect(() => {
    if (!anchorEl) return
    const update = () => {
      const rect = anchorEl.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorEl])

  // 外側クリックで閉じる（アンカー自身は無視 → 二度押し時は親側でトグル）
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchorEl?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [anchorEl, onClose])

  // Escapeで閉じる
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (typeof document === 'undefined') return null
  if (!anchorEl || !position) return null

  const isOffActive = currentValue === 'off'

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed bg-white rounded-lg overflow-hidden flex flex-col"
      style={{
        top: position.top,
        right: position.right,
        width: 160,
        maxHeight: 'min(360px, 60dvh)',
        zIndex: 1002,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)',
      }}
    >
      <div className="overflow-y-auto">
        <button
          type="button"
          onClick={() => onSelect({ kind: 'off' })}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 cursor-pointer"
          style={{ borderBottom: '1px solid #f3f4f6' }}
        >
          <span className={`text-sm ${isOffActive ? 'text-gray-900 font-semibold' : 'text-gray-900'}`}>現在地オフ</span>
        </button>
        {radiusOptions.map((r) => {
          const isActive = currentValue === r
          return (
            <button
              key={r}
              type="button"
              onClick={() => onSelect({ kind: 'radius', value: r })}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 cursor-pointer"
              style={{ borderBottom: '1px solid #f3f4f6' }}
            >
              <span className={`text-sm ${isActive ? 'text-gray-900 font-semibold' : 'text-gray-900'}`}>半径{r}km</span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
