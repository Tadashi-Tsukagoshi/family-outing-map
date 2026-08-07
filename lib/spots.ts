export type Category = 'event' | 'fireworks' | 'festival' | 'park' // | 'kumamoto_earthquake_r8'（ユーザー向け画面から非表示。データ・型・関連定数は保持。再表示はこのユニオンと CATEGORY_LABELS に戻すだけ）
/** UI非表示化前のフルカテゴリ型。ota-admin側やデータ層で災害支援カテゴリを扱う箇所で使用 */
export type AllCategory = Category | 'kumamoto_earthquake_r8'

/** 'event'=期間限定イベント, 'permanent'=常設施設, 'disaster'=災害支援 */
export type EventType = 'event' | 'permanent' | 'disaster'

/** 種別='event'/'permanent'（通常イベント）で選択可能なカテゴリ */
export const EVENT_CATEGORIES: Category[] = ['event', 'fireworks', 'festival', 'park']
/** 種別='disaster'（災害支援）で選択可能なカテゴリ */
export const DISASTER_CATEGORIES: AllCategory[] = ['kumamoto_earthquake_r8']

export type Spot = {
  id: string
  name: string
  category: Category
  type: EventType
  lat: number
  lng: number
  description: string
  weekendDates: string[] // ISO date strings (e.g. "2026-05-16")
  url?: string
  imageUrl?: string
  source?: 'manual' | 'collected'
  date?: string      // 後方互換用（endDate の別名）
  venue?: string     // 会場名
  address?: string   // 住所
  fee?: string       // 料金
  startDate?: string // イベント開始日（ISO）
  endDate?: string   // イベント終了日（ISO）
  startTime?: string // イベント開始時刻（HH:MM）
  endTime?: string   // イベント終了時刻（HH:MM）
  businessHours?: string // 常設施設の営業時間
  spotLabel?: string // 常設スポットの紹介文（未入力時は「常設スポット」と表示）
  postedBy?: string
  posterType?: 'general' | 'organizer' | 'business' | 'staff'
  scheduleNote?: string
  likes?: number
  editedBy?: string
  editedAt?: string
}

const VALID_CATEGORIES = new Set<string>(['event', 'fireworks', 'festival', 'park', 'kumamoto_earthquake_r8'])

export function normalizeCategory(value: unknown): Category {
  if (typeof value === 'string' && VALID_CATEGORIES.has(value)) return value as Category
  return 'event'
}

const VALID_EVENT_TYPES = new Set<string>(['event', 'permanent', 'disaster'])

export function normalizeEventType(value: unknown): EventType {
  if (typeof value === 'string' && VALID_EVENT_TYPES.has(value)) return value as EventType
  return 'event'
}

export const CATEGORY_LABELS: Record<Category, string> = {
  event:     'イベント',
  fireworks: '花火',
  festival:  'まつり',
  park:      '常設施設',
  // kumamoto_earthquake_r8: 'R8熊本地震支援',（ユーザー向け画面から非表示）
}

/** カテゴリ選択ボタン表示用のラベル上書き（CATEGORY_LABELS は他箇所の表示に使うため変更しない） */
export const CATEGORY_BUTTON_LABEL_OVERRIDES: Partial<Record<Category, string>> = {
  park: '施設・公園',
}

export const CATEGORY_EMOJIS: Record<AllCategory, string> = {
  event:                  '⛺',
  fireworks:              '🎆',
  festival:               '🏮',
  park:                   '🌳',
  kumamoto_earthquake_r8: '🆘',
}

export const CATEGORY_COLORS: Record<AllCategory, string> = {
  event:                  '#3b7de2',
  fireworks:              '#e8902a',
  festival:               '#e23b3b',
  park:                   '#16a34a',
  kumamoto_earthquake_r8: '#DC2626',
}

/** カテゴリ別フォールバック画像（OGP/ギャラリー画像がない場合に表示） */
export const CATEGORY_IMAGES: Record<AllCategory, string> = {
  event:                  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  fireworks:              'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  festival:               'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  park:                   'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  kumamoto_earthquake_r8: '/images/categories/disaster.png',
}

/** 種別選択ラベル */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  event:     '期間限定イベント',
  permanent: '常設スポット',
  disaster:  '災害支援',
}

export const BADGE_BG_COLOR = '#dbeafe'

export type PeriodFilter = 'all' | '2w' | '1m' | '3m' | 'ended_2026'

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: 'すべて',
  '2w': '2週間',
  '1m': '1ヶ月',
  '3m': '3ヶ月',
  ended_2026: '終了イベント(2026)',
}

export const ICON_PATHS: Record<AllCategory, string> = {
  event:                  'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  fireworks:              'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  festival:               'M12 3L2 9h20zM2 9h20v2H2zM4 11h2v9H4zM11 11h2v9h-2zM18 11h2v9h-2zM2 20h20v2H2z',
  park:                   'M12 2C8 2 5 5.5 5 9c0 2.5 1.5 4.5 3.3 5.7L6 22h3l1-3h4l1 3h3l-2.3-7.3C17.5 13.5 19 11.5 19 9c0-3.5-3-7-7-7z',
  kumamoto_earthquake_r8: '',
}

/** アイコン画像パス。未提供のカテゴリは null を返す */
export function getCategoryIconSrc(category: AllCategory): string | null {
  if (category === 'fireworks') return '/icons/fireworks.png'
  if (category === 'event') return '/icons/event_001.png'
  if (category === 'kumamoto_earthquake_r8') return '/images/pins/kumamon.png'
  if (category === 'park') return '/icons/permanent-spot.png'
  return '/icons/lantern.png'
}

export function isDarkPin(category: AllCategory): boolean {
  return category === 'fireworks' || category === 'festival' || category === 'kumamoto_earthquake_r8'
}
