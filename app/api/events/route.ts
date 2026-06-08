import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('id, name, description, start_date, end_date, schedule_note, venue, fee, image_url, lat, lng, category, url, collected_at, posted_by, poster_type, likes, edited_by, edited_at')
    .order('start_date', { ascending: true })

  if (error) {
    console.error('[GET /api/events]', error)
    return Response.json({ events: [], lastCollected: null })
  }

  const events = data.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    startDate: e.start_date,
    endDate: e.end_date,
    venue: e.venue,
    fee: e.fee ?? undefined,
    imageUrl: e.image_url ?? undefined,
    lat: e.lat,
    lng: e.lng,
    category: e.category,
    url: e.url,
    collectedAt: e.collected_at,
    postedBy:     e.posted_by,
    posterType:   e.poster_type,
    scheduleNote: e.schedule_note ?? undefined,
    likes:        e.likes ?? 0,
    editedBy:     e.edited_by ?? undefined,
    editedAt:     e.edited_at ?? undefined,
  }))

  return Response.json({ events, lastCollected: null })
}
