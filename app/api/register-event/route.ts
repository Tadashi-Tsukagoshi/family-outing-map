import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
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
  const venue        = (b.venue        as string | undefined)?.trim()
  const fee          = (b.fee          as string | undefined)?.trim() || null
  const imageUrl     = (b.imageUrl     as string | undefined)?.trim() || null
  const startDate    = (b.startDate    as string | undefined)?.trim()
  const endDate      = (b.endDate      as string | undefined)?.trim()
  const scheduleNote = (b.scheduleNote as string | undefined)?.trim() || null
  const lat          = typeof b.lat === 'number' ? b.lat : undefined
  const lng          = typeof b.lng === 'number' ? b.lng : undefined

  if (!name)  return Response.json({ error: 'イベント名は必須です' }, { status: 400 })
  if (!venue) return Response.json({ error: '会場名は必須です' },     { status: 400 })
  if (!scheduleNote && !startDate) return Response.json({ error: '開始日は必須です' }, { status: 400 })
  if (!scheduleNote && !endDate)   return Response.json({ error: '終了日は必須です' }, { status: 400 })
  if (lat === undefined || lng === undefined) {
    return Response.json({ error: '緯度経度を取得してください' }, { status: 400 })
  }

  const newEvent = {
    id:            `event-${crypto.randomUUID()}`,
    name,
    description:   ((b.description as string | undefined) ?? '').trim(),
    start_date:    scheduleNote ? null : (startDate ?? null),
    end_date:      scheduleNote ? null : (endDate   ?? null),
    schedule_note: scheduleNote,
    venue,
    fee,
    image_url:     imageUrl,
    lat,
    lng,
    category:      (b.category as string) ?? 'event',
    url:           ((b.url as string | undefined) ?? '').trim() || null,
    collected_at:  new Date().toISOString(),
    posted_by:     ((b.postedBy as string | undefined) ?? '匿名').trim() || '匿名',
    poster_type:   (b.posterType as string) ?? 'general',
  }

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('events').insert(newEvent)

  if (error) {
    console.error('[POST /api/register-event]', error)
    return Response.json({ error: '登録に失敗しました（サーバーエラー）' }, { status: 500 })
  }

  const responseEvent: CollectedEvent = {
    id:          newEvent.id,
    name:        newEvent.name,
    description: newEvent.description,
    startDate:   newEvent.start_date ?? undefined,
    endDate:     newEvent.end_date   ?? undefined,
    venue:       newEvent.venue,
    fee:         newEvent.fee ?? undefined,
    imageUrl:    newEvent.image_url ?? undefined,
    lat:         newEvent.lat,
    lng:         newEvent.lng,
    category:    newEvent.category as CollectedEvent['category'],
    url:         newEvent.url ?? undefined,
    collectedAt: newEvent.collected_at,
    postedBy:    newEvent.posted_by,
    posterType:  newEvent.poster_type as CollectedEvent['posterType'],
  }

  return Response.json({ success: true, event: responseEvent }, { status: 201 })
}
