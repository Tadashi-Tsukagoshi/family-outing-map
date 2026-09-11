'use client'

import { createPortal } from 'react-dom'
import type { AreaCount } from './AreaChips'

type Props = {
  areas: AreaCount[]
  onSelect: (name: string) => void
  onClose: () => void
}

export default function AreaOtherModal({ areas, onSelect, onClose }: Props) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 bg-white flex flex-col" style={{ zIndex: 1002 }}>
      <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #f3f4f6' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="戻る"
          className="flex items-center justify-center cursor-pointer"
          style={{ width: 32, height: 32, fontSize: 20, color: '#374151', background: 'none', border: 'none' }}
        >
          ←
        </button>
        <h2 className="text-base font-semibold text-gray-900">エリア</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {areas.map((area) => (
          <button
            key={area.name}
            type="button"
            onClick={() => onSelect(area.name)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left cursor-pointer"
            style={{ borderBottom: '1px solid #f3f4f6' }}
          >
            <span className="text-sm text-gray-900">{area.name}</span>
            <span className="text-sm text-gray-400">{area.count}件</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  )
}
