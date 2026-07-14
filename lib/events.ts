import type { Spot, Category, EventType } from './spots'
import { normalizeCategory, normalizeEventType } from './spots'

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
  address?: string
  fee?: string
  lat: number
  lng: number
  url?: string
  imageUrl?: string
  category?: Category
  /** 'event'=期間限定イベント, 'permanent'=常設施設（未指定時は 'event' 扱い） */
  type?: EventType
  collectedAt: string
  postedBy?: string
  email?: string
  posterType?: 'general' | 'organizer' | 'business' | 'staff'
  scheduleNote?: string
  likes?: number
  editedBy?: string
  editedAt?: string
  status?: 'pending' | 'approved' | 'rejected'
  pinColor?: string
  startTime?: string
  endTime?: string
  businessHours?: string
  spotLabel?: string
}

export type EventsDatabase = {
  events: CollectedEvent[]
  lastCollected: string | null
}

export function formatDateRange(event: CollectedEvent): string {
  if (event.type === 'permanent') return '常設施設'
  if (event.scheduleNote) return event.scheduleNote
  const start = event.startDate ?? event.date ?? ''
  const end   = event.endDate   ?? event.date ?? ''
  if (!start && !end) return '日程未定'
  if (start === end)  return start
  return `${start} 〜 ${end}`
}

export function eventToSpot(event: CollectedEvent): Spot {
  const start = event.startDate ?? event.date
  const end   = event.endDate   ?? event.date

  return {
    id: event.id,
    name: event.name,
    category: normalizeCategory(event.category),
    type: normalizeEventType(event.type),
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
    address: event.address,
    fee: event.fee,
    startDate: start,
    endDate: end,
    postedBy:     event.postedBy,
    posterType:   event.posterType,
    scheduleNote: event.scheduleNote,
    likes:        event.likes,
    editedBy:     event.editedBy,
    editedAt:     event.editedAt,
    pinColor:     event.pinColor,
    startTime:    event.startTime,
    endTime:      event.endTime,
    businessHours: event.businessHours,
    spotLabel:    event.spotLabel,
  }
}
