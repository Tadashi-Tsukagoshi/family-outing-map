import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('*')
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
    lat: e.lat,
    lng: e.lng,
    category: e.category,
    url: e.url,
    collectedAt: e.collected_at,
    postedBy: e.posted_by,
    posterType: e.poster_type,
  }))

  return Response.json({ events, lastCollected: null })
}
