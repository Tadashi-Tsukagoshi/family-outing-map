import { supabaseAdmin } from '@/lib/supabase'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const { searchParams } = new URL(req.url)
  const eventDateId = searchParams.get('event_date_id')
  const supabase = supabaseAdmin()

  let query = supabase
    .from('event_images')
    .select('id, image_url, sort_order, caption')
    .eq('event_id', id)

  if (eventDateId) {
    query = query.eq('event_date_id', eventDateId)
  } else {
    query = query.is('event_date_id', null)
  }

  const { data, error } = await query.order('sort_order', { ascending: true })

  if (error) {
    console.error('[GET /api/events/[id]/images]', error)
    return Response.json({ images: [] })
  }

  const images = data.map(row => ({ id: row.id, imageUrl: row.image_url, caption: row.caption ?? null }))
  return Response.json({ images })
}
