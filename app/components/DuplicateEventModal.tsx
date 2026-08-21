'use client'

import { useState } from 'react'
import { CategoryIcon } from './Sidebar'
import { formatDateRange, type CollectedEvent } from '@/lib/events'

type Props = {
  events:   CollectedEvent[]
  onSelect: (ev: CollectedEvent) => void
  onClose:  () => void
}

/** 「既存イベントから複製」モーダル：登録済みイベントを選ぶとフォームにプリフィルする */
export default function DuplicateEventModal({ events, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')

  const filtered = events.filter(ev =>
    ev.name.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[70vh] rounded-xl bg-white shadow-xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <p className="text-sm font-medium text-gray-700 mb-2">既存イベントから複製</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="イベント名で検索"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">該当するイベントがありません</p>
          ) : (
            filtered.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelect(ev)}
                className="w-full flex items-start gap-2 text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <span className="mt-0.5 flex-shrink-0">
                  <CategoryIcon category={ev.category ?? 'event'} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-gray-800 truncate">{ev.name}</span>
                  <span className="block text-xs text-gray-400">{formatDateRange(ev)} · {ev.venue}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
