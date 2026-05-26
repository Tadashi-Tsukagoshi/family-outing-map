import { promises as fs } from 'fs'
import path from 'path'
import type { EventsDatabase } from '@/lib/events'

const DATA_FILE = path.join(process.cwd(), 'data', 'events.json')

export async function GET() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    return Response.json(JSON.parse(raw) as EventsDatabase)
  } catch {
    const empty: EventsDatabase = { events: [], lastCollected: null }
    return Response.json(empty)
  }
}
