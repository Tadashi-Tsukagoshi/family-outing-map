/**
 * ジオコーディング プロキシ
 * 1. 国土地理院地図API（日本の番地まで高精度、API key不要）
 * 2. Nominatim フォールバック
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return Response.json({ error: '住所を指定してください' }, { status: 400 })

  // GSI は日本専用なので末尾の " 日本" は不要
  const qForGsi = q.replace(/\s*日本\s*$/, '').trim()

  // ── 1. 国土地理院地図API ────────────────────────────────────────
  try {
    const gsiRes = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(qForGsi)}`,
      {
        headers: { 'User-Agent': 'family-outing-map/1.0' },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (gsiRes.ok) {
      const gsiData = await gsiRes.json() as Array<{
        geometry:   { coordinates: [number, number] }
        properties: { title: string }
      }>
      if (gsiData.length > 0) {
        const [lng, lat] = gsiData[0].geometry.coordinates
        return Response.json({ lat, lng, display_name: gsiData[0].properties.title })
      }
    }
  } catch { /* fallthrough to Nominatim */ }

  // ── 2. Nominatim フォールバック ──────────────────────────────────
  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
  nominatimUrl.searchParams.set('q', q)
  nominatimUrl.searchParams.set('format', 'json')
  nominatimUrl.searchParams.set('limit', '1')
  nominatimUrl.searchParams.set('countrycodes', 'jp')
  nominatimUrl.searchParams.set('accept-language', 'ja')

  const res = await fetch(nominatimUrl.toString(), {
    headers: { 'User-Agent': 'family-outing-map/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) return Response.json({ error: 'ジオコーディングに失敗しました' }, { status: 502 })

  const data = await res.json() as Array<{ lat: string; lon: string; display_name: string }>
  if (!data.length) return Response.json({ error: '住所が見つかりませんでした' }, { status: 404 })

  const { lat, lon, display_name } = data[0]
  return Response.json({ lat: parseFloat(lat), lng: parseFloat(lon), display_name })
}
