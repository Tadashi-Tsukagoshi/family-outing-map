import type { Spot, Category } from './spots'

export type CollectedEvent = {
  id: string
  name: string
  description: string
  /** 単一日付（AI収集イベント用） */
  date?: string
  /** イベント開始日（手動登録またはAI収集で設定） */
  startDate?: string
  /** イベント終了日 */
  endDate?: string
  venue: string
  lat: number
  lng: number
  url?: string
  imageUrl?: string
  category?: Category
  collectedAt: string
  postedBy?: string
  posterType?: 'general' | 'organizer' | 'business' | 'staff'
  scheduleNote?: string
  likes?: number
}

export type EventsDatabase = {
  events: CollectedEvent[]
  lastCollected: string | null
}

export function eventToSpot(event: CollectedEvent): Spot {
  const start = event.startDate ?? event.date
  const end   = event.endDate   ?? event.date

  return {
    id: event.id,
    name: event.name,
    category: event.category ?? 'event',
    lat: event.lat,
    lng: event.lng,
    description: event.description,
    // weekendDates は旧スポット互換用。期間フィルタは startDate/endDate で行う
    weekendDates: end ? [end] : [],
    url: event.url,
    imageUrl: event.imageUrl,
    source: 'collected',
    date: end,       // 旧表示コード互換
    venue: event.venue,
    startDate: start,
    endDate: end,
    postedBy:     event.postedBy,
    posterType:   event.posterType,
    scheduleNote: event.scheduleNote,
    likes:        event.likes,
  }
}
