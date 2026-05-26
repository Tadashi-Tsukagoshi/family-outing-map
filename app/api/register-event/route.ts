import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { CollectedEvent, EventsDatabase } from '@/lib/events'

const DATA_FILE = path.join(process.cwd(), 'data', 'events.json')

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const b = body as Record<string, unknown>

  // バリデーション
  const name    = (b.name    as string | undefined)?.trim()
  const venue   = (b.venue   as string | undefined)?.trim()
  const startDate = (b.startDate as string | undefined)?.trim()
  const endDate   = (b.endDate   as string | undefined)?.trim()
  const lat     = typeof b.lat === 'number' ? b.lat : undefined
  const lng     = typeof b.lng === 'number' ? b.lng : undefined

  if (!name)      return Response.json({ error: 'イベント名は必須です' },   { status: 400 })
  if (!venue)     return Response.json({ error: '会場名は必須です' },       { status: 400 })
  if (!startDate) return Response.json({ error: '開始日は必須です' },       { status: 400 })
  if (!endDate)   return Response.json({ error: '終了日は必須です' },       { status: 400 })
  if (lat === undefined || lng === undefined) {
    return Response.json({ error: '緯度経度を取得してください' }, { status: 400 })
  }

  const newEvent: CollectedEvent = {
    id:          `event-${crypto.randomUUID()}`,
    name,
    description: ((b.description as string | undefined) ?? '').trim(),
    startDate,
    endDate,
    venue,
    lat,
    lng,
    category:    (b.category as CollectedEvent['category']) ?? 'event',
    url:         ((b.url      as string | undefined) ?? '').trim() || undefined,
    imageUrl:    ((b.imageUrl as string | undefined) ?? '').trim() || undefined,
    collectedAt: new Date().toISOString(),
  }

  // 既存 DB を読み込んで追加
  let db: EventsDatabase
  try {
    db = JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'))
  } catch {
    db = { events: [], lastCollected: null }
  }

  db.events.push(newEvent)
  db.lastCollected = newEvent.collectedAt

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')

  return Response.json({ success: true, event: newEvent }, { status: 201 })
}
