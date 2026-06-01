import { promises as fs } from 'fs'
import path from 'path'
import type { CollectedEvent, EventsDatabase } from '@/lib/events'
import { SPOTS } from '@/lib/spots'
import type { NextRequest } from 'next/server'

const DATA_FILE = path.join(process.cwd(), 'data', 'events.json')

async function readDb(): Promise<EventsDatabase> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'))
  } catch {
    return { events: [], lastCollected: null }
  }
}

async function writeDb(db: EventsDatabase) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/events/[id]'>) {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const name      = (b.name      as string | undefined)?.trim()
  const venue     = (b.venue     as string | undefined)?.trim()
  const startDate = (b.startDate as string | undefined)?.trim()
  const endDate   = (b.endDate   as string | undefined)?.trim()
  const lat       = typeof b.lat === 'number' ? b.lat : undefined
  const lng       = typeof b.lng === 'number' ? b.lng : undefined

  if (!name)      return Response.json({ error: 'イベント名は必須です' },   { status: 400 })
  if (!venue)     return Response.json({ error: '会場名は必須です' },       { status: 400 })
  if (!startDate) return Response.json({ error: '開始日は必須です' },       { status: 400 })
  if (!endDate)   return Response.json({ error: '終了日は必須です' },       { status: 400 })
  if (lat === undefined || lng === undefined) {
    return Response.json({ error: '緯度経度を取得してください' }, { status: 400 })
  }

  const db  = await readDb()
  const idx = db.events.findIndex(e => e.id === id)

  if (idx === -1) {
    // 固定スポットの編集保存（events.json にオーバーライドとして追加）
    if (!SPOTS.some(s => s.id === id)) {
      return Response.json({ error: 'イベントが見つかりません' }, { status: 404 })
    }
    const newEvent: CollectedEvent = {
      id,
      name,
      description: ((b.description as string | undefined) ?? '').trim(),
      startDate,
      endDate,
      venue,
      lat,
      lng,
      category: (b.category as CollectedEvent['category']) ?? 'event',
      url:      ((b.url      as string | undefined) ?? '').trim() || undefined,
      imageUrl: ((b.imageUrl as string | undefined) ?? '').trim() || undefined,
      collectedAt: new Date().toISOString(),
      postedBy:   ((b.postedBy as string | undefined) ?? '匿名').trim() || '匿名',
      posterType: (b.posterType as CollectedEvent['posterType']) ?? 'general',
    }
    db.events.push(newEvent)
    await writeDb(db)
    return Response.json({ success: true, event: newEvent })
  }

  const updated: CollectedEvent = {
    ...db.events[idx],
    name,
    description: ((b.description as string | undefined) ?? '').trim(),
    startDate,
    endDate,
    venue,
    lat,
    lng,
    category:   (b.category   as CollectedEvent['category'])   ?? db.events[idx].category   ?? 'event',
    url:        ((b.url      as string | undefined) ?? '').trim() || undefined,
    imageUrl:   ((b.imageUrl as string | undefined) ?? '').trim() || undefined,
    postedBy:   ((b.postedBy as string | undefined) ?? db.events[idx].postedBy ?? '匿名').trim() || '匿名',
    posterType: (b.posterType as CollectedEvent['posterType']) ?? db.events[idx].posterType ?? 'general',
  }

  db.events[idx] = updated
  await writeDb(db)

  return Response.json({ success: true, event: updated })
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/events/[id]'>) {
  const { id } = await ctx.params

  const db  = await readDb()
  const idx = db.events.findIndex(e => e.id === id)

  if (idx === -1) {
    // 固定スポットの削除（hiddenSpotIds に追加）
    if (!SPOTS.some(s => s.id === id)) {
      return Response.json({ error: 'イベントが見つかりません' }, { status: 404 })
    }
    db.hiddenSpotIds = [...new Set([...(db.hiddenSpotIds ?? []), id])]
    await writeDb(db)
    return Response.json({ success: true })
  }

  db.events.splice(idx, 1)
  // events.json のエントリが固定スポットのオーバーライドだった場合も非表示にする
  if (SPOTS.some(s => s.id === id)) {
    db.hiddenSpotIds = [...new Set([...(db.hiddenSpotIds ?? []), id])]
  }
  await writeDb(db)

  return Response.json({ success: true })
}
