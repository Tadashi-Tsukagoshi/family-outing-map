export type Category = 'park' | 'museum' | 'playground' | 'food' | 'event'

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
  startDate?: string // イベント開始日（ISO）
  endDate?: string   // イベント終了日（ISO）
}

export const SPOTS: Spot[] = [
  {
    id: '1',
    name: '太田市美術館・図書館',
    category: 'museum',
    lat: 36.2920,
    lng: 139.3670,
    description: 'アートと本が融合した複合文化施設。週末は子ども向けワークショップも開催。',
    weekendDates: ['2026-05-16', '2026-05-17'],
  },
  {
    id: '2',
    name: '金山総合公園',
    category: 'park',
    lat: 36.3066,
    lng: 139.3578,
    description: '標高239mの金山山頂にある自然公園。桜の名所でハイキングも楽しめる。',
    weekendDates: ['2026-05-16', '2026-05-17'],
  },
  {
    id: '3',
    name: '太田市子ども科学館',
    category: 'playground',
    lat: 36.2845,
    lng: 139.3720,
    description: '科学実験や体験展示が充実。プラネタリウムも人気で雨の日にもおすすめ。',
    weekendDates: ['2026-05-17'],
  },
  {
    id: '4',
    name: '道の駅おおた',
    category: 'food',
    lat: 36.2802,
    lng: 139.3891,
    description: '地元群馬の新鮮野菜や特産品が揃う道の駅。フードコートで地元グルメも楽しめる。',
    weekendDates: [],
  },
  {
    id: '5',
    name: 'ぐんまフラワーパーク春まつり',
    category: 'event',
    lat: 36.3010,
    lng: 139.4050,
    description: '季節の花々が咲き誇るフラワーパーク。春まつり期間中は夜間ライトアップも実施。',
    weekendDates: ['2026-05-16', '2026-05-17'],
  },
]

export const CATEGORY_LABELS: Record<Category, string> = {
  park: '公園',
  museum: '美術館・博物館',
  playground: '遊び場',
  food: 'グルメ',
  event: 'イベント',
}

export const CATEGORY_EMOJIS: Record<Category, string> = {
  park: '🌳',
  museum: '🏛️',
  playground: '🎠',
  food: '🍜',
  event: '🎉',
}

export const CATEGORY_COLORS: Record<Category, string> = {
  park: '#22c55e',
  museum: '#3b82f6',
  playground: '#f97316',
  food: '#ef4444',
  event: '#a855f7',
}

export const ICON_PATHS: Record<Category, string> = {
  park:       'M12 3L7 12h10zM12 9L4 21h16zM10 21h4v3h-4z',
  museum:     'M12 3L2 9h20zM2 9h20v2H2zM4 11h2v9H4zM11 11h2v9h-2zM18 11h2v9h-2zM2 20h20v2H2z',
  playground: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  food:       'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
  event:      'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
}
