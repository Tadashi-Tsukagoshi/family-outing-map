export type Category = 'event' | 'music' | 'exhibition'

export type Spot = {
  id: string
  name: string
  category: Category
  lat: number
  lng: number
  description: string
  weekendDates: string[] // ISO date strings (e.g. "2026-05-16")
  url?: string
  imageUrl?: string
  source?: 'manual' | 'collected'
  date?: string      // 後方互換用（endDate の別名）
  venue?: string     // 会場名
  fee?: string       // 料金
  startDate?: string // イベント開始日（ISO）
  endDate?: string   // イベント終了日（ISO）
  postedBy?: string
  posterType?: 'general' | 'organizer' | 'business' | 'staff'
  scheduleNote?: string
  likes?: number
  editedBy?: string
  editedAt?: string
}


export const CATEGORY_LABELS: Record<Category, string> = {
  event:      'イベント',
  music:      '音楽',
  exhibition: '展示会',
}

export const CATEGORY_EMOJIS: Record<Category, string> = {
  event:      '🎉',
  music:      '🎵',
  exhibition: '🖼️',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  event:      '#a855f7',
  music:      '#ec4899',
  exhibition: '#3b82f6',
}

export const ICON_PATHS: Record<Category, string> = {
  event:      'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  music:      'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  exhibition: 'M12 3L2 9h20zM2 9h20v2H2zM4 11h2v9H4zM11 11h2v9h-2zM18 11h2v9h-2zM2 20h20v2H2z',
}
