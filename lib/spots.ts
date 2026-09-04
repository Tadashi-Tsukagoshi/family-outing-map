export type Category = 'event' | 'event_plus' | 'fireworks' | 'festival' // | 'park' | 'kumamoto_earthquake_r8'（ユーザー向け画面から非表示。データ・型・関連定数は保持。再表示はこのユニオンと CATEGORY_LABELS に戻すだけ）
/** UI非表示化前のフルカテゴリ型。ota-admin側やデータ層で災害支援カテゴリを扱う箇所で使用 */
export type AllCategory = Category | 'park' | 'kumamoto_earthquake_r8'

/** 'event'=期間限定イベント, 'permanent'=常設施設, 'disaster'=災害支援 */
export type EventType = 'event' | 'permanent' | 'disaster'

/** 種別='event'（期間限定イベント）で選択可能なカテゴリ */
export const EVENT_CATEGORIES: Category[] = ['event', 'event_plus', 'fireworks', 'festival']
/** 種別='permanent'（常設施設）で選択可能なカテゴリ。ユーザー向け画面からは非表示だが管理画面での登録・編集には使用 */
export const PARK_CATEGORIES: AllCategory[] = ['park']
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
  prefecture?: string
  weekendDates: string[] // ISO date strings (e.g. "2026-05-16")
  url?: string
  instagramUrl?: string
  xUrl?: string
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
  /** カンマ区切りの個別指定日（例："2026-09-12,2026-09-16"）。未設定時は startDate〜endDate の期間指定 */
  specificDates?: string | null
  notice?: string
  likes?: number
  editedBy?: string
  editedAt?: string
  /** category='event_plus' の複数日程（event_dates テーブル由来） */
  eventDates?: EventDateEntry[]
  /** eventDates をグルーピング・絞り込みした結果（地図の複数ピン表示用）。先頭が全体で最も近い開催日 */
  eventPlusPins?: EventPlusOccurrence[]
  /** 地図上で複数ピンに分裂した場合の実イベントid。id 自体はピンごとの合成id になるため、
   *  画像・いいねなど実イベントに紐づくAPI呼び出しは eventId ?? id を使う */
  eventId?: string
  /** category='event_plus' のときの見た目カテゴリ（event/festival/fireworks）。未設定時は'event'扱い */
  subCategory?: string
  /** 地図ピンを手動でグルーピングするためのID。同じ groupId のイベント同士がグループ表示される */
  groupId?: string
}

const VALID_CATEGORIES = new Set<string>(['event', 'event_plus', 'fireworks', 'festival', 'park', 'kumamoto_earthquake_r8'])

export function normalizeCategory(value: unknown): Category {
  if (typeof value === 'string' && VALID_CATEGORIES.has(value)) return value as Category
  return 'event'
}

/** 地図アイコン・フィルタ用の見た目カテゴリ。event_plus は subCategory があればそれを使う */
export function getVisualCategory(spot: Spot): AllCategory {
  if (spot.category === 'event_plus' && spot.subCategory) {
    return normalizeCategory(spot.subCategory)
  }
  return spot.category
}

const VALID_EVENT_TYPES = new Set<string>(['event', 'permanent', 'disaster'])

export function normalizeEventType(value: unknown): EventType {
  if (typeof value === 'string' && VALID_EVENT_TYPES.has(value)) return value as EventType
  return 'event'
}

export const CATEGORY_LABELS: Record<Category, string> = {
  event:      'イベント',
  event_plus: 'イベント＋',
  fireworks:  '花火',
  festival:   'まつり',
  // park:       '常設施設',（ユーザー向け画面から非表示）
  // kumamoto_earthquake_r8: 'R8熊本地震支援',（ユーザー向け画面から非表示）
}

/** カテゴリ選択ボタン表示用のラベル上書き（CATEGORY_LABELS は他箇所の表示に使うため変更しない） */
export const CATEGORY_BUTTON_LABEL_OVERRIDES: Partial<Record<Category, string>> = {
  // park: '施設・公園',（ユーザー向け画面から非表示）
}

export const CATEGORY_EMOJIS: Record<AllCategory, string> = {
  event:                  '⛺',
  event_plus:             '⛺',
  fireworks:              '🎆',
  festival:               '🏮',
  park:                   '🌳',
  kumamoto_earthquake_r8: '🆘',
}

export const CATEGORY_COLORS: Record<AllCategory, string> = {
  event:                  '#3b7de2',
  event_plus:             '#3b7de2',
  fireworks:              '#e8902a',
  festival:               '#e23b3b',
  park:                   '#16a34a',
  kumamoto_earthquake_r8: '#DC2626',
}

/** カテゴリ別フォールバック画像（OGP/ギャラリー画像がない場合に表示） */
export const CATEGORY_IMAGES: Record<AllCategory, string> = {
  event:                  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
  event_plus:             'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
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

/** 注意書きの初期値・フォールバック表示（spot.notice が未設定の場合に使用） */
export const DEFAULT_NOTICE = '※当日の開催状況は公式情報をご確認ください。'

export type PeriodFilter = '1w' | '2w' | '1m' | '3m' | `ended_${number}`

export type PeriodOption = { value: PeriodFilter; label: string }

export function buildPeriodOptions(endedYears: number[]): PeriodOption[] {
  const base: PeriodOption[] = [
    { value: '1w', label: '1週間' },
    { value: '2w', label: '2週間' },
    { value: '1m', label: '1ヶ月' },
    { value: '3m', label: '3ヶ月' },
  ]
  const ended = endedYears
    .slice()
    .sort((a, b) => a - b)
    .map((y) => ({ value: `ended_${y}` as PeriodFilter, label: `終了イベント(${y})` }))
  return [...base, ...ended]
}

export const ICON_PATHS: Record<AllCategory, string> = {
  event:                  'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  event_plus:             'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  fireworks:              'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  festival:               'M12 3L2 9h20zM2 9h20v2H2zM4 11h2v9H4zM11 11h2v9h-2zM18 11h2v9h-2zM2 20h20v2H2z',
  park:                   'M12 2C8 2 5 5.5 5 9c0 2.5 1.5 4.5 3.3 5.7L6 22h3l1-3h4l1 3h3l-2.3-7.3C17.5 13.5 19 11.5 19 9c0-3.5-3-7-7-7z',
  kumamoto_earthquake_r8: '',
}

/** アイコン画像パス。未提供のカテゴリは null を返す */
export function getCategoryIconSrc(category: AllCategory): string | null {
  if (category === 'fireworks') return '/icons/fireworks.png'
  if (category === 'event' || category === 'event_plus') return '/icons/event_001.png'
  if (category === 'kumamoto_earthquake_r8') return '/images/pins/kumamon.png'
  if (category === 'park') return '/icons/permanent-spot.png'
  return '/icons/lantern.png'
}

export function isDarkPin(category: AllCategory): boolean {
  return category === 'fireworks' || category === 'festival' || category === 'kumamoto_earthquake_r8'
}

/** event_plus カテゴリの複数日程（event_dates テーブルの1行に対応） */
export type EventDateEntry = {
  id: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  /** true の場合のみ venue/address/lat/lng を使う。false の場合は親イベントの会場・住所・位置を使う */
  useCustomVenue: boolean
  venue: string
  address: string
  lat: number | null
  lng: number | null
  note: string
  /** true の場合のみ notice を使う。false の場合は親イベントの notice（または DEFAULT_NOTICE）を使う */
  useCustomNotice: boolean
  notice: string
}

/** event_plus の1回の開催（グルーピング・絞り込み後の event_dates の1件） */
export type EventPlusOccurrence = {
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  venue: string
  address: string
  lat: number
  lng: number
  notice: string
}

/**
 * event_plus の eventDates を lat/lng でグルーピングし、各グループの直近の次回開催日（1件）を返す。
 * - lat/lng が未入力の日程は親スポット（Spot自身）の lat/lng・venue・address を使う
 * - 先頭要素が全体で最も近い開催日（Spot本体の startDate/endDate/venue/address/lat/lng に使う）
 * - すべての日程が終了している場合は、全体で最後に終了した1件だけを返す
 * - eventDates が無い場合は空配列を返す（呼び出し側で Spot 自身の日程にフォールバックする）
 */
export function resolveEventPlusOccurrences(spot: Spot): EventPlusOccurrence[] {
  const dates = spot.eventDates ?? []
  const effective = dates
    .filter(d => d.startDate && d.endDate)
    .map(d => ({
      startDate: d.startDate,
      endDate:   d.endDate,
      startTime: d.startTime,
      endTime:   d.endTime,
      venue:     d.venue   || spot.venue   || '',
      address:   d.address || spot.address || '',
      lat:       d.lat ?? spot.lat,
      lng:       d.lng ?? spot.lng,
      notice:    d.notice || '',
    }))

  if (effective.length === 0) return []

  const groups = new Map<string, typeof effective>()
  for (const d of effective) {
    const key = `${d.lat.toFixed(6)},${d.lng.toFixed(6)}`
    const group = groups.get(key)
    if (group) group.push(d)
    else groups.set(key, [d])
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const pins: typeof effective = []
  for (const group of groups.values()) {
    const upcoming = group
      .filter(d => d.endDate >= todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    if (upcoming.length > 0) pins.push(...upcoming)
  }

  if (pins.length === 0) {
    // すべての日程が終了 → 全体で最後に終了した1件だけ
    const past = [...effective].sort((a, b) => b.endDate.localeCompare(a.endDate))
    return [past[0]]
  }

  // 先頭が全体で最も近い開催日になるよう並べ替え
  return pins.sort((a, b) => a.startDate.localeCompare(b.startDate))
}
