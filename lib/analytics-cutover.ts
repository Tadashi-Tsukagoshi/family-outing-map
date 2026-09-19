/**
 * PV計測のカットオーバー日（JST）。
 * この日より前は Vercel Web Analytics のバックフィルデータ（event_pv_daily）、
 * この日以降は自前計測（event_views）を参照する。
 */
export const ANALYTICS_CUTOVER_DATE = '2026-09-19'
