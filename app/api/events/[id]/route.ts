import { supabaseAdmin } from '@/lib/supabase'
import type { CollectedEvent } from '@/lib/events'
import type { NextRequest } from 'next/server'

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

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

    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('events')
      .update({
        name,
        description:   ((b.description as string | undefined) ?? '').trim(),
        start_date:    scheduleNote ? null : (startDate ?? null),
        end_date:      scheduleNote ? null : (endDate   ?? null),
        schedule_note: scheduleNote,
        venue,
        fee,
        image_url: imageUrl,
        lat,
        lng,
        category:      (b.category   as string) ?? 'event',
        url:           ((b.url      as string | undefined) ?? '').trim() || null,
        posted_by:     ((b.postedBy as string | undefined) ?? '匿名').trim() || '匿名',
        poster_type:   (b.posterType as string) ?? 'general',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PUT /api/events/[id]]', error)
      return Response.json({ error: '更新に失敗しました' }, { status: 500 })
    }

    const updated: CollectedEvent = {
      id:          data.id,
      name:        data.name,
      description: data.description,
      startDate:   data.start_date,
      endDate:     data.end_date,
      venue:       data.venue,
      fee:         data.fee ?? undefined,
      imageUrl:    data.image_url ?? undefined,
      lat:         data.lat,
      lng:         data.lng,
      category:    data.category,
      url:         data.url ?? undefined,
      collectedAt: data.collected_at,
      postedBy:     data.posted_by,
      posterType:   data.poster_type,
      scheduleNote: data.schedule_note ?? undefined,
    }

    return Response.json({ success: true, event: updated })
  } catch (err) {
    console.error('[PUT /api/events/[id]]', err)
    return Response.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const supabase = supabaseAdmin()
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[DELETE /api/events/[id]]', error)
      return Response.json({ error: '削除に失敗しました' }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/events/[id]]', err)
    return Response.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
