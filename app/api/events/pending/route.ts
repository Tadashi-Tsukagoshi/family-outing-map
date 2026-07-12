import { supabaseAdmin } from '@/lib/supabase'
import type { CollectedEvent } from '@/lib/events'
import type { NextRequest } from 'next/server'
import { isAdminRequest } from '@/lib/admin-session'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('id, name, description, start_date, end_date, schedule_note, venue, fee, image_url, lat, lng, category, type, url, collected_at, posted_by, poster_type, status')
    .eq('status', 'pending')
    .order('collected_at', { ascending: false })

  if (error) {
    console.error('[GET /api/events/pending]', error)
    return Response.json({ events: [] }, { status: 500 })
  }

  const events: CollectedEvent[] = data.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    startDate: e.start_date ?? undefined,
    endDate: e.end_date ?? undefined,
    scheduleNote: e.schedule_note ?? undefined,
    venue: e.venue,
    fee: e.fee ?? undefined,
    imageUrl: e.image_url ?? undefined,
    lat: e.lat,
    lng: e.lng,
    category: e.category,
    type: e.type ?? 'event',
    url: e.url ?? undefined,
    collectedAt: e.collected_at,
    postedBy: e.posted_by,
    posterType: e.poster_type,
    status: e.status,
  }))

  return Response.json({ events })
}
