import type { Spot } from './spots'
import { getEventStatus, parseLocalDate } from './date-utils'
import { distanceKm } from './geo'

const ENDED_RANK = Number.MAX_SAFE_INTEGER
const NO_DATE_RANK = Number.MAX_SAFE_INTEGER - 1

/**
 * event_plus では親のみでなく全 upcoming pins との最短距離を返す。
 * それ以外のカテゴリは親の座標のみで判定。
 */
function nearestDistance(userLocation: [number, number], spot: Spot): number {
  let min = distanceKm(userLocation, [spot.lat, spot.lng])
  if (spot.category === 'event_plus' && spot.eventPlusPins) {
    for (const pin of spot.eventPlusPins) {
      if (pin.lat != null && pin.lng != null) {
        const d = distanceKm(userLocation, [pin.lat, pin.lng])
        if (d < min) min = d
      }
    }
  }
  return min
}

/**
 * ソート後の配列で、同じ親スポット由来の仮想カード（eventId が同じ）を、
 * それらのうち最も先頭のカードの位置にまとめて隣接させる。
 * event_plus の分割カードがリールで日付ソートによりバラバラに離れないようにするための後処理。
 * 非分割スポット（eventId 未設定）は id が一意なので独立に扱われ、順序に影響しない。
 */
function keepSiblingsTogether(sortedSpots: Spot[]): Spot[] {
  const siblingsByKey = new Map<string, Spot[]>()
  for (const spot of sortedSpots) {
    const key = spot.eventId ?? spot.id
    const list = siblingsByKey.get(key)
    if (list) list.push(spot)
    else siblingsByKey.set(key, [spot])
  }
  const result: Spot[] = []
  const placedKeys = new Set<string>()
  for (const spot of sortedSpots) {
    const key = spot.eventId ?? spot.id
    if (placedKeys.has(key)) continue
    placedKeys.add(key)
    result.push(...siblingsByKey.get(key)!)
  }
  return result
}

/**
 * 発見モードの表示順を算出する。
 * - userLocation あり：現在地からの直線距離が近い順（event_plus は全会場中の最短）
 * - userLocation なし：開催開始日が今日以降で近い順、終了イベントは末尾
 */
export function buildDiscoverOrder(spots: Spot[], userLocation: [number, number] | null): Spot[] {
  if (userLocation) {
    const sorted = [...spots].sort(
      (a, b) => nearestDistance(userLocation, a) - nearestDistance(userLocation, b),
    )
    return keepSiblingsTogether(sorted)
  }

  const todayStartMs = new Date().setHours(0, 0, 0, 0)
  const rank = (spot: Spot): number => {
    const status = getEventStatus(spot.startDate, spot.endDate, spot.endTime)
    if (status === 'ended') return ENDED_RANK
    if (!spot.startDate) return NO_DATE_RANK
    return Math.max(parseLocalDate(spot.startDate).getTime(), todayStartMs)
  }
  const sorted = [...spots].sort((a, b) => rank(a) - rank(b))
  return keepSiblingsTogether(sorted)
}
