import { supabaseAdmin } from '@/lib/supabase'
import type { CollectedEvent } from '@/lib/events'
import type { NextRequest } from 'next/server'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'
import { normalizeEventType } from '@/lib/spots'

async function authorizeEventAccess(req: NextRequest, id: string) {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('edit_token')
    .eq('id', id)
    .single()

  if (error || !data) {
    return { ok: false as const, response: Response.json({ error: '対象のイベントが見つかりません' }, { status: 404 }) }
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  const adminKey      = req.headers.get('x-admin-key')
  const editToken     = req.headers.get('x-edit-token')
  const sessionToken  = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  const isAdminByKey     = !!adminPassword && adminKey === adminPassword
  const isAdminBySession = !!adminPassword && verifyAdminSessionToken(sessionToken, adminPassword)
  const isAdmin = isAdminByKey || isAdminBySession
  const isOwner = !!data.edit_token && editToken === data.edit_token

  if (!isAdmin && !isOwner) {
    return { ok: false as const, response: Response.json({ error: '権限がありません' }, { status: 403 }) }
  }

  return { ok: true as const, isAdmin }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const auth = await authorizeEventAccess(req, id)
    if (!auth.ok) return auth.response

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
    }

    const b = body as Record<string, unknown>
    const name         = (b.name         as string | undefined)?.trim()
    const venue        = ((b.venue as string | undefined) ?? '').trim()
    const fee          = (b.fee          as string | undefined)?.trim() || null
    const imageUrl     = (b.imageUrl     as string | undefined)?.trim() || null
    const startDate    = (b.startDate    as string | undefined)?.trim()
    const endDate      = (b.endDate      as string | undefined)?.trim()
    const scheduleNote = (b.scheduleNote as string | undefined)?.trim() || null
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

    const updateData: Record<string, unknown> = {
      name,
      description:   ((b.description as string | undefined) ?? '').trim(),
      start_date:    isPermanent || scheduleNote ? null : (startDate ?? null),
      end_date:      isPermanent || scheduleNote ? null : (endDate   ?? null),
      schedule_note: isPermanent ? null : scheduleNote,
      venue,
      fee,
      image_url: imageUrl,
      lat,
      lng,
      category:      (b.category   as string) ?? 'event',
      type,
      url:           ((b.url      as string | undefined) ?? '').trim() || null,
    }

    if (auth.isAdmin) {
      updateData.edited_by = '運営'
      updateData.edited_at = new Date().toISOString()
    }

    const supabase = supabaseAdmin()
    const { data, error } = await supabase
      .from('events')
      .update(updateData)
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
      type:        data.type ?? undefined,
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params

    const auth = await authorizeEventAccess(req, id)
    if (!auth.ok) return auth.response

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
