import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { extractClientIp, hashIp, isLikelyBot } from '@/lib/ip-hash'
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-session'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })

  // 管理者セッションがある場合は計測しない（自分の閲覧を含めないため）
  const adminPassword = process.env.ADMIN_PASSWORD
  const sessionToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value
  if (adminPassword && verifyAdminSessionToken(sessionToken, adminPassword)) {
    return NextResponse.json({ ok: true, skipped: 'admin' })
  }

  const userAgent = req.headers.get('user-agent')
  if (isLikelyBot(userAgent)) {
    return NextResponse.json({ ok: true, skipped: 'bot' })
  }

  const ip = extractClientIp(req.headers)
  const ipHash = hashIp(ip)

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('event_views').insert({
    event_id: id,
    ip_hash: ipHash,
    user_agent: userAgent?.slice(0, 500) ?? null,
  })

  // UNIQUE 制約違反（同日同IPの重複）は無視
  if (error && error.code !== '23505') {
    console.error('[POST /api/events/[id]/view]', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
