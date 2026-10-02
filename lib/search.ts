import type { Spot } from './spots'

/**
 * 検索用の文字列正規化。NFKC 正規化 → 小文字化 → カタカナをひらがなに統一する。
 * 全角と半角、大文字と小文字、ひらがなとカタカナを区別せずに比較できるようにする。
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

/**
 * スポットをキーワードで絞り込む（空白区切りの各語の AND 検索）。
 * 対象は name / venue / address / description と、event_plus の日程別の会場・住所。
 * 並び順：name に全語ヒット → name+会場+住所 で全語ヒット → 説明文まで含めて全語ヒット。
 * 同じ優先度の中では開始日の早い順（startDate が無いものは末尾）。
 */
export function searchSpots(spots: Spot[], query: string): Spot[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const hits: { spot: Spot; priority: number }[] = []
  for (const spot of spots) {
    const name = normalizeSearchText(spot.name ?? '')
    const placeParts = [spot.venue, spot.address]
    for (const d of spot.eventDates ?? []) placeParts.push(d.venue, d.address)
    const place = normalizeSearchText(placeParts.filter(Boolean).join('\n'))
    const description = normalizeSearchText(spot.description ?? '')

    const nameAndPlace = `${name}\n${place}`
    let priority: number
    if (terms.every((t) => name.includes(t))) priority = 0
    else if (terms.every((t) => nameAndPlace.includes(t))) priority = 1
    else if (terms.every((t) => `${nameAndPlace}\n${description}`.includes(t))) priority = 2
    else continue
    hits.push({ spot, priority })
  }

  hits.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    const as = a.spot.startDate
    const bs = b.spot.startDate
    if (as && bs) return as.localeCompare(bs)
    if (as) return -1
    if (bs) return 1
    return 0
  })
  return hits.map((h) => h.spot)
}
