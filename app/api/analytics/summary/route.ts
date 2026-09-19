import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'
import { CATEGORY_LABELS, EVENT_CATEGORIES, extractMunicipality, normalizeCategory, type Category } from '@/lib/spots'
import { getEventStatus, type EventStatus } from '@/lib/date-utils'

type Period = '30d' | '7d'

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

function periodLabel(period: Period): string {
  return period === '30d' ? '直近30日' : '直近7日'
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
  imageCount: number
  descriptionLength: number
  status: EventStatus | null
  statusLabel: string
  startDate: string | null
  url: string
}

type VercelAnalyticsRow = {
  requestPath: string
  visitors: number
  pageviews: number
}

type VercelAnalyticsResponse = {
  data: VercelAnalyticsRow[]
}

const EVENT_PATH_PREFIX = '/events/'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period: Period = searchParams.get('period') === '7d' ? '7d' : '30d'
  const includeEnded = searchParams.get('include_ended') !== 'false'

  const vercelApiToken = process.env.VERCEL_API_TOKEN
  const vercelProjectId = process.env.VERCEL_PROJECT_ID
  if (!vercelApiToken || !vercelProjectId) {
    const missing = [
      !vercelApiToken ? 'VERCEL_API_TOKEN' : null,
      !vercelProjectId ? 'VERCEL_PROJECT_ID' : null,
    ].filter(Boolean).join(', ')
    return NextResponse.json({ error: `missing environment variable(s): ${missing}` }, { status: 500 })
  }

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

  // 2. Vercel Web Analytics API から期間別PVを取得
  const until = new Date()
  const since = new Date(until.getTime() - (period === '30d' ? 30 : 7) * 24 * 60 * 60 * 1000)

  const vercelUrl = new URL('https://api.vercel.com/v1/query/web-analytics/visits/aggregate')
  vercelUrl.searchParams.set('projectId', vercelProjectId)
  vercelUrl.searchParams.set('by', 'requestPath')
  vercelUrl.searchParams.set('since', since.toISOString())
  vercelUrl.searchParams.set('until', until.toISOString())
  vercelUrl.searchParams.set('limit', '100')

  const vercelRes = await fetch(vercelUrl.toString(), {
    headers: { Authorization: `Bearer ${vercelApiToken}` },
  })

  if (!vercelRes.ok) {
    const body = await vercelRes.text()
    console.error('[GET /api/analytics/summary] Vercel API request failed', vercelRes.status, body)
    return new NextResponse(body, { status: vercelRes.status })
  }

  const vercelData = await vercelRes.json() as VercelAnalyticsResponse
  if (vercelData.data.length > 90) {
    console.warn(`[analytics] Vercel API returned ${vercelData.data.length} rows (near limit=100). Some events may be missing.`)
  }

  const viewCountByEvent = new Map<string, number>()
  for (const row of vercelData.data) {
    if (!row.requestPath.startsWith(EVENT_PATH_PREFIX)) continue
    const eventId = row.requestPath.slice(EVENT_PATH_PREFIX.length)
    viewCountByEvent.set(eventId, row.pageviews)
  }

  // 3. イベントごとの画像枚数
  const eventIds = new Set(eventRows.map(e => e.id))
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

  // 4. イベント単位の集計データを組み立て（PVが取れなかったイベントは PV=0 として全件含める）
  const stats: EventStat[] = (eventRows as EventRow[]).map(e => {
    const category = normalizeCategory(e.category)
    const status = getEventStatus(e.start_date ?? undefined, e.end_date ?? undefined, e.end_time ?? undefined)
    return {
      eventId: e.id,
      name: e.name,
      category,
      categoryLabel: CATEGORY_LABELS[category] ?? category,
      city: extractMunicipality(e.address ?? undefined),
      viewCount: viewCountByEvent.get(e.id) ?? 0,
      imageCount: imageCountByEvent.get(e.id) ?? 0,
      descriptionLength: (e.description ?? '').length,
      status,
      statusLabel: status ? STATUS_LABELS[status] : '日程未定',
      startDate: e.start_date,
      url: `/events/${e.id}`,
    }
  })

  const totalViews = stats.reduce((sum, s) => sum + s.viewCount, 0)

  // 5. イベント別PVランキング（並び順はクライアント側で決める）
  const ranking = stats

  // 6. カテゴリ別集計
  const categoryGroups = new Map<Category, EventStat[]>()
  for (const s of stats) {
    const list = categoryGroups.get(s.category)
    if (list) list.push(s)
    else categoryGroups.set(s.category, [s])
  }
  const byCategory = [...categoryGroups.entries()].map(([category, list]) => {
    const views = list.map(s => s.viewCount)
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

  // 7. 画像枚数バケット別集計
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
      const total = list.reduce((sum, s) => sum + s.viewCount, 0)
      return { bucket, eventCount: list.length, avgViews: total / list.length }
    })

  // 8. 説明文字数バケット別集計
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
      const total = list.reduce((sum, s) => sum + s.viewCount, 0)
      return { bucket, eventCount: list.length, avgViews: total / list.length }
    })

  // 9. イベントタイプ別（event / event_plus）
  const typeGroups = new Map<string, EventStat[]>()
  for (const s of stats) {
    if (s.category !== 'event' && s.category !== 'event_plus') continue
    const list = typeGroups.get(s.category)
    if (list) list.push(s)
    else typeGroups.set(s.category, [s])
  }
  const byType = [...typeGroups.entries()].map(([type, list]) => {
    const total = list.reduce((sum, s) => sum + s.viewCount, 0)
    return { type, eventCount: list.length, avgViews: total / list.length }
  })

  // 10. エリア別集計（登録数上位20市）
  const areaGroups = new Map<string, EventStat[]>()
  for (const s of stats) {
    if (!s.city) continue
    const list = areaGroups.get(s.city)
    if (list) list.push(s)
    else areaGroups.set(s.city, [s])
  }
  const byArea = [...areaGroups.entries()]
    .map(([city, list]) => {
      const total = list.reduce((sum, s) => sum + s.viewCount, 0)
      return { city, eventCount: list.length, avgViews: total / list.length }
    })
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, 20)

  return NextResponse.json({
    overview: {
      totalViews,
      uniqueVisitors: null,
      eventCount: stats.length,
      dateRangeLabel: periodLabel(period),
    },
    ranking,
    byCategory,
    byImageCount,
    byDescriptionLength,
    byType,
    byArea,
  })
}
