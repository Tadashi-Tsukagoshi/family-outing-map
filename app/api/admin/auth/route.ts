import { cookies } from 'next/headers'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/admin-session'

export async function GET() {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return Response.json({ authed: false })

  const cookieStore  = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  const authed       = verifyAdminSessionToken(sessionToken, adminPassword)

  return Response.json({ authed })
}

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
    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(adminPassword), {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   ADMIN_SESSION_MAX_AGE_SECONDS,
    })
    return Response.json({ success: true })
  }

  return Response.json({ error: 'パスワードが正しくありません' }, { status: 401 })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_SESSION_COOKIE)
  return Response.json({ success: true })
}
