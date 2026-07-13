'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'
import { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react'
import { getCategoryIconSrc, BADGE_BG_COLOR, type Category, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, STATUS_CONFIG, PERMANENT_STATUS } from '@/lib/date-utils'
import { type SheetState } from './BottomSheet'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

// ─── Types ───────────────────────────────────────────────────────
type Props = {
  spots: Spot[]
  onSpotSelect: (spot: Spot | null) => void
  selectedSpot: Spot | null
  userLocation?: [number, number] | null
  locationRadius?: number
  recenterSignal?: number
  onDetailOpen: (spot: Spot) => void
  onDetailClose: () => void
  detailPanelOpen: boolean
  isMobile?: boolean
  sheetState?: SheetState
}

type HoverState = { spot: Spot; x: number; y: number }

/** string=取得済み, null=取得済み(画像なし), 'loading'=取得中 */
type OgpEntry = string | null | 'loading'

// ─── Constants ───────────────────────────────────────────────────
/** [lat, lng] */
const OTA_CENTER: [number, number] = [36.2913, 139.3758]

/** カード幅（固定） */
const CARD_W   = 260
/** ピン中心からカード端までのギャップ（最大ピン半径 22px + 余白 4px） */
const GAP      = 14
/** コンテナ端の最小余白 */
const MARGIN   = 8
/** PC詳細パネル幅（w-72 = 288px）*/
const DETAIL_PANEL_W = 288

// ─── Unsplash images ─────────────────────────────────────────────
const CATEGORY_IMAGES: Record<Category, string> = {
  event:     'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
  fireworks: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
  festival:  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
  park:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
}

// ─── Geo helpers ─────────────────────────────────────────────────
/** [lat, lng] → mapbox-gl の [lng, lat] */
function toLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat]
}

/** Leaflet の LatLng#toBounds と同じ近似式（地球周長 40075017m を使用） */
function boundsFromCenterRadius(lat: number, lng: number, sizeMeters: number): mapboxgl.LngLatBoundsLike {
  const latAccuracy = (180 * sizeMeters) / 40075017
  const lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * lat)
  return [
    [lng - lngAccuracy, lat - latAccuracy],
    [lng + lngAccuracy, lat + latAccuracy],
  ]
}

/** 円をGeoJSONポリゴンとして生成（turf非依存の簡易近似） */
function createGeoCircle(lat: number, lng: number, radiusMeters: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180))
  const distanceY = radiusMeters / 110540
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI)
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} }
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Mapboxのスタイルレイヤーの表示言語を日本語優先に切り替える */
function setMapLanguage(map: mapboxgl.Map) {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    const layout = layer.layout as { 'text-field'?: unknown } | undefined
    if (!layout || !('text-field' in layout)) continue
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name_ja'], ['get', 'name']])
  }
}

// ─── User location marker element ────────────────────────────────
function buildUserLocationElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width = '24px'
  el.style.height = '24px'
  el.innerHTML = `
    <style>
      @keyframes sonar-ring {
        0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.5; }
        100% { transform: translate(-50%,-50%) scale(4); opacity: 0; }
      }
    </style>
    <div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;top:50%;left:50%;width:18px;height:18px;border-radius:50%;background:#3b82f6;animation:sonar-ring 3s ease-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(37,99,235,.7);"></div>
    </div>`
  return el
}

// ─── Pin icon helpers ────────────────────────────────────────────
function pickIcon(category: Category, id: string): { src: string; bg: string; glow: string; ratio: number } {
  const lanternGlow = 'filter:drop-shadow(0 0 1.5px rgba(255,255,255,1)) drop-shadow(0 0 1.5px rgba(255,255,255,1));'
  const src = getCategoryIconSrc(category, id)
  if (category === 'fireworks') return { src, bg: '#1e1614', glow: '', ratio: 0.78 }
  if (category === 'festival')  return { src, bg: '#1e1614', glow: lanternGlow, ratio: 0.63 }
  return { src, bg: 'white', glow: '', ratio: 0.78 }
}

type IconDef = { html: string; hit: number }

function buildIconDef(spot: Spot, selected: boolean, isMobile: boolean): IconDef {
  const { src: icon, bg, glow, ratio } = pickIcon(spot.category, spot.id)

  if (selected) {
    const hit  = 48
    const size = 44
    const img  = Math.round(size * ratio)
    return {
      hit,
      html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><div class="pin-selected" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid #d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.4);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`,
    }
  }

  const hit  = isMobile ? 48 : 40
  const size = 36
  const img  = Math.round(size * ratio)
  return {
    hit,
    html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid #d1d5db;box-shadow:0 2px 6px rgba(0,0,0,.25);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`,
  }
}

// ─── HoverCard ───────────────────────────────────────────────────
type Pos = {
  left:  number   // カード中心X（translate -50% の基準）
  top:   number   // above=true→カード下端, above=false→カード上端
  above: boolean  // true=ピン上表示, false=ピン下表示
  ready: boolean  // 測定完了フラグ（false の間は opacity:0）
  cardH: number   // カード高さ（ブリッジ計算用）
}

type HoverCardProps = {
  hovered:      HoverState
  wrapperRef:   React.RefObject<HTMLDivElement | null>
  onMouseEnter: () => void
  onMouseLeave: () => void
  ogpImage:     string | null | undefined
  onDetailOpen: (spot: Spot) => void
}

function HoverCard({ hovered, wrapperRef, onMouseEnter, onMouseLeave, ogpImage, onDetailOpen }: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // ready:false で初期化 → 測定前は opacity:0 で非表示
  const [pos, setPos] = useState<Pos>({
    left:  hovered.x,
    top:   hovered.y - GAP,
    above: true,
    ready: false,
    cardH: 0,
  })

  useLayoutEffect(() => {
    const card    = cardRef.current
    const wrapper = wrapperRef.current
    if (!card || !wrapper) return

    const cW    = wrapper.offsetWidth
    const cH    = wrapper.offsetHeight
    const cardH = card.offsetHeight
    const { x, y } = hovered

    // ─── 上下判定 ───────────────────────────────────────────────
    // 「ピン中心 y から上に GAP 離れた位置にカード下端」を基準に空間を確認
    const above = cardH <= y - GAP

    let top: number
    if (above) {
      // transform: translateY(-100%) でカード下端が top に来る
      top = y - GAP
    } else {
      // ピンの下に表示: top = カード上端
      top = y + GAP
      // 下端はみ出し補正
      if (top + cardH > cH - MARGIN) top = cH - MARGIN - cardH
    }

    // ─── 左右クランプ ────────────────────────────────────────────
    // translate(-50%) で left がカード中心 X になる
    const halfW = CARD_W / 2
    let left = x
    if (left - halfW < MARGIN)       left = halfW + MARGIN
    if (left + halfW > cW - MARGIN)  left = cW - MARGIN - halfW

    setPos({ left, top, above, ready: true, cardH })
  }, [hovered, wrapperRef])

  const { spot } = hovered
  const isPermanent = spot.type === 'permanent'
  const status    = getEventStatus(spot.startDate, spot.endDate)
  const dateRange = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate)
  const statusCfg = isPermanent ? PERMANENT_STATUS : (status ? STATUS_CONFIG[status] : null)

  return (
    <div
      ref={cardRef}
      style={{
        position:     'absolute',
        left:         pos.left,
        top:          pos.top,
        transform:    `translate(-50%, ${pos.above ? '-100%' : '0%'})`,
        opacity:      pos.ready ? 1 : 0,
        width:        CARD_W,
        zIndex:       1000,
        pointerEvents:'all',
        cursor:       'pointer',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={() => onDetailOpen(spot)}
    >
      {/* ── カード本体 ── */}
      <div style={{
        borderRadius: 8,
        overflow:     'hidden',
        background:   'white',
        boxShadow:    '0 2px 4px rgba(0,0,0,.10), 0 8px 24px rgba(0,0,0,.12)',
      }}>
        {/* 画像（全体の約55%） */}
        <img
          src={spot.imageUrl || ogpImage || CATEGORY_IMAGES[spot.category]}
          alt=""
          style={{ display: 'block', width: '100%', height: 100, objectFit: 'cover' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = CATEGORY_IMAGES[spot.category] }}
        />

        {/* テキストエリア（固定高さでサイズ統一） */}
        <div style={{
          padding: '8px 10px 8px',
          height: 96,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* 上部：タイトル・日程・場所 */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <p style={{
              fontWeight: 400, fontSize: 14, lineHeight: 1.35,
              color: '#1a1a1a', margin: '0 0 3px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {spot.name}
            </p>
            {statusCfg && (
              <p style={{
                fontSize: 11, margin: '-2px 0 8px',
                fontWeight: 600, color: statusCfg.color,
              }}>
                {statusCfg.label}
              </p>
            )}
            {!statusCfg && spot.scheduleNote && (
              <p style={{
                fontSize: 11, margin: '-2px 0 8px',
                fontWeight: 600, color: '#6b7280',
              }}>
                日程未確定
              </p>
            )}
            {(isPermanent || dateRange) && (
              <p style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, margin: '0 0 2px', color: '#6b7280',
                overflow: 'hidden',
              }}>
                <span style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  background: BADGE_BG_COLOR, color: '#374151', fontSize: 10, fontWeight: 400,
                }}>
                  日時
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isPermanent ? '常設施設' : dateRange}
                </span>
              </p>
            )}
            {spot.venue && (
              <p style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, margin: 0, color: '#6b7280',
                overflow: 'hidden',
              }}>
                <span style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  background: BADGE_BG_COLOR, color: '#374151', fontSize: 10, fontWeight: 400,
                }}>
                  会場
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {spot.venue}
                </span>
              </p>
            )}
          </div>

        </div>
      </div>

    </div>
  )
}

const PEEK_HEIGHT = 72

// ─── MapView（メインコンポーネント） ─────────────────────────────
export default function MapView({ spots, onSpotSelect, selectedSpot, userLocation = null, locationRadius = 60, recenterSignal = 0, onDetailOpen, onDetailClose, detailPanelOpen, isMobile = false, sheetState = 'closed' }: Props) {
  const wrapperRef       = useRef<HTMLDivElement>(null)
  const containerRef     = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const markersRef       = useRef<Record<string, mapboxgl.Marker>>({})
  const userMarkerRef    = useRef<mapboxgl.Marker | null>(null)
  const navControlRef    = useRef<mapboxgl.NavigationControl | null>(null)

  const [hovered,      setHovered]      = useState<HoverState | null>(null)
  const [pinnedHover,  setPinnedHover]  = useState<HoverState | null>(null)
  const hideTimer            = useRef<ReturnType<typeof setTimeout> | null>(null)
  // クリック直後のアイコン差し替えによる mouseover 再発火を抑制するタイムスタンプ
  const suppressHoverUntil  = useRef(0)

  // OGP キャッシュ: ref で二重fetch防止、state で再レンダートリガー
  const ogpCacheRef = useRef<Record<string, OgpEntry>>({})
  const [ogpCache, setOgpCache] = useState<Record<string, string | null>>({})

  const clearHide = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHide()
    hideTimer.current = setTimeout(() => setHovered(null), 200)
  }, [clearHide])

  const fetchOgp = useCallback(async (spotId: string, url: string) => {
    if (spotId in ogpCacheRef.current) return
    ogpCacheRef.current[spotId] = 'loading'
    try {
      const res  = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      const img  = (data.imageUrl as string | null) ?? null
      ogpCacheRef.current[spotId] = img
      setOgpCache(c => ({ ...c, [spotId]: img }))
    } catch {
      ogpCacheRef.current[spotId] = null
      setOgpCache(c => ({ ...c, [spotId]: null }))
    }
  }, [])

  const handlePinnedHoverChange = useCallback((hover: HoverState | null) => {
    setPinnedHover(hover)
    if (hover?.spot.url && !hover.spot.imageUrl) fetchOgp(hover.spot.id, hover.spot.url)
  }, [fetchOgp])

  const handleHoverIn = useCallback((spot: Spot, x: number, y: number) => {
    if (Date.now() < suppressHoverUntil.current) return
    clearHide()
    setHovered({ spot, x, y })
    if (spot.url && !spot.imageUrl) fetchOgp(spot.id, spot.url)
  }, [clearHide, fetchOgp])

  const handleImmediateHide = useCallback(() => {
    clearHide()
    setHovered(null)
  }, [clearHide])

  const handlePinClick = useCallback((spot: Spot) => {
    suppressHoverUntil.current = Date.now() + 500
    handleImmediateHide()
    onDetailOpen(spot)
  }, [handleImmediateHide, onDetailOpen])

  // 抑制ウィンドウ内はカード側の onMouseEnter による clearHide もブロックする
  const handleCardMouseEnter = useCallback(() => {
    if (Date.now() < suppressHoverUntil.current) return
    clearHide()
  }, [clearHide])

  const handleMapClick = useCallback(() => {
    onDetailClose()
    if (isMobile) onSpotSelect(null)
    handleImmediateHide()
  }, [onDetailClose, isMobile, onSpotSelect, handleImmediateHide])

  // マーカーのDOMイベントハンドラ・地図イベントハンドラから常に最新のコールバック・spotを参照するためのref
  const handlersRef = useRef({ handleHoverIn, scheduleHide, handlePinClick, handleMapClick, handleImmediateHide })
  useEffect(() => {
    handlersRef.current = { handleHoverIn, scheduleHide, handlePinClick, handleMapClick, handleImmediateHide }
  })
  const spotsByIdRef = useRef<Record<string, Spot>>({})
  useEffect(() => {
    spotsByIdRef.current = Object.fromEntries(spots.map(s => [s.id, s]))
  }, [spots])

  const icons = useMemo(() => {
    const result: Record<string, IconDef> = {}
    for (const s of spots) {
      result[s.id] = buildIconDef(s, s.id === selectedSpot?.id, isMobile)
    }
    return result
  }, [spots, selectedSpot, isMobile])

  // ─── 地図の初期化 ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: toLngLat(OTA_CENTER[0], OTA_CENTER[1]),
      zoom: 12,
    })
    mapRef.current = map

    map.on('load', () => {
      setMapLanguage(map)

      map.addSource('user-radius', { type: 'geojson', data: EMPTY_FC })
      map.addLayer({
        id: 'user-radius-fill', type: 'fill', source: 'user-radius',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.09 },
      })
      map.addLayer({
        id: 'user-radius-outline', type: 'line', source: 'user-radius',
        paint: { 'line-color': '#3b82f6', 'line-width': 1.2, 'line-opacity': 0.7 },
      })

      setMapReady(true)
    })

    map.on('movestart', () => handlersRef.current.handleImmediateHide())
    map.on('zoomstart', () => handlersRef.current.handleImmediateHide())
    map.on('click', () => handlersRef.current.handleMapClick())

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current = {}
      userMarkerRef.current = null
      navControlRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── ズームコントロール（PCのみ、右上） ───────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (!isMobile && !navControlRef.current) {
      const ctrl = new mapboxgl.NavigationControl({ showCompass: false })
      map.addControl(ctrl, 'top-right')
      navControlRef.current = ctrl
    } else if (isMobile && navControlRef.current) {
      map.removeControl(navControlRef.current)
      navControlRef.current = null
    }
  }, [isMobile, mapReady])

  // ─── ピンマーカー同期 ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const currentIds = new Set(spots.map(s => s.id))
    for (const id of Object.keys(markersRef.current)) {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    }

    for (const spot of spots) {
      const iconDef = icons[spot.id]
      let marker = markersRef.current[spot.id]
      if (!marker) {
        const el = document.createElement('div')
        el.style.cursor = 'pointer'
        el.addEventListener('mouseenter', () => {
          const cur = spotsByIdRef.current[spot.id]
          const m = mapRef.current
          if (!cur || !m) return
          const pt = m.project(toLngLat(cur.lat, cur.lng))
          handlersRef.current.handleHoverIn(cur, pt.x, pt.y)
        })
        el.addEventListener('mouseleave', () => handlersRef.current.scheduleHide())
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          const cur = spotsByIdRef.current[spot.id]
          if (cur) handlersRef.current.handlePinClick(cur)
        })
        marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(toLngLat(spot.lat, spot.lng))
          .addTo(map)
        markersRef.current[spot.id] = marker
      }
      const el = marker.getElement()
      el.innerHTML  = iconDef.html
      el.style.width  = `${iconDef.hit}px`
      el.style.height = `${iconDef.hit}px`
      el.style.zIndex = spot.id === selectedSpot?.id ? '1000' : '0'
    }
  }, [spots, icons, selectedSpot?.id, mapReady])

  // ─── 現在地マーカー・円表示 ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const source = map.getSource('user-radius') as mapboxgl.GeoJSONSource | undefined

    if (!userLocation) {
      source?.setData(EMPTY_FC)
      userMarkerRef.current?.remove()
      userMarkerRef.current = null
      return
    }

    const [lat, lng] = userLocation
    source?.setData(createGeoCircle(lat, lng, locationRadius * 1000))

    if (!userMarkerRef.current) {
      userMarkerRef.current = new mapboxgl.Marker({ element: buildUserLocationElement(), anchor: 'center' })
        .setLngLat(toLngLat(lat, lng))
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat(toLngLat(lat, lng))
    }
  }, [userLocation, locationRadius, mapReady])

  // ─── FlyToLocation相当 ───────────────────────────────────────
  const prevLocationRef  = useRef<[number, number] | null>(null)
  const sheetStateRef    = useRef<SheetState>(sheetState)
  useEffect(() => { sheetStateRef.current = sheetState }, [sheetState])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !userLocation) return

    const bounds = boundsFromCenterRadius(userLocation[0], userLocation[1], locationRadius * 1000 * 2)
    const prev = prevLocationRef.current
    const locationChanged = prev?.[0] !== userLocation[0] || prev?.[1] !== userLocation[1]
    prevLocationRef.current = userLocation

    let padding: mapboxgl.PaddingOptions
    if (isMobile) {
      const s = sheetStateRef.current
      const bottomPad =
        s === 'mid'  ? map.getContainer().clientHeight / 2 :
        s === 'full' ? map.getContainer().clientHeight * 0.85 :
        PEEK_HEIGHT
      padding = { top: 12, left: 12, bottom: bottomPad, right: 12 }
    } else {
      padding = { top: 12, left: 12, bottom: 12, right: 12 }
    }

    if (locationChanged) {
      map.fitBounds(bounds, { padding, animate: false })
    } else {
      map.fitBounds(bounds, { padding, animate: true, duration: 300 })
    }
  }, [userLocation, locationRadius, isMobile, mapReady])

  // ─── RecenterToOta相当 ───────────────────────────────────────
  const isFirstRecenter = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (isFirstRecenter.current) { isFirstRecenter.current = false; return }
    map.jumpTo({ center: toLngLat(OTA_CENTER[0], OTA_CENTER[1]), zoom: 12 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal, mapReady])

  // ─── MapResizer相当 ──────────────────────────────────────────
  const isFirstResize = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    if (isFirstResize.current) { isFirstResize.current = false; return }
    map.resize()
  }, [detailPanelOpen, mapReady])

  // ─── SelectedSpotTracker相当 ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const updatePosition = () => {
      if (!selectedSpot) { handlePinnedHoverChange(null); return }
      const pt = map.project(toLngLat(selectedSpot.lat, selectedSpot.lng))
      handlePinnedHoverChange({ spot: selectedSpot, x: pt.x, y: pt.y })
    }

    if (!selectedSpot) {
      handlePinnedHoverChange(null)
    } else {
      const lngLat = toLngLat(selectedSpot.lat, selectedSpot.lng)

      if (isMobile) {
        // ボトムシート（50vh）上の可視エリア中央にピンを配置する
        const zoom = map.getZoom()
        const spotPx = map.project(lngLat)
        const containerH = map.getContainer().clientHeight
        const center = map.unproject([spotPx.x, spotPx.y + containerH / 4])
        map.panTo(center, { animate: true, duration: 500 })
      } else {
        // PC: 範囲内でパネルに隠れる場合・範囲外の場合ともにオフセット付き panTo
        const inBounds = map.getBounds()?.contains(lngLat) ?? false
        const pt = inBounds ? map.project(lngLat) : null
        const hiddenByPanel = detailPanelOpen && (pt === null || pt.x < DETAIL_PANEL_W)

        if (!inBounds || hiddenByPanel) {
          const spotPx = map.project(lngLat)
          const offsetX = detailPanelOpen ? DETAIL_PANEL_W / 2 : 0
          const center = map.unproject([spotPx.x - offsetX, spotPx.y])
          map.panTo(center, { animate: true, duration: 500 })
        } else {
          updatePosition()
        }
      }
    }

    const onMoveStart = () => handlePinnedHoverChange(null)
    map.on('moveend', updatePosition)
    map.on('zoomend', updatePosition)
    map.on('movestart', onMoveStart)
    map.on('zoomstart', onMoveStart)
    return () => {
      map.off('moveend', updatePosition)
      map.off('zoomend', updatePosition)
      map.off('movestart', onMoveStart)
      map.off('zoomstart', onMoveStart)
    }
  }, [selectedSpot, isMobile, detailPanelOpen, mapReady, handlePinnedHoverChange])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {/* モバイルはホバーカード不要。PC: hovered は常に表示、pinnedHover は詳細パネルが閉じている時のみ */}
      {(() => {
        const activeHover = isMobile ? null : (hovered ?? (detailPanelOpen ? null : pinnedHover))
        if (!activeHover) return null
        return (
          <HoverCard
            key={activeHover.spot.id}
            hovered={activeHover}
            wrapperRef={wrapperRef}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={scheduleHide}
            ogpImage={ogpCache[activeHover.spot.id] ?? undefined}
            onDetailOpen={onDetailOpen}
          />
        )
      })()}
    </div>
  )
}
