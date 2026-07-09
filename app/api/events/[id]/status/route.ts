import { supabaseAdmin } from '@/lib/supabase'
import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin-session'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  const { id } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const status = (body as Record<string, unknown>).status
  if (status !== 'approved' && status !== 'rejected') {
    return Response.json({ error: 'status は approved か rejected を指定してください' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('[PATCH /api/events/[id]/status]', error)
    return Response.json({ error: '更新に失敗しました' }, { status: 500 })
  }

  return Response.json({ success: true })
}
