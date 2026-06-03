import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

const { events } = JSON.parse(readFileSync('./data/events.json', 'utf8'))

const rows = events.map(e => ({
  id: e.id,
  name: e.name,
  description: e.description,
  start_date: e.startDate,
  end_date: e.endDate,
  venue: e.venue,
  lat: e.lat,
  lng: e.lng,
  category: e.category,
  url: e.url,
  collected_at: e.collectedAt,
  posted_by: e.postedBy,
  poster_type: e.posterType,
}))

const { data, error } = await supabase.from('events').insert(rows)
if (error) console.error('Error:', error)
else console.log('移行完了:', rows.length, '件')
