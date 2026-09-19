import type { SupabaseClient } from '@supabase/supabase-js'

const EVENT_PATH_PREFIX = '/events/'

type VercelAnalyticsRow = {
  requestPath: string
  visitors: number
  pageviews: number
}

type VercelAnalyticsResponse = {
  data: VercelAnalyticsRow[]
}

/** JST（UTC+9）での「今日」を YYYY-MM-DD で返す */
export function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** YYYY-MM-DD の日付文字列に days を加算した YYYY-MM-DD を返す（カレンダー日付の加減算） */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** JST の YYYY-MM-DD 1日分を、Vercel API に渡す UTC ISO since/until に変換する */
function jstDateToUtcRange(dateStr: string): { sinceIso: string; untilIso: string } {
  const sinceUtc = new Date(`${dateStr}T00:00:00.000+09:00`)
  const untilUtc = new Date(sinceUtc.getTime() + 24 * 60 * 60 * 1000)
  return { sinceIso: sinceUtc.toISOString(), untilIso: untilUtc.toISOString() }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type SyncDateResult =
  | { ok: true; rowsUpserted: number; orphans: string[] }
  | { ok: false; error: string }

/** 指定した JST 日付1日分の Vercel Web Analytics データを event_pv_daily に UPSERT する */
export async function syncVercelPvForDate(
  supabase: SupabaseClient,
  date: string,
  knownEventIds: Set<string>,
  vercelApiToken: string,
  vercelProjectId: string,
): Promise<SyncDateResult> {
  const { sinceIso, untilIso } = jstDateToUtcRange(date)
  const url = new URL('https://api.vercel.com/v1/query/web-analytics/visits/aggregate')
  url.searchParams.set('projectId', vercelProjectId)
  url.searchParams.set('by', 'requestPath')
  url.searchParams.set('since', sinceIso)
  url.searchParams.set('until', untilIso)
  url.searchParams.set('limit', '100')

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${vercelApiToken}` },
    })
  } catch (err) {
    return { ok: false, error: `request error: ${err instanceof Error ? err.message : String(err)}` }
  }

  if (!res.ok) {
    const body = await res.text()
    return { ok: false, error: `Vercel API ${res.status}: ${body}` }
  }

  const json = await res.json() as VercelAnalyticsResponse
  const now = new Date().toISOString()
  const orphans: string[] = []
  const upsertRows: { event_id: string; date: string; pageviews: number; visitors: number; synced_at: string }[] = []

  for (const row of json.data) {
    if (!row.requestPath.startsWith(`${EVENT_PATH_PREFIX}event-`)) continue
    const eventId = row.requestPath.slice(EVENT_PATH_PREFIX.length)
    if (!knownEventIds.has(eventId)) {
      orphans.push(eventId)
      console.warn(`[vercel-pv-sync] orphan event_id not found in events table: ${eventId}`)
      continue
    }
    upsertRows.push({
      event_id: eventId,
      date,
      pageviews: row.pageviews,
      visitors: row.visitors,
      synced_at: now,
    })
  }

  if (upsertRows.length === 0) {
    return { ok: true, rowsUpserted: 0, orphans }
  }

  const { error: upsertError } = await supabase
    .from('event_pv_daily')
    .upsert(upsertRows, { onConflict: 'event_id,date' })
  if (upsertError) {
    return { ok: false, error: `upsert failed: ${upsertError.message}` }
  }

  return { ok: true, rowsUpserted: upsertRows.length, orphans }
}
