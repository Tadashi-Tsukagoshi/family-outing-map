import Anthropic from '@anthropic-ai/sdk'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { CollectedEvent, EventsDatabase } from '@/lib/events'

const DATA_FILE = path.join(process.cwd(), 'data', 'events.json')

const KNOWN_VENUES = `
太田市美術館・図書館: 36.2920, 139.3670
金山総合公園: 36.3066, 139.3578
太田市子ども科学館: 36.2845, 139.3720
道の駅おおた: 36.2802, 139.3891
太田市総合体育館: 36.2855, 139.3655
太田市文化会館: 36.2918, 139.3622
太田駅周辺: 36.2951, 139.3723
スバルの森アリーナ: 36.2830, 139.3750
太田市運動公園: 36.2780, 139.3820
`.trim()

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY が設定されていません' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })

  const today = new Date().toISOString().split('T')[0]
  const prompt = `今日は${today}です。太田市（群馬県）とその周辺30km以内で、${today}以降に開催される直近のイベントをウェブで検索してください。

ファミリー向け・子連れOKのイベントを優先してください（お祭り、マルシェ、体験教室、展覧会、スポーツ大会など）。

検索して見つかったイベントを、以下のJSON形式のみで回答してください（説明文・マークダウン不要）:
{
  "events": [
    {
      "name": "イベント名",
      "description": "80文字以内の説明",
      "date": "YYYY-MM-DD",
      "venue": "会場名",
      "lat": 36.2913,
      "lng": 139.3758,
      "url": "https://..."
    }
  ]
}

緯度経度の参考（会場名から推定してください）:
${KNOWN_VENUES}
太田市中心（デフォルト）: 36.2913, 139.3758

・会場が不明な場合は太田市中心の座標を使用
・urlが不明な場合は省略
・最低3件、最大10件
・見つからない場合は空の配列`

  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt }
  ]

  let response: Anthropic.Message
  let attempts = 0

  try {
    do {
      response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        messages,
      })

      if (response.stop_reason === 'pause_turn') {
        messages = [
          { role: 'user', content: prompt },
          { role: 'assistant', content: response.content },
        ]
        attempts++
      }
    } while (response.stop_reason === 'pause_turn' && attempts < 3)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Claude API エラー: ${message}` }, { status: 502 })
  }

  // 最後のテキストブロックからJSONを抽出
  const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
  const lastText = textBlocks.at(-1)?.text ?? ''

  let parsed: { events: Omit<CollectedEvent, 'id' | 'collectedAt'>[] }
  try {
    // マークダウンのコードブロックを除去してからパース
    let jsonStr = lastText.trim()
    const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlock) jsonStr = codeBlock[1].trim()
    parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.events)) throw new Error('events が配列ではありません')
  } catch (err) {
    return Response.json({ error: 'JSONパースに失敗しました', raw: lastText }, { status: 500 })
  }

  // 既存DBを読み込み
  let db: EventsDatabase
  try {
    db = JSON.parse(await fs.readFile(DATA_FILE, 'utf-8'))
  } catch {
    db = { events: [], lastCollected: null }
  }

  // 重複を除いて追加（name + date で判定）
  const existingKeys = new Set(db.events.map(e => `${e.name}|${e.date}`))
  const collectedAt = new Date().toISOString()

  const toAdd: CollectedEvent[] = parsed.events
    .filter(e => e.name && e.date && typeof e.lat === 'number' && typeof e.lng === 'number')
    .filter(e => !existingKeys.has(`${e.name}|${e.date}`))
    .map(e => ({
      id: `event-${crypto.randomUUID()}`,
      name: e.name,
      description: e.description ?? '',
      date: e.date,
      venue: e.venue ?? '',
      lat: e.lat,
      lng: e.lng,
      url: e.url || undefined,
      collectedAt,
    }))

  db.events = [...db.events, ...toAdd]
  db.lastCollected = collectedAt

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8')

  return Response.json({
    added: toAdd.length,
    total: db.events.length,
    lastCollected: collectedAt,
    events: toAdd,
  })
}
