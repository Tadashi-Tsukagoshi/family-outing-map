import type { Spot } from '@/lib/spots'

/** トップページの既定の見出し（app/layout.tsx の metadata.title と同じ） */
export const DEFAULT_PAGE_TITLE = 'グンマップ｜GUNMAp'

function extractCity(address?: string, prefecture?: string): string | null {
  if (!address) return null
  const cleaned = address.replace(/〒?\d{3}-?\d{4}\s*/, '')
  const withoutPref = prefecture
    ? cleaned.replace(prefecture, '')
    : cleaned.replace(/^.+?[都道府県]/, '')
  const match = withoutPref.match(/^(.+?市)/)
    || withoutPref.match(/^(.+?区)/)
    || withoutPref.match(/^(.+?(?:町|村))/)
  return match ? match[1] : null
}

/** イベントの地域名（例：群馬県桐生市。市区町村が取れなければ都道府県のみ） */
export function getEventArea(spot: Spot): string {
  const city = extractCity(spot.address, spot.prefecture)
  return city
    ? `${spot.prefecture ?? '群馬県'}${city}`
    : (spot.prefecture ?? '群馬県')
}

/** イベントのページ見出し（OGP のタイトルと、詳細パネル表示中のブラウザのタブの見出しで共通） */
export function buildEventTitle(spot: Spot): string {
  return `${spot.name}｜${getEventArea(spot)}のイベント｜グンマップ`
}
