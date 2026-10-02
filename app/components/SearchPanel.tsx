'use client'

import type { Spot } from '@/lib/spots'
import GunmapSearch from './GunmapSearch'

type Props = {
  query: string
  onQueryChange: (query: string) => void
  spots: Spot[]
  onSelect: (spot: Spot) => void
  /** 表示期間が終了イベントの年のとき、その年（それ以外は null） */
  endedYear?: number | null
}

/** イベント検索パネル（PC専用）。PC版の詳細パネルと同じ場所・同じ見た目のヘッダーで表示する */
export default function SearchPanel({ query, onQueryChange, spots, onSelect, endedYear }: Props) {
  return (
    <aside className="bg-white flex flex-col overflow-hidden w-80 h-full shadow-lg">
      {/* ヘッダー層（固定）：PC版の詳細パネルと同じ余白・文字 */}
      <div className="shrink-0" style={{ borderBottom: '1px solid #f3f4f6', padding: '14px 16px 12px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#111', lineHeight: 1.4, margin: 0 }}>
          イベント検索
        </h2>
      </div>

      {/* スクロール領域 */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '12px 16px' }}>
        <GunmapSearch
          query={query}
          onQueryChange={onQueryChange}
          spots={spots}
          onSelect={onSelect}
          endedYear={endedYear}
        />
      </div>
    </aside>
  )
}
