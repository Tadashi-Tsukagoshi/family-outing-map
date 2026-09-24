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
 * 発見モードの表示順を算出する。
 * - userLocation あり：現在地からの直線距離が近い順（event_plus は全会場中の最短）
 * - userLocation なし：開催開始日が今日以降で近い順、終了イベントは末尾
 */
export function buildDiscoverOrder(spots: Spot[], userLocation: [number, number] | null): Spot[] {
  if (userLocation) {
    return [...spots].sort(
      (a, b) => nearestDistance(userLocation, a) - nearestDistance(userLocation, b),
    )
  }

  const todayStartMs = new Date().setHours(0, 0, 0, 0)
  const rank = (spot: Spot): number => {
    const status = getEventStatus(spot.startDate, spot.endDate, spot.endTime)
    if (status === 'ended') return ENDED_RANK
    if (!spot.startDate) return NO_DATE_RANK
    return Math.max(parseLocalDate(spot.startDate).getTime(), todayStartMs)
  }
  return [...spots].sort((a, b) => rank(a) - rank(b))
}
