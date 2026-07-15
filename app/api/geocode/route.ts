/**
 * ジオコーディング プロキシ（Google Geocoding API）
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q) return Response.json({ error: '住所を指定してください' }, { status: 400 })

  const googleUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  googleUrl.searchParams.set('address', q)
  googleUrl.searchParams.set('key', process.env.GOOGLE_GEOCODING_API_KEY ?? '')
  googleUrl.searchParams.set('language', 'ja')
  googleUrl.searchParams.set('region', 'jp')

  const res = await fetch(googleUrl.toString(), {
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) return Response.json({ error: 'ジオコーディングに失敗しました' }, { status: 502 })

  const data = await res.json() as {
    results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>
  }
  if (!data.results.length) return Response.json({ error: '住所が見つかりませんでした' }, { status: 404 })

  const { lat, lng } = data.results[0].geometry.location
  return Response.json({ lat, lng, display_name: data.results[0].formatted_address })
}
