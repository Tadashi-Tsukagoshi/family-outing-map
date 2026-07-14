/**
 * ジオコーディング プロキシ（Mapbox Geocoding API）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return Response.json({ error: '住所を指定してください' }, { status: 400 })

  const mapboxUrl = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  )
  mapboxUrl.searchParams.set('access_token', process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '')
  mapboxUrl.searchParams.set('country', 'jp')
  mapboxUrl.searchParams.set('language', 'ja')
  mapboxUrl.searchParams.set('limit', '1')

  const res = await fetch(mapboxUrl.toString(), {
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) return Response.json({ error: 'ジオコーディングに失敗しました' }, { status: 502 })

  const data = await res.json() as {
    features: Array<{ center: [number, number]; place_name: string }>
  }
  if (!data.features.length) return Response.json({ error: '住所が見つかりませんでした' }, { status: 404 })

  const [lng, lat] = data.features[0].center
  return Response.json({ lat, lng, display_name: data.features[0].place_name })
}
