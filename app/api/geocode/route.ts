/**
 * Nominatim ジオコーディング プロキシ
 * ブラウザから直接叩くと User-Agent が不正になるため、サーバーサイドで中継する。
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) {
    return Response.json({ error: '住所を指定してください' }, { status: 400 })
  }

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('accept-language', 'ja')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'family-outing-map/1.0 (local dev)',
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    return Response.json({ error: 'ジオコーディングに失敗しました' }, { status: 502 })
  }

  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>

  if (!data.length) {
    return Response.json({ error: '住所が見つかりませんでした' }, { status: 404 })
  }

  const { lat, lon, display_name } = data[0]
  return Response.json({ lat: parseFloat(lat), lng: parseFloat(lon), display_name })
}
