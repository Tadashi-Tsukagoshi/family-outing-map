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
    .select('id, start_date, end_date, start_time, end_time, venue, address, lat, lng, note, notice, event_images(image_url, sort_order, caption)')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('start_date', { ascending: true })

  if (error) {
    console.error('[GET /api/event-dates]', error)
    return Response.json({ dates: [] })
  }

  const dates = data.map(row => {
    const images = (row.event_images ?? [])
      .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
    return {
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
      notice:    row.notice ?? '',
      imageUrls:     images.map((img: { image_url: string }) => img.image_url),
      imageCaptions: images.map((img: { caption?: string | null }) => img.caption ?? ''),
    }
  })
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
      const imageUrls = Array.isArray(d.imageUrls) ? (d.imageUrls as string[]) : []
      const imageCaptions = Array.isArray(d.imageCaptions) ? (d.imageCaptions as string[]) : []
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
        notice: (d.notice as string | undefined)?.trim() || null,
        imageUrls,
        imageCaptions,
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
      notice:     d.notice,
      sort_order: i,
    }))
    const { data: insertedDates, error: insError } = await supabase
      .from('event_dates').insert(rows).select('id, sort_order')
    if (insError) {
      console.error('[POST /api/event-dates] insert failed', insError)
      return Response.json({ error: '日程の保存に失敗しました' }, { status: 500 })
    }

    if (insertedDates) {
      const allImageRows: { event_id: string; event_date_id: string; image_url: string; sort_order: number; caption: string | null }[] = []
      for (const inserted of insertedDates) {
        const dateData = dates[inserted.sort_order]
        const urls = (dateData as Record<string, unknown>).imageUrls as string[] | undefined
        const caps = (dateData as Record<string, unknown>).imageCaptions as string[] | undefined
        if (urls && urls.length > 0) {
          urls.forEach((url, j) => {
            allImageRows.push({
              event_id: eventId,
              event_date_id: inserted.id,
              image_url: url,
              sort_order: j,
              caption: caps?.[j] || null,
            })
          })
        }
      }
      if (allImageRows.length > 0) {
        const { error: imgError } = await supabase.from('event_images').insert(allImageRows)
        if (imgError) console.error('[POST /api/event-dates] event_images insert failed', imgError)
      }
    }
  }

  return Response.json({ success: true })
}
