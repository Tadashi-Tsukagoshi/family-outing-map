import crypto from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * /ota-admin の運営セッションを表す署名付きトークン。
 * ADMIN_PASSWORD の値そのものをブラウザに渡さずに「運営として認証済み」を検証するための仕組み。
 * トークンは `base64url(JSON{exp}) + '.' + HMAC-SHA256(ADMIN_PASSWORD, payload)` の形式。
 */

export const ADMIN_SESSION_COOKIE = 'ota-admin-session'
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7日間

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createAdminSessionToken(secret: string): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000 })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifyAdminSessionToken(token: string | undefined | null, secret: string): boolean {
  if (!token) return false

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expected = sign(payload, secret)
  const expectedBuf  = Buffer.from(expected)
  const signatureBuf = Buffer.from(signature)
  if (expectedBuf.length !== signatureBuf.length) return false
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return false

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof exp === 'number' && exp > Date.now()
  } catch {
    return false
  }
}

/** 運営（ota-admin）としてのリクエストかどうかを、セッションCookieまたは x-admin-key ヘッダで判定する */
export function isAdminRequest(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) return false

  const adminKey     = req.headers.get('x-admin-key')
  const sessionToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value

  return adminKey === adminPassword || verifyAdminSessionToken(sessionToken, adminPassword)
}
