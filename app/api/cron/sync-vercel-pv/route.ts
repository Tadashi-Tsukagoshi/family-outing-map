import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { addDaysToDateString, syncVercelPvForDate, todayJst } from '@/lib/vercel-pv-sync'

/**
 * Vercel Cron（毎日 JST 00:05 = UTC 15:05）から呼ばれ、JSTの「昨日」1日分の
 * Vercel Web Analytics データを event_pv_daily に同期する。vercel.json 参照。
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

  const targetDate = addDaysToDateString(todayJst(), -1)

  const supabase = supabaseAdmin()
  const { data: eventRows, error: eventsError } = await supabase.from('events').select('id')
  if (eventsError || !eventRows) {
    console.error('[GET /api/cron/sync-vercel-pv] events fetch failed', eventsError)
    return NextResponse.json({ error: 'failed to load events' }, { status: 500 })
  }
  const knownEventIds = new Set(eventRows.map(e => e.id as string))

  const result = await syncVercelPvForDate(supabase, targetDate, knownEventIds, vercelApiToken, vercelProjectId)
  if (!result.ok) {
    console.error(`[cron/sync-vercel-pv] ${targetDate} failed`, result.error)
    return NextResponse.json({ error: result.error, target_date: targetDate }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    target_date: targetDate,
    rows_upserted: result.rowsUpserted,
    orphans_skipped: result.orphans.length,
  })
}
