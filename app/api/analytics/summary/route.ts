import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'
import { CATEGORY_LABELS, EVENT_CATEGORIES, extractMunicipality, normalizeCategory, type Category } from '@/lib/spots'
import { getEventStatus, type EventStatus } from '@/lib/date-utils'
import { ANALYTICS_CUTOVER_DATE } from '@/lib/analytics-cutover'

type Period = 'all' | '30d' | '7d'

const STATUS_LABELS: Record<EventStatus, string> = {
  active:    '開催中',
  ended:     '終了',
  upcoming:  'まもなく開催',
  scheduled: '開催予定',
}

/** JST（UTC+9）での「今日」を YYYY-MM-DD で返す */
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** JST で今日から daysAgo 日前（当日含む）の日付を YYYY-MM-DD で返す */
function jstDateDaysAgo(daysAgo: number): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  jst.setUTCDate(jst.getUTCDate() - daysAgo)
  return jst.toISOString().slice(0, 10)
}

/** YYYY-MM-DD の日付文字列に days を加算した YYYY-MM-DD を返す（カレンダー日付の加減算） */
function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** since〜until（JST日付、両端含む）を1日刻みで列挙する */
function enumerateDates(since: string, until: string): string[] {
  const dates: string[] = []
  let cursor = since
  while (cursor <= until) {
    dates.push(cursor)
    cursor = addDaysToDateString(cursor, 1)
  }
  return dates
}

function periodLabel(period: Period): string {
  if (period === '30d') return '直近30日'
  if (period === '7d')  return '直近7日'
  return '全期間'
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function imageCountBucket(count: number): string {
  if (count <= 0) return '0枚'
  if (count === 1) return '1枚'
  if (count <= 3) return '2-3枚'
  return '4-5枚'
}

const IMAGE_BUCKET_ORDER = ['0枚', '1枚', '2-3枚', '4-5枚']

function descriptionLengthBucket(length: number): string {
  if (length <= 0) return '無し'
  if (length <= 40) return '1-40字'
  if (length <= 80) return '41-80字'
  return '81字以上'
}

const DESCRIPTION_BUCKET_ORDER = ['無し', '1-40字', '41-80字', '81字以上']

type EventRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  address: string | null
  start_date: string | null
  end_date: string | null
  end_time: string | null
}

type EventStat = {
  eventId: string
  name: string
  category: Category
  categoryLabel: string
  city: string | null
  viewCount: number
  vercelPv: number
  selfPv: number
  imageCount: number
  descriptionLength: number
  status: EventStatus | null
  statusLabel: string
  startDate: string | null
  url: string
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const periodParam = searchParams.get('period')
  const period: Period = (periodParam === '30d' || periodParam === '7d') ? periodParam : 'all'
  const includeEnded = searchParams.get('include_ended') !== 'false'

  const supabase = supabaseAdmin()

  // 1. 承認済みイベントを取得（status='pending'/'rejected' は本番導線に出ないため除外。
  //    常設施設・災害支援カテゴリはイベント取捨選択の対象外のため除外）
  let eventsQuery = supabase
    .from('events')
    .select('id, name, description, category, address, start_date, end_date, end_time')
    .eq('status', 'approved')
    .in('category', EVENT_CATEGORIES)

  if (!includeEnded) {
    eventsQuery = eventsQuery.gte('end_date', todayJst())
  }

  const { data: eventRows, error: eventsError } = await eventsQuery
  if (eventsError || !eventRows) {
    console.error('[GET /api/analytics/summary] events fetch failed', eventsError)
    return NextResponse.json({ error: 'failed to load events' }, { status: 500 })
  }
  const eventIds = new Set(eventRows.map(e => e.id))

  // 2. 期間の since/until（JST日付）を組み立て
  const until = todayJst()
  let since: string
  if (period === '30d') {
    since = jstDateDaysAgo(29)
  } else if (period === '7d') {
    since = jstDateDaysAgo(6)
  } else {
    const { data: earliestRow } = await supabase
      .from('event_pv_daily')
      .select('date')
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle()
    since = (earliestRow?.date as string | undefined) ?? ANALYTICS_CUTOVER_DATE
  }

  const cutoverMinusOne = addDaysToDateString(ANALYTICS_CUTOVER_DATE, -1)

  // 3. Vercel計測（event_pv_daily）と自前計測（event_views）を取得する。
  //    - Vercel PV: 期間内 event_pv_daily の pageviews をそのまま合算（cronで継続同期される想定）
  //    - 自前 PV: カットオーバー日（2026-09-19）でクリーンに分割。
  //      9/18以前は Vercel データしか無いため event_pv_daily を流用し、9/19以降は event_views を使う
  const vercelPvByEvent = new Map<string, number>()
  const selfPvByEvent = new Map<string, number>()
  const vercelPvByDate = new Map<string, number>()
  const selfPvByDate = new Map<string, number>()
  // 日別内訳（PV推移グラフの点クリック用）: date -> eventId -> 自前PV
  const selfPvByDateEvent = new Map<string, Map<string, number>>()

  function addSelfPvByDateEvent(date: string, eventId: string, pv: number) {
    let byEvent = selfPvByDateEvent.get(date)
    if (!byEvent) {
      byEvent = new Map()
      selfPvByDateEvent.set(date, byEvent)
    }
    byEvent.set(eventId, (byEvent.get(eventId) ?? 0) + pv)
  }

  const { data: pvDailyRows, error: pvDailyError } = await supabase
    .from('event_pv_daily')
    .select('event_id, date, pageviews')
    .gte('date', since)
    .lte('date', until)
  if (pvDailyError || !pvDailyRows) {
    console.error('[GET /api/analytics/summary] event_pv_daily fetch failed', pvDailyError)
    return NextResponse.json({ error: 'failed to load event_pv_daily' }, { status: 500 })
  }
  for (const row of pvDailyRows) {
    if (!eventIds.has(row.event_id)) continue
    vercelPvByEvent.set(row.event_id, (vercelPvByEvent.get(row.event_id) ?? 0) + row.pageviews)
    vercelPvByDate.set(row.date, (vercelPvByDate.get(row.date) ?? 0) + row.pageviews)
    if (row.date <= cutoverMinusOne) {
      selfPvByEvent.set(row.event_id, (selfPvByEvent.get(row.event_id) ?? 0) + row.pageviews)
      selfPvByDate.set(row.date, (selfPvByDate.get(row.date) ?? 0) + row.pageviews)
      addSelfPvByDateEvent(row.date, row.event_id, row.pageviews)
    }
  }

  const viewsSince = since > ANALYTICS_CUTOVER_DATE ? since : ANALYTICS_CUTOVER_DATE
  if (viewsSince <= until) {
    const { data: viewRows, error: viewsError } = await supabase
      .from('event_views')
      .select('event_id, viewed_date_jst')
      .gte('viewed_date_jst', viewsSince)
      .lte('viewed_date_jst', until)
    if (viewsError || !viewRows) {
      console.error('[GET /api/analytics/summary] event_views fetch failed', viewsError)
      return NextResponse.json({ error: 'failed to load event_views' }, { status: 500 })
    }
    for (const row of viewRows) {
      if (!eventIds.has(row.event_id)) continue
      selfPvByEvent.set(row.event_id, (selfPvByEvent.get(row.event_id) ?? 0) + 1)
      selfPvByDate.set(row.viewed_date_jst, (selfPvByDate.get(row.viewed_date_jst) ?? 0) + 1)
      addSelfPvByDateEvent(row.viewed_date_jst, row.event_id, 1)
    }
  }

  // 4. イベントごとの画像枚数
  const { data: imageRows, error: imagesError } = await supabase
    .from('event_images')
    .select('event_id')
  if (imagesError || !imageRows) {
    console.error('[GET /api/analytics/summary] event_images fetch failed', imagesError)
    return NextResponse.json({ error: 'failed to load images' }, { status: 500 })
  }
  const imageCountByEvent = new Map<string, number>()
  for (const row of imageRows) {
    if (!eventIds.has(row.event_id)) continue
    imageCountByEvent.set(row.event_id, (imageCountByEvent.get(row.event_id) ?? 0) + 1)
  }

  // 5. イベント単位の集計データを組み立て（PVが取れなかったイベントは PV=0 として全件含める）
  const stats: EventStat[] = (eventRows as EventRow[]).map(e => {
    const category = normalizeCategory(e.category)
    const status = getEventStatus(e.start_date ?? undefined, e.end_date ?? undefined, e.end_time ?? undefined)
    const selfPv = selfPvByEvent.get(e.id) ?? 0
    return {
      eventId: e.id,
      name: e.name,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      city: extractMunicipality(e.address ?? undefined),
      viewCount: selfPv,
      vercelPv: vercelPvByEvent.get(e.id) ?? 0,
      selfPv,
      imageCount: imageCountByEvent.get(e.id) ?? 0,
      descriptionLength: (e.description ?? '').length,
      status,
      statusLabel: status ? STATUS_LABELS[status] : '日程未定',
      startDate: e.start_date,
      url: `/events/${e.id}`,
    }
  })

  const totalViews  = stats.reduce((sum, s) => sum + s.selfPv, 0)
  const vercelViews = stats.reduce((sum, s) => sum + s.vercelPv, 0)

  // 5b. 日別のイベント内訳（PV推移グラフの点クリック時に表示。自前PV≥1のイベントのみ、PV降順）
  const statsById = new Map(stats.map(s => [s.eventId, s]))
  const dailyBreakdown: Record<string, { eventId: string; name: string; category: string; city: string | null; pv: number }[]> = {}
  for (const [date, byEvent] of selfPvByDateEvent) {
    const list = [...byEvent.entries()]
      .filter(([eventId, pv]) => pv >= 1 && statsById.has(eventId))
      .map(([eventId, pv]) => {
        const meta = statsById.get(eventId)!
        return { eventId, name: meta.name, category: meta.category, city: meta.city, pv }
      })
      .sort((a, b) => b.pv - a.pv)
    if (list.length > 0) dailyBreakdown[date] = list
  }

  // 6. イベント別PVランキング（並び順はクライアント側で決める）
  const ranking = stats

  // 7. 日別の時系列データ（Vercel計測 vs 自前計測の推移グラフ用）
  //    TODO: 期間が90日を超える場合は週次集計への切替を検討する
  const timeSeries = enumerateDates(since, until).map(date => ({
    date,
    vercelPv: vercelPvByDate.get(date) ?? 0,
    selfPv: selfPvByDate.get(date) ?? 0,
  }))

  // 8. カテゴリ別集計（自前PVベース）
  const categoryGroups = new Map<Category, EventStat[]>()
  for (const s of stats) {
    const list = categoryGroups.get(s.category)
    if (list) list.push(s)
    else categoryGroups.set(s.category, [s])
  }
  const byCategory = [...categoryGroups.entries()].map(([category, list]) => {
    const views = list.map(s => s.selfPv)
    const total = views.reduce((sum, v) => sum + v, 0)
    return {
      category,
      label: CATEGORY_LABELS[category] ?? category,
      eventCount: list.length,
      totalViews: total,
      avgViews: list.length > 0 ? total / list.length : 0,
      medianViews: median(views),
    }
  }).sort((a, b) => b.eventCount - a.eventCount)

  // 9. 画像枚数バケット別集計（自前PVベース）
  const imageGroups = new Map<string, EventStat[]>()
  for (const s of stats) {
    const bucket = imageCountBucket(s.imageCount)
    const list = imageGroups.get(bucket)
    if (list) list.push(s)
    else imageGroups.set(bucket, [s])
  }
  const byImageCount = IMAGE_BUCKET_ORDER
    .filter(bucket => imageGroups.has(bucket))
    .map(bucket => {
      const list = imageGroups.get(bucket)!
      const total = list.reduce((sum, s) => sum + s.selfPv, 0)
      return { bucket, eventCount: list.length, avgViews: total / list.length }
    })

  // 10. 説明文字数バケット別集計（自前PVベース）
  const descGroups = new Map<string, EventStat[]>()
  for (const s of stats) {
    const bucket = descriptionLengthBucket(s.descriptionLength)
    const list = descGroups.get(bucket)
    if (list) list.push(s)
    else descGroups.set(bucket, [s])
  }
  const byDescriptionLength = DESCRIPTION_BUCKET_ORDER
    .filter(bucket => descGroups.has(bucket))
    .map(bucket => {
      const list = descGroups.get(bucket)!
      const total = list.reduce((sum, s) => sum + s.selfPv, 0)
      return { bucket, eventCount: list.length, avgViews: total / list.length }
    })

  // 11. イベントタイプ別（event / event_plus、自前PVベース）
  const typeGroups = new Map<string, EventStat[]>()
  for (const s of stats) {
    if (s.category !== 'event' && s.category !== 'event_plus') continue
    const list = typeGroups.get(s.category)
    if (list) list.push(s)
    else typeGroups.set(s.category, [s])
  }
  const byType = [...typeGroups.entries()].map(([type, list]) => {
    const total = list.reduce((sum, s) => sum + s.selfPv, 0)
    return { type, eventCount: list.length, avgViews: total / list.length }
  })

  // 12. エリア別集計（登録数上位20市、自前PVベース）
  const areaGroups = new Map<string, EventStat[]>()
  for (const s of stats) {
    if (!s.city) continue
    const list = areaGroups.get(s.city)
    if (list) list.push(s)
    else areaGroups.set(s.city, [s])
  }
  const byArea = [...areaGroups.entries()]
    .map(([city, list]) => {
      const total = list.reduce((sum, s) => sum + s.selfPv, 0)
      return { city, eventCount: list.length, avgViews: total / list.length }
    })
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 20)

  return NextResponse.json({
    overview: {
      totalViews,
      vercelViews,
      selfViews: totalViews,
      uniqueVisitors: null,
      eventCount: stats.length,
      dateRangeLabel: periodLabel(period),
    },
    ranking,
    timeSeries,
    dailyBreakdown,
    byCategory,
    byImageCount,
    byDescriptionLength,
    byType,
    byArea,
  })
}
