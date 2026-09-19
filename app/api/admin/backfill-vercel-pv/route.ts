import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'
import { ANALYTICS_CUTOVER_DATE } from '@/lib/analytics-cutover'

const EVENT_PATH_PREFIX = '/events/'
const VERCEL_RATE_LIMIT_SLEEP_MS = 100

/** JST（UTC+9）での「今日」を YYYY-MM-DD で返す */
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** YYYY-MM-DD の日付文字列に days を加算した YYYY-MM-DD を返す（カレンダー日付の加減算） */
function addDaysToDateString(dateStr: string, days: number): string {
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/

type VercelAnalyticsRow = {
  requestPath: string
  visitors: number
  pageviews: number
}

type VercelAnalyticsResponse = {
  data: VercelAnalyticsRow[]
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const vercelApiToken = process.env.VERCEL_API_TOKEN
  const vercelProjectId = process.env.VERCEL_PROJECT_ID
  if (!vercelApiToken || !vercelProjectId) {
    const missing = [
      !vercelApiToken ? 'VERCEL_API_TOKEN' : null,
      !vercelProjectId ? 'VERCEL_PROJECT_ID' : null,
    ].filter(Boolean).join(', ')
    return NextResponse.json({ error: `missing environment variable(s): ${missing}` }, { status: 500 })
  }

  let body: { since?: unknown; until?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const todayStr = todayJst()
  const since = typeof body.since === 'string' && DATE_STRING_RE.test(body.since)
    ? body.since
    : addDaysToDateString(todayStr, -30)
  let until = typeof body.until === 'string' && DATE_STRING_RE.test(body.until)
    ? body.until
    : addDaysToDateString(todayStr, -1)

  // カットオーバー日以降は自前計測（event_views）とかぶるため対象外
  const cutoverMinusOne = addDaysToDateString(ANALYTICS_CUTOVER_DATE, -1)
  if (until >= ANALYTICS_CUTOVER_DATE) until = cutoverMinusOne

  if (since > until) {
    return NextResponse.json({ ok: true, days_processed: 0, rows_upserted: 0, orphans: [] })
  }

  const supabase = supabaseAdmin()

  const { data: eventRows, error: eventsError } = await supabase.from('events').select('id')
  if (eventsError || !eventRows) {
    console.error('[POST /api/admin/backfill-vercel-pv] events fetch failed', eventsError)
    return NextResponse.json({ error: 'failed to load events' }, { status: 500 })
  }
  const knownEventIds = new Set(eventRows.map(e => e.id as string))

  let daysProcessed = 0
  let rowsUpserted = 0
  const orphans = new Set<string>()
  const failedDays: string[] = []

  let cursor = since
  while (cursor <= until) {
    const { sinceIso, untilIso } = jstDateToUtcRange(cursor)
    const url = new URL('https://api.vercel.com/v1/query/web-analytics/visits/aggregate')
    url.searchParams.set('projectId', vercelProjectId)
    url.searchParams.set('by', 'requestPath')
    url.searchParams.set('since', sinceIso)
    url.searchParams.set('until', untilIso)
    url.searchParams.set('limit', '100')

    try {
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${vercelApiToken}` },
      })

      if (!res.ok) {
        const errBody = await res.text()
        console.error(`[backfill-vercel-pv] ${cursor} Vercel API failed`, res.status, errBody)
        failedDays.push(cursor)
      } else {
        const json = await res.json() as VercelAnalyticsResponse
        const now = new Date().toISOString()
        const upsertRows: { event_id: string; date: string; pageviews: number; visitors: number; synced_at: string }[] = []

        for (const row of json.data) {
          if (!row.requestPath.startsWith(`${EVENT_PATH_PREFIX}event-`)) continue
          const eventId = row.requestPath.slice(EVENT_PATH_PREFIX.length)
          if (!knownEventIds.has(eventId)) {
            orphans.add(eventId)
            console.warn(`[backfill-vercel-pv] orphan event_id not found in events table: ${eventId}`)
            continue
          }
          upsertRows.push({
            event_id: eventId,
            date: cursor,
            pageviews: row.pageviews,
            visitors: row.visitors,
            synced_at: now,
          })
        }

        if (upsertRows.length > 0) {
          const { error: upsertError } = await supabase
            .from('event_pv_daily')
            .upsert(upsertRows, { onConflict: 'event_id,date' })
          if (upsertError) {
            console.error(`[backfill-vercel-pv] ${cursor} upsert failed`, upsertError)
            failedDays.push(cursor)
          } else {
            rowsUpserted += upsertRows.length
            daysProcessed += 1
          }
        } else {
          daysProcessed += 1
        }
      }
    } catch (err) {
      console.error(`[backfill-vercel-pv] ${cursor} request error`, err)
      failedDays.push(cursor)
    }

    cursor = addDaysToDateString(cursor, 1)
    if (cursor <= until) await sleep(VERCEL_RATE_LIMIT_SLEEP_MS)
  }

  return NextResponse.json({
    ok: true,
    days_processed: daysProcessed,
    rows_upserted: rowsUpserted,
    orphans: [...orphans],
    failed_days: failedDays,
  })
}
