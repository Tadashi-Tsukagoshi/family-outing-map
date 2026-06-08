import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET   = 'event-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: Request) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return Response.json({ error: '画像ファイルが見つかりません' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return Response.json({ error: '画像ファイルを選択してください' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'ファイルサイズが大きすぎます（5MBまで）' }, { status: 400 })
  }

  const ext  = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`

  const supabase = supabaseAdmin()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) {
    console.error('[POST /api/upload-image]', error)
    return Response.json({ error: 'アップロードに失敗しました' }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return Response.json({ url: data.publicUrl }, { status: 201 })
}
