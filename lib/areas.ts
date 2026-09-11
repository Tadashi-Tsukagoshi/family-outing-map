/**
 * /area/[slug] のSEOランディングページ用エリア一覧。
 * エリアチップの areaCounts（lib/spots.ts の extractMunicipality）に現在登場する市区町村を
 * ローマ字slugと対応付けた静的な一覧（群馬県外の近隣市町村を含む）。
 * 新たに events テーブルに登場した市町村をページ対象に追加したい場合はここに追記する。
 */
export type AreaDef = {
  slug: string
  /** extractMunicipality() が返す表記と完全一致させること */
  name: string
}

export const AREA_DEFS: AreaDef[] = [
  { slug: 'maebashi',        name: '前橋市' },
  { slug: 'takasaki',        name: '高崎市' },
  { slug: 'ashikaga',        name: '足利市' },
  { slug: 'fujioka',         name: '藤岡市' },
  { slug: 'isesaki',         name: '伊勢崎市' },
  { slug: 'koga',            name: '古河市' },
  { slug: 'ota',             name: '太田市' },
  { slug: 'tomioka',         name: '富岡市' },
  { slug: 'shimonita',       name: '下仁田町' },
  { slug: 'kiryu',           name: '桐生市' },
  { slug: 'nakanojo',        name: '中之条町' },
  { slug: 'midori',          name: 'みどり市' },
  { slug: 'yoshioka',        name: '吉岡町' },
  { slug: 'takayama',        name: '高山村' },
  { slug: 'ueno',            name: '上野村' },
  { slug: 'fukaya',          name: '深谷市' },
  { slug: 'higashiagatsuma', name: '東吾妻町' },
  { slug: 'ora',             name: '邑楽町' },
  { slug: 'tokigawa',        name: 'ときがわ町' },
  { slug: 'minakami',        name: 'みなかみ町' },
  { slug: 'annaka',          name: '安中市' },
  { slug: 'shibukawa',       name: '渋川市' },
  { slug: 'shinto',          name: '榛東村' },
  { slug: 'kanna',           name: '神流町' },
  { slug: 'kusatsu',         name: '草津町' },
  { slug: 'higashichichibu', name: '東秩父村' },
  { slug: 'katashina',       name: '片品村' },
  { slug: 'hinoemata',       name: '檜枝岐村' },
]

export function getAreaBySlug(slug: string): AreaDef | undefined {
  return AREA_DEFS.find((a) => a.slug === slug)
}

export function getAreaByName(name: string): AreaDef | undefined {
  return AREA_DEFS.find((a) => a.name === name)
}
