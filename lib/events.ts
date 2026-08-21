import type { Spot, Category, EventType, EventDateEntry } from './spots'
import { normalizeCategory, normalizeEventType, resolveEventPlusOccurrences } from './spots'

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
  instagramUrl?: string
  xUrl?: string
  imageUrl?: string
  category?: Category
  /** 'event'=期間限定イベント, 'permanent'=常設施設（未指定時は 'event' 扱い） */
  type?: EventType
  collectedAt: string
  postedBy?: string
  email?: string
  posterType?: 'general' | 'organizer' | 'business' | 'staff'
  scheduleNote?: string
  /** カンマ区切りの個別指定日（例："2026-09-12,2026-09-16"） */
  specificDates?: string | null
  notice?: string
  likes?: number
  editedBy?: string
  editedAt?: string
  status?: 'pending' | 'approved' | 'rejected'
  startTime?: string
  endTime?: string
  businessHours?: string
  spotLabel?: string
  /** category='event_plus' の複数日程（event_dates テーブル由来） */
  eventDates?: EventDateEntry[]
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

  const spot: Spot = {
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
    instagramUrl: event.instagramUrl,
    xUrl: event.xUrl,
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
    specificDates: event.specificDates,
    notice:       event.notice,
    likes:        event.likes,
    editedBy:     event.editedBy,
    editedAt:     event.editedAt,
    startTime:    event.startTime,
    endTime:      event.endTime,
    businessHours: event.businessHours,
    spotLabel:    event.spotLabel,
    eventDates:   event.eventDates,
  }

  // event_plus: event_dates から直近の次回開催日を選び、Spot本体の日程・会場・位置として使う
  // （地図上の複数ピン表示は eventPlusPins を参照して呼び出し側で組み立てる）
  if (spot.category === 'event_plus') {
    const pins = resolveEventPlusOccurrences(spot)
    spot.eventPlusPins = pins
    if (pins.length > 0) {
      const primary = pins[0]
      spot.startDate = primary.startDate
      spot.endDate   = primary.endDate
      spot.venue     = primary.venue
      spot.address   = primary.address
      spot.lat       = primary.lat
      spot.lng       = primary.lng
      spot.date      = primary.endDate
      spot.weekendDates = [primary.endDate]
    }
  }

  return spot
}
