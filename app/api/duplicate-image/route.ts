import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminRequest } from '@/lib/admin-session'

const BUCKET   = 'event-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/** イベント複製機能用：既存の event-images 内の画像を fetch して別ファイル名で同バケットにコピーする */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: '権限がありません' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const url = (body as Record<string, unknown>).url
  if (typeof url !== 'string' || !url.trim()) {
    return Response.json({ error: '画像URLが不正です' }, { status: 400 })
  }

  // event-images バケットの公開URL以外は fetch させない（SSRF対策）
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL
  const allowedPrefix  = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/${BUCKET}/` : null
  if (!allowedPrefix || !url.startsWith(allowedPrefix)) {
    return Response.json({ error: '許可されていない画像URLです' }, { status: 400 })
  }

  let imgRes: Response
  try {
    imgRes = await fetch(url)
  } catch {
    return Response.json({ error: '画像の取得に失敗しました' }, { status: 400 })
  }
  if (!imgRes.ok) {
    return Response.json({ error: '画像の取得に失敗しました' }, { status: 400 })
  }

  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    return Response.json({ error: '画像ファイルではありません' }, { status: 400 })
  }

  const buffer = Buffer.from(await imgRes.arrayBuffer())
  if (buffer.length > MAX_SIZE) {
    return Response.json({ error: 'ファイルサイズが大きすぎます（5MBまで）' }, { status: 400 })
  }

  const ext  = contentType === 'image/png' ? 'png' : 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

  const supabase = supabaseAdmin()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false })

  if (error) {
    console.error('[POST /api/duplicate-image]', error)
    return Response.json({ error: '画像の複製に失敗しました' }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return Response.json({ url: data.publicUrl }, { status: 201 })
}
