import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCategory, normalizeEventType } from '@/lib/spots'
import type { CollectedEvent } from '@/lib/events'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  const name         = (b.name         as string | undefined)?.trim()
  const venue        = ((b.venue as string | undefined) ?? '').trim()
  const address      = (b.address      as string | undefined)?.trim() || null
  const fee          = (b.fee          as string | undefined)?.trim() || null
  const imageUrls    = Array.isArray(b.imageUrls)
    ? (b.imageUrls as unknown[]).filter((u): u is string => typeof u === 'string' && u.trim() !== '').slice(0, 5)
    : []
  const imageUrl     = imageUrls[0] ?? ((b.imageUrl as string | undefined)?.trim() || null)
  const imageCaptions = Array.isArray(b.imageCaptions)
    ? (b.imageCaptions as unknown[]).map(c => (typeof c === 'string' ? c.trim() : ''))
    : []
  const email        = (b.email        as string | undefined)?.trim() || null
  const startDate    = (b.startDate    as string | undefined)?.trim()
  const endDate      = (b.endDate      as string | undefined)?.trim()
  const scheduleNote = (b.scheduleNote as string | undefined)?.trim() || null
  const specificDates = (b.specificDates as string | null | undefined)?.trim() || null
  const notice       = (b.notice       as string | undefined)?.trim() || null
  const startTime     = (b.startTime     as string | undefined)?.trim() || null
  const endTime       = (b.endTime       as string | undefined)?.trim() || null
  const businessHours = (b.businessHours as string | undefined)?.trim() || null
  const spotLabel      = (b.spotLabel     as string | undefined)?.trim() || null
  const lat          = typeof b.lat === 'number' ? b.lat : undefined
  const lng          = typeof b.lng === 'number' ? b.lng : undefined
  const type         = normalizeEventType(b.type)
  const isPermanent  = type === 'permanent'

  if (!name)  return Response.json({ error: 'イベント名は必須です' }, { status: 400 })
  if (!isPermanent && !venue) return Response.json({ error: '会場名は必須です' },     { status: 400 })
  if (!isPermanent && !scheduleNote && !startDate) return Response.json({ error: '開始日は必須です' }, { status: 400 })
  if (!isPermanent && !scheduleNote && !endDate)   return Response.json({ error: '終了日は必須です' }, { status: 400 })
  if (lat === undefined || lng === undefined) {
    return Response.json({ error: '緯度経度を取得してください' }, { status: 400 })
  }

  const editToken = crypto.randomUUID()
  const posterType = (b.posterType as string) || 'general'
  const status = posterType === 'staff' ? 'approved' : 'pending'

  const newEvent = {
    id:            `event-${crypto.randomUUID()}`,
    name,
    description:   ((b.description as string | undefined) ?? '').trim(),
    start_date:    isPermanent || scheduleNote ? null : (startDate ?? null),
    end_date:      isPermanent || scheduleNote ? null : (endDate   ?? null),
    start_time:    isPermanent ? null : startTime,
    end_time:      isPermanent ? null : endTime,
    business_hours: isPermanent ? businessHours : null,
    spot_label:    isPermanent ? spotLabel : null,
    schedule_note: isPermanent ? null : scheduleNote,
    specific_dates: isPermanent || scheduleNote ? null : specificDates,
    notice,
    venue,
    address,
    fee,
    image_url:     imageUrl,
    lat,
    lng,
    category:      normalizeCategory(b.category),
    type,
    url:           ((b.url as string | undefined) ?? '').trim() || null,
    instagram_url: ((b.instagram_url as string | undefined) ?? '').trim() || null,
    x_url:         ((b.x_url as string | undefined) ?? '').trim() || null,
    collected_at:  new Date().toISOString(),
    posted_by:     posterType === 'staff' ? 'GUNMAP' : (((b.postedBy as string | undefined) ?? '匿名').trim() || '匿名'),
    email,
    poster_type:   posterType,
    edit_token:    editToken,
    status,
  }

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('events').insert(newEvent)

  if (error) {
    console.error('[POST /api/register-event]', error)
    return Response.json({ error: '登録に失敗しました（サーバーエラー）' }, { status: 500 })
  }

  if (imageUrls.length > 0) {
    const imageRows = imageUrls.map((url, i) => ({
      event_id:   newEvent.id,
      image_url:  url,
      sort_order: i,
      caption:    imageCaptions[i] || null,
    }))
    const { error: imagesError } = await supabase.from('event_images').insert(imageRows)
    if (imagesError) {
      console.error('[POST /api/register-event] event_images insert failed', imagesError)
    }
  }

  const responseEvent: CollectedEvent = {
    id:          newEvent.id,
    name:        newEvent.name,
    description: newEvent.description,
    startDate:   newEvent.start_date ?? undefined,
    endDate:     newEvent.end_date   ?? undefined,
    venue:       newEvent.venue,
    address:     newEvent.address ?? undefined,
    fee:         newEvent.fee ?? undefined,
    imageUrl:    newEvent.image_url ?? undefined,
    lat:         newEvent.lat,
    lng:         newEvent.lng,
    category:    newEvent.category as CollectedEvent['category'],
    type:        newEvent.type,
    startTime:   newEvent.start_time ?? undefined,
    endTime:     newEvent.end_time ?? undefined,
    businessHours: newEvent.business_hours ?? undefined,
    spotLabel:   newEvent.spot_label ?? undefined,
    specificDates: newEvent.specific_dates ?? undefined,
    notice:      newEvent.notice ?? undefined,
    url:         newEvent.url ?? undefined,
    instagramUrl: newEvent.instagram_url ?? undefined,
    xUrl:         newEvent.x_url ?? undefined,
    collectedAt: newEvent.collected_at,
    postedBy:    newEvent.posted_by,
    email:       newEvent.email ?? undefined,
    posterType:  newEvent.poster_type as CollectedEvent['posterType'],
    status:      newEvent.status as CollectedEvent['status'],
  }

  return Response.json({ success: true, event: responseEvent, editToken }, { status: 201 })
}
