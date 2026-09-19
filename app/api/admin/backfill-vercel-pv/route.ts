import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'
import { ANALYTICS_CUTOVER_DATE } from '@/lib/analytics-cutover'
import { addDaysToDateString, sleep, syncVercelPvForDate, todayJst } from '@/lib/vercel-pv-sync'

const VERCEL_RATE_LIMIT_SLEEP_MS = 100
const DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}$/

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
    const result = await syncVercelPvForDate(supabase, cursor, knownEventIds, vercelApiToken, vercelProjectId)
    if (result.ok) {
      daysProcessed += 1
      rowsUpserted += result.rowsUpserted
      for (const orphan of result.orphans) orphans.add(orphan)
    } else {
      console.error(`[backfill-vercel-pv] ${cursor} failed`, result.error)
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
