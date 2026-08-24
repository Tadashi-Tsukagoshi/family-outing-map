import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('event_id')
  if (!eventId) {
    return Response.json({ error: 'event_id は必須です' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('event_dates')
    .select('id, start_date, end_date, start_time, end_time, venue, address, lat, lng, note')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: true })

  if (error) {
    console.error('[GET /api/event-dates]', error)
    return Response.json({ dates: [] })
  }

  const dates = data.map(row => ({
    id:        String(row.id),
    startDate: row.start_date,
    endDate:   row.end_date,
    startTime: row.start_time ?? '',
    endTime:   row.end_time ?? '',
    venue:     row.venue ?? '',
    address:   row.address ?? '',
    lat:       row.lat ?? null,
    lng:       row.lng ?? null,
    note:      row.note ?? '',
  }))
  return Response.json({ dates })
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const eventId = (b.event_id as string | undefined)?.trim()
  if (!eventId) {
    return Response.json({ error: 'event_id は必須です' }, { status: 400 })
  }

  const rawDates = Array.isArray(b.dates) ? b.dates as unknown[] : []
  const dates = rawDates
    .map(d => d as Record<string, unknown>)
    .map(d => {
      const venue   = (d.venue   as string | undefined)?.trim() || null
      const address = (d.address as string | undefined)?.trim() || null
      // 会場・住所が未入力（useCustomVenue=OFF）の場合は緯度経度も持たせない
      const hasCustomVenue = !!(venue || address)
      return {
        start_date: (d.startDate as string | undefined)?.trim() ?? '',
        end_date:   (d.endDate   as string | undefined)?.trim() ?? '',
        start_time: (d.startTime as string | undefined)?.trim() || null,
        end_time:   (d.endTime   as string | undefined)?.trim() || null,
        venue,
        address,
        lat: hasCustomVenue && typeof d.lat === 'number' ? d.lat : null,
        lng: hasCustomVenue && typeof d.lng === 'number' ? d.lng : null,
        note: (d.note as string | undefined)?.trim() || null,
      }
    })
    .filter(d => d.start_date && d.end_date)

  const supabase = supabaseAdmin()

  const { error: delError } = await supabase.from('event_dates').delete().eq('event_id', eventId)
  if (delError) {
    console.error('[POST /api/event-dates] delete failed', delError)
    return Response.json({ error: '日程の保存に失敗しました' }, { status: 500 })
  }

  if (dates.length > 0) {
    const rows = dates.map((d, i) => ({
      event_id:   eventId,
      start_date: d.start_date,
      end_date:   d.end_date,
      start_time: d.start_time,
      end_time:   d.end_time,
      venue:      d.venue,
      address:    d.address,
      lat:        d.lat,
      lng:        d.lng,
      note:       d.note,
      sort_order: i,
    }))
    const { error: insError } = await supabase.from('event_dates').insert(rows)
    if (insError) {
      console.error('[POST /api/event-dates] insert failed', insError)
      return Response.json({ error: '日程の保存に失敗しました' }, { status: 500 })
    }
  }

  return Response.json({ success: true })
}
