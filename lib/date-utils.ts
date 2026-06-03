export const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

/** ISO文字列をローカル時刻でパース（UTC解釈を避ける） */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 日付範囲を "M/D（曜）〜M/D（曜）" 形式にフォーマット
 * 同日の場合は単一表示
 */
export function fmtDateRange(start?: string, end?: string): string | null {
  if (!start && !end) return null
  const fmt = (iso: string) => {
    const d = parseLocalDate(iso)
    return `${d.getMonth() + 1}/${d.getDate()}（${DOW_JA[d.getDay()]}）`
  }
  if (start && end && start !== end) return `${fmt(start)}〜${fmt(end)}`
  return fmt(start ?? end!)
}

export type EventStatus = 'active' | 'ended' | 'upcoming' | 'scheduled'

export interface StatusConfig {
  label: string
  bg: string
  color: string
}

export const STATUS_CONFIG: Record<EventStatus, StatusConfig> = {
  'active':    { label: '開催中',       bg: '#dcfce7', color: '#16a34a' },
  'ended':     { label: '終了済み',     bg: '#f3f4f6', color: '#9ca3af' },
  'upcoming':  { label: 'まもなく開催', bg: '#eff6ff', color: '#3b82f6' },
  'scheduled': { label: '開催予定',     bg: '#faf5ff', color: '#9333ea' },
}

/** 開催ステータスを判定 */
export function getEventStatus(
  startDate?: string,
  endDate?: string,
): EventStatus | null {
  if (!startDate && !endDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (endDate) {
    const endDay = parseLocalDate(endDate)
    endDay.setHours(23, 59, 59, 999)
    if (endDay < today) return 'ended'
  }

  if (startDate) {
    const start = parseLocalDate(startDate)
    if (today < start) {
      const diffDays = Math.ceil((start.getTime() - today.getTime()) / 86400000)
      return diffDays <= 7 ? 'upcoming' : 'scheduled'
    }
  }

  return 'active'
}
