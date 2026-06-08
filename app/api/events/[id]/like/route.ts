import { supabaseAdmin } from '@/lib/supabase'
import type { NextRequest } from 'next/server'

async function adjustLikes(id: string, delta: number) {
  const supabase = supabaseAdmin()

  const { data: current, error: fetchError } = await supabase
    .from('events')
    .select('likes')
    .eq('id', id)
    .single()

  if (fetchError || !current) return { error: fetchError }

  const likes = Math.max(0, (current.likes ?? 0) + delta)

  const { data, error } = await supabase
    .from('events')
    .update({ likes })
    .eq('id', id)
    .select('likes')
    .single()

  if (error) return { error }

  return { likes: data.likes }
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const { likes, error } = await adjustLikes(id, 1)
  if (error) {
    console.error('[POST /api/events/[id]/like]', error)
    return Response.json({ error: 'いいねに失敗しました' }, { status: 500 })
  }

  return Response.json({ success: true, likes })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const { likes, error } = await adjustLikes(id, -1)
  if (error) {
    console.error('[DELETE /api/events/[id]/like]', error)
    return Response.json({ error: 'いいね解除に失敗しました' }, { status: 500 })
  }

  return Response.json({ success: true, likes })
}
