import { supabaseAdmin } from '@/lib/supabase'
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = supabaseAdmin()

  const { data, error } = await supabase
    .from('event_images')
    .select('id, image_url, sort_order, caption')
    .eq('event_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[GET /api/events/[id]/images]', error)
    return Response.json({ images: [] })
  }

  const images = data.map(row => ({ id: row.id, imageUrl: row.image_url, caption: row.caption ?? null }))
  return Response.json({ images })
}
