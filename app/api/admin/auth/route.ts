export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'リクエストの形式が不正です' }, { status: 400 })
  }

  const { password } = body as { password?: string }
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return Response.json({ error: 'サーバー設定エラー: ADMIN_PASSWORD が未設定です' }, { status: 500 })
  }

  if (password === adminPassword) {
    return Response.json({ success: true })
  }

  return Response.json({ error: 'パスワードが正しくありません' }, { status: 401 })
}
