import { supabaseAdmin } from '@/lib/supabase'

type EventDateRow = {
  id: string | number
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  venue: string | null
  address: string | null
  lat: number | null
  lng: number | null
  note: string | null
  sort_order: number
}

export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('events')
    .select('id, name, description, start_date, end_date, start_time, end_time, business_hours, spot_label, schedule_note, specific_dates, notice, venue, address, fee, image_url, lat, lng, category, type, url, instagram_url, x_url, collected_at, posted_by, poster_type, likes, edited_by, edited_at, event_dates(id, start_date, end_date, start_time, end_time, venue, address, lat, lng, note, sort_order)')
    .eq('status', 'approved')
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
    address: e.address ?? undefined,
    fee: e.fee ?? undefined,
    imageUrl: e.image_url ?? undefined,
    lat: e.lat,
    lng: e.lng,
    category: e.category,
    type: e.type ?? 'event',
    url: e.url,
    instagramUrl: e.instagram_url ?? undefined,
    xUrl: e.x_url ?? undefined,
    collectedAt: e.collected_at,
    postedBy:     e.posted_by,
    posterType:   e.poster_type,
    scheduleNote: e.schedule_note ?? undefined,
    specificDates: e.specific_dates ?? undefined,
    notice:       e.notice ?? undefined,
    likes:        e.likes ?? 0,
    editedBy:     e.edited_by ?? undefined,
    editedAt:     e.edited_at ?? undefined,
    startTime:    e.start_time ?? undefined,
    endTime:      e.end_time ?? undefined,
    businessHours: e.business_hours ?? undefined,
    spotLabel:    e.spot_label ?? undefined,
    eventDates: Array.isArray(e.event_dates) && e.event_dates.length > 0
      ? (e.event_dates as EventDateRow[])
          .slice()
          .sort((a, b) => (a.sort_order - b.sort_order) || a.start_date.localeCompare(b.start_date))
          .map(d => ({
            id:             String(d.id),
            startDate:      d.start_date,
            endDate:        d.end_date,
            startTime:      d.start_time ?? '',
            endTime:        d.end_time ?? '',
            venue:          d.venue ?? '',
            address:        d.address ?? '',
            lat:            d.lat ?? null,
            lng:            d.lng ?? null,
            note:           d.note ?? '',
            useCustomVenue: !!(d.venue || d.address),
          }))
      : undefined,
  }))

  return Response.json({ events, lastCollected: null })
}
