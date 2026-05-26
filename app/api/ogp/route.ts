import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return Response.json({ imageUrl: null }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGPFetcher/1.0)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return Response.json({ imageUrl: null })

    const html = await res.text()

    // property="og:image" content="..." or content="..." property="og:image"
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)

    return Response.json({ imageUrl: match?.[1] ?? null })
  } catch {
    return Response.json({ imageUrl: null })
  }
}
