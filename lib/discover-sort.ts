import type { Spot } from './spots'
import { getEventStatus, parseLocalDate } from './date-utils'
import { distanceKm } from './geo'

// Infinity同士の減算はNaNになりうるため、終了イベント／日付不明を末尾に送る際は
// 有限の大きな値を使い分けて安全に比較できるようにする
const ENDED_RANK = Number.MAX_SAFE_INTEGER
const NO_DATE_RANK = Number.MAX_SAFE_INTEGER - 1

/**
 * 発見モードの表示順を算出する。
 * - userLocation あり：現在地からの直線距離が近い順
 * - userLocation なし：開催開始日が今日以降で近い順（開催中は「今日」扱いで先頭寄りにする）、終了イベントは末尾
 */
export function buildDiscoverOrder(spots: Spot[], userLocation: [number, number] | null): Spot[] {
  if (userLocation) {
    return [...spots].sort(
      (a, b) => distanceKm(userLocation, [a.lat, a.lng]) - distanceKm(userLocation, [b.lat, b.lng]),
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
