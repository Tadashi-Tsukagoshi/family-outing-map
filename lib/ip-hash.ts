import crypto from 'crypto'

/** Vercel のプロキシヘッダからクライアントIPを取り出す */
export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

/** IP_HASH_SALT + IP を SHA-256 でハッシュ化し、生IPを保存せずに重複判定できるようにする */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT
  if (!salt) throw new Error('IP_HASH_SALT is not set')
  return crypto.createHash('sha256').update(salt + ip).digest('hex')
}

const BOT_UA_PATTERNS = /bot|spider|crawler|curl|python|headless|wget|scraper|fetch/i

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent) return true
  return BOT_UA_PATTERNS.test(userAgent)
}
