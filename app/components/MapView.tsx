'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'
import { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react'
import { getCategoryIconSrc, getVisualCategory, BADGE_BG_COLOR, type AllCategory, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, parseLocalDate, STATUS_CONFIG, PARK_STATUS, fmtTimeRange } from '@/lib/date-utils'
import { type SheetState } from './BottomSheet'
import { type PinGroup } from './MapApp'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

// ─── Types ───────────────────────────────────────────────────────
type Props = {
  spots: Spot[]
  pinGroups: PinGroup[]
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
  onMapTapClose?: () => void
  onZoomChange?: (zoom: number) => void
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

/** 道路番号シールド（国道・県道の番号アイコン）レイヤーを非表示にする */
function hideRoadShields(map: mapboxgl.Map) {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.id.includes('shield') || layer.id.includes('road-number')) {
      map.setLayoutProperty(layer.id, 'visibility', 'none')
    }
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
function pickIcon(category: AllCategory): { src: string; bg: string; glow: string; ratio: number } {
  const lanternGlow = 'filter:drop-shadow(0 0 1.5px rgba(255,255,255,1)) drop-shadow(0 0 1.5px rgba(255,255,255,1));'
  const src = getCategoryIconSrc(category) ?? ''
  if (category === 'fireworks') return { src, bg: '#0a0a3c', glow: '', ratio: 1.6 }
  if (category === 'festival')  return { src, bg: '#1e1614', glow: lanternGlow, ratio: 0.63 }
  if (category === 'event' || category === 'event_plus') return { src, bg: 'transparent', glow: '', ratio: 1 }
  if (category === 'park')      return { src, bg: 'transparent', glow: '', ratio: 1 }
  if (category === 'kumamoto_earthquake_r8') return { src, bg: 'white', glow: '', ratio: 1.05 }
  return { src, bg: 'white', glow: '', ratio: 0.78 }
}

type IconDef = { html: string; hit: number; iconSize: number; anchor?: 'center' }

function buildIconDef(spot: Spot, selected: boolean, isMobile: boolean): IconDef {
  const isActive = getEventStatus(spot.startDate, spot.endDate) === 'active'
  const wrapperCls = isActive ? ' class="pin-vibrate"' : ''
  const visualCategory = getVisualCategory(spot)

  if (visualCategory === 'event' || visualCategory === 'park') {
    const { src: icon } = pickIcon(visualCategory)
    const hit  = selected ? 48 : (isMobile ? 48 : 40)
    const size = selected ? 44 : 36
    const cls  = selected ? ' class="pin-selected"' : ''
    return {
      hit,
      iconSize: size,
      anchor: 'center',
      html: `<div${wrapperCls} style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><img${cls} src="${icon}" style="width:${size}px;height:${size}px;object-fit:contain;display:block;"></div>`,
    }
  }

  const { src: icon, bg, glow, ratio } = pickIcon(visualCategory)
  const borderColor = '#9ca3af'
  const useGradientBorder = visualCategory === 'fireworks' || visualCategory === 'festival' || visualCategory === 'kumamoto_earthquake_r8'
  const gradientBorder = 'conic-gradient(from 0deg, #ffd600 0deg, #ffd600 60deg, #ff8a00 120deg, #ea4335 200deg, #bc2a8d 280deg, #ffd600 360deg)'
  const gradientBorderWidth = 2.5 * 0.7

  if (selected) {
    const hit  = 48
    const size = 44
    const img  = Math.round(size * ratio)
    const inner = size - gradientBorderWidth * 2
    const circle = useGradientBorder
      ? `<div class="pin-selected" style="width:${size}px;height:${size}px;border-radius:50%;background:${gradientBorder};box-shadow:0 4px 12px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;"><div style="width:${inner}px;height:${inner}px;margin:${gradientBorderWidth}px;border-radius:50%;background:${bg};overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`
      : `<div class="pin-selected" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid ${borderColor};box-shadow:0 4px 12px rgba(0,0,0,.4);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div>`
    return {
      hit,
      iconSize: size,
      html: `<div${wrapperCls} style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;">${circle}</div>`,
    }
  }

  const hit  = isMobile ? 48 : 40
  const size = 36
  const img  = Math.round(size * ratio)
  const inner = size - gradientBorderWidth * 2
  const circle = useGradientBorder
    ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${gradientBorder};box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;"><div style="width:${inner}px;height:${inner}px;margin:${gradientBorderWidth}px;border-radius:50%;background:${bg};overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,.25);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div>`
  return {
    hit,
    iconSize: size,
    html: `<div${wrapperCls} style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;">${circle}</div>`,
  }
}

/** 地図ピンと同じビジュアルの20x20小型アイコンHTML（選択状態は反映しない）。吹き出しリストの行アイコンに使う */
function buildSmallIconHtml(spot: Spot): string {
  const SIZE = 20
  const visualCategory = getVisualCategory(spot)

  if (visualCategory === 'event' || visualCategory === 'park') {
    const { src: icon } = pickIcon(visualCategory)
    return `<img src="${icon}" style="width:${SIZE}px;height:${SIZE}px;object-fit:contain;display:block;">`
  }

  const { src: icon, bg, glow, ratio } = pickIcon(visualCategory)
  const borderColor = '#9ca3af'
  const useGradientBorder = visualCategory === 'fireworks' || visualCategory === 'festival' || visualCategory === 'kumamoto_earthquake_r8'
  const gradientBorder = 'conic-gradient(from 0deg, #ffd600 0deg, #ffd600 60deg, #ff8a00 120deg, #ea4335 200deg, #bc2a8d 280deg, #ffd600 360deg)'
  const borderWidth = 1.2
  const img = Math.round(SIZE * ratio)
  const inner = SIZE - borderWidth * 2

  return useGradientBorder
    ? `<div style="width:${SIZE}px;height:${SIZE}px;border-radius:50%;background:${gradientBorder};display:flex;align-items:center;justify-content:center;"><div style="width:${inner}px;height:${inner}px;margin:${borderWidth}px;border-radius:50%;background:${bg};overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`
    : `<div style="width:${SIZE}px;height:${SIZE}px;border-radius:50%;background:${bg};border:1px solid ${borderColor};overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div>`
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
  galleryImage: string | null | undefined
  onDetailOpen: (spot: Spot) => void
}

function HoverCard({ hovered, wrapperRef, onMouseEnter, onMouseLeave, galleryImage, onDetailOpen }: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const aboveGap = GAP

  const imageSrc = galleryImage || hovered.spot.imageUrl || null
  const [imageLoadFailed, setImageLoadFailed] = useState(false)
  useEffect(() => {
    setImageLoadFailed(false)
  }, [imageSrc])

  // ready:false で初期化 → 測定前は opacity:0 で非表示
  const [pos, setPos] = useState<Pos>({
    left:  hovered.x,
    top:   hovered.y - aboveGap,
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
    // 「ピン中心 y から上に aboveGap 離れた位置にカード下端」を基準に空間を確認
    const above = cardH <= y - aboveGap

    let top: number
    if (above) {
      // transform: translateY(-100%) でカード下端が top に来る
      top = y - aboveGap
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
  const isPark    = spot.category === 'park'
  const status    = getEventStatus(spot.startDate, spot.endDate)
  const dateRange = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
  const timeRange = fmtTimeRange(spot.startTime, spot.endTime)
  const statusCfg = isPark ? { ...PARK_STATUS, label: spot.spotLabel || PARK_STATUS.label } : (status ? STATUS_CONFIG[status] : null)
  const showStatus = isPark || status === 'ended'

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
        paddingBottom: pos.above ? aboveGap : 0,
        paddingTop:    pos.above ? 0 : GAP,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* ── カード本体 ── */}
      <div
        style={{
          borderRadius: 8,
          overflow:     'hidden',
          background:   'white',
          boxShadow:    '0 2px 4px rgba(0,0,0,.10), 0 8px 24px rgba(0,0,0,.12)',
          cursor:       'pointer',
        }}
        onClick={() => onDetailOpen(spot)}
      >
        {/* 画像（全体の約55%） */}
        {imageSrc && !imageLoadFailed ? (
          <img
            src={imageSrc}
            alt=""
            style={{ display: 'block', width: '100%', height: 100, objectFit: 'contain', backgroundColor: '#f3f4f6' }}
            onError={() => setImageLoadFailed(true)}
          />
        ) : (
          <div style={{
            width: '100%', height: 100, backgroundColor: '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, color: '#6b7280' }}>画像なし</span>
          </div>
        )}

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
            {statusCfg && showStatus && (
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
            {isPark ? (
              <p style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, margin: '0 0 2px', color: '#6b7280',
                overflow: 'hidden',
              }}>
                <span style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  background: BADGE_BG_COLOR, color: '#374151', fontSize: 10, fontWeight: 400,
                }}>
                  営業時間
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {spot.businessHours || '未登録'}
                </span>
              </p>
            ) : (
              dateRange && (
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
                    {dateRange}{timeRange ? ` ${timeRange}` : ''}
                  </span>
                </p>
              )
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

// ─── GroupBubble（座標一致ピンの吹き出しリスト） ──────────────────
/** 吹き出しの幅 */
const BUBBLE_W = 240
/** ピン中心から吹き出し端までのギャップ（グループピン通常サイズ40pxの半径20pxに被らないよう近づける） */
const BUBBLE_GAP = 22

type GroupBubbleProps = {
  group:          PinGroup
  x:              number
  y:              number
  wrapperRef:     React.RefObject<HTMLDivElement | null>
  selectedSpotId?: string
  onSelectSpot:   (spot: Spot) => void
  onMouseEnter?:  () => void
  onMouseLeave?:  () => void
  isMobile:       boolean
  isSingle?:      boolean
}

function GroupBubble({ group, x, y, wrapperRef, selectedSpotId, onSelectSpot, onMouseEnter, onMouseLeave, isMobile, isSingle }: GroupBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const aboveGap = BUBBLE_GAP

  const [pos, setPos] = useState<Pos>({ left: x, top: y, above: true, ready: false, cardH: 0 })

  useLayoutEffect(() => {
    const bubble  = bubbleRef.current
    const wrapper = wrapperRef.current
    if (!bubble || !wrapper) return

    const cW    = wrapper.offsetWidth
    const cH    = wrapper.offsetHeight
    const cardH = bubble.offsetHeight

    const above = cardH <= y - aboveGap
    // 外側divの上端/下端はピン中心(y)に固定し、padding分（BUBBLE_GAP）でカードとの隙間を作る。
    // padding領域もdivのボックスに含まれるため、ピン⇔カード間のホバー判定が連続する。
    let top = y
    if (!above && top + BUBBLE_GAP + cardH > cH - MARGIN) top = cH - MARGIN - cardH - BUBBLE_GAP

    const halfW = BUBBLE_W / 2
    let left = x
    if (left - halfW < MARGIN)      left = halfW + MARGIN
    if (left + halfW > cW - MARGIN) left = cW - MARGIN - halfW

    setPos({ left, top, above, ready: true, cardH })
  }, [group, x, y, wrapperRef, aboveGap])

  return (
    <div
      style={{
        position:      'absolute',
        left:          pos.left,
        top:           pos.top,
        transform:     `translate(-50%, ${pos.above ? '-100%' : '0%'})`,
        opacity:       pos.ready ? 1 : 0,
        width:         BUBBLE_W,
        zIndex:        1000,
        pointerEvents: isSingle ? 'none' : 'all',
        // padding領域がピンとカードの間の隙間を埋め、ホバー判定を連続させる（絶対配置のブリッジ要素は使わない）
        paddingBottom: pos.above ? BUBBLE_GAP : 0,
        paddingTop:    pos.above ? 0 : BUBBLE_GAP,
      }}
      onClick={isSingle ? undefined : (e => e.stopPropagation())}
      onMouseEnter={isMobile ? undefined : onMouseEnter}
      onMouseLeave={isMobile ? undefined : onMouseLeave}
    >
      <style>{`
        .group-bubble-arrow-down::after,
        .group-bubble-arrow-up::after {
          content: '';
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
        }
        .group-bubble-arrow-down::after { bottom: -6px; border-top: 6px solid white; }
        .group-bubble-arrow-up::after   { top: -6px;    border-bottom: 6px solid white; }
      `}</style>
      <div
        ref={bubbleRef}
        className={pos.above ? 'group-bubble-arrow-down' : 'group-bubble-arrow-up'}
        style={{
          position:     'relative',
          borderRadius: 8,
          overflow:     'hidden',
          background:   'white',
          boxShadow:    '0 2px 8px rgba(0,0,0,0.15)',
          pointerEvents: 'all',
        }}
      >
        {(() => {
          // spots を eventId（無ければ id）でグルーピング。出現順を維持。
          const eventGroups: { key: string; spots: Spot[] }[] = []
          const indexByKey = new Map<string, number>()
          for (const spot of group.spots) {
            const key = spot.eventId ?? spot.id
            const idx = indexByKey.get(key)
            if (idx === undefined) {
              indexByKey.set(key, eventGroups.length)
              eventGroups.push({ key, spots: [spot] })
            } else {
              eventGroups[idx].spots.push(spot)
            }
          }

          return eventGroups.map((eg, groupIndex) => {
            const borderStyle = groupIndex > 0 ? { borderTop: '1px solid #e5e7eb' } : {}

            if (eg.spots.length === 1) {
              const spot = eg.spots[0]
              const selected = spot.id === selectedSpotId
              const dateDisplay = spot.type === 'permanent' ? '' : getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
              const timeDisplay = spot.type === 'permanent' ? '' : fmtTimeRange(spot.startTime, spot.endTime)
              return (
                <div
                  key={spot.id}
                  onClick={() => onSelectSpot(spot)}
                  style={{
                    display:    'flex',
                    alignItems: 'flex-start',
                    gap:        6,
                    padding:    '11px 12px',
                    cursor:     'pointer',
                    background: selected ? '#eff6ff' : 'transparent',
                    ...borderStyle,
                  }}
                >
                  <span
                    style={{ width: 20, height: 20, display: 'inline-flex', flexShrink: 0, marginTop: 2 }}
                    dangerouslySetInnerHTML={{ __html: buildSmallIconHtml(spot) }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {spot.name}
                    </span>
                    {dateDisplay && (
                      <span style={{
                        display: 'block', fontSize: 12, color: '#374151',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {dateDisplay}{timeDisplay ? ` ${timeDisplay}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            }

            const headSpot = eg.spots[0]
            return (
              <div key={eg.key} style={borderStyle}>
                <div
                  style={{
                    display:    'flex',
                    alignItems: 'flex-start',
                    gap:        6,
                    padding:    '11px 12px',
                    cursor:     'default',
                    background: '#f3f4f6',
                  }}
                >
                  <span
                    style={{ width: 20, height: 20, display: 'inline-flex', flexShrink: 0, marginTop: 2 }}
                    dangerouslySetInnerHTML={{ __html: buildSmallIconHtml(headSpot) }}
                  />
                  <span style={{
                    display: 'block', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                  }}>
                    {headSpot.name}
                  </span>
                </div>
                {eg.spots.map(spot => {
                  const selected = spot.id === selectedSpotId
                  const dateDisplay = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate, spot.specificDates)
                  const timeDisplay = fmtTimeRange(spot.startTime, spot.endTime)
                  return (
                    <div
                      key={spot.id}
                      onClick={() => onSelectSpot(spot)}
                      style={{
                        padding:    '6px 12px 6px 16px',
                        cursor:     'pointer',
                        background: selected ? '#eff6ff' : 'transparent',
                        fontSize:   12,
                        color:      '#374151',
                        overflow:   'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        borderTop:  '1px solid #e5e7eb',
                      }}
                    >
                      <span style={{ fontSize: 6, verticalAlign: 'middle', color: '#9ca3af' }}>●</span>{'  '}{dateDisplay}{timeDisplay ? ` ${timeDisplay}` : ''}
                    </div>
                  )
                })}
              </div>
            )
          })
        })()}
      </div>
    </div>
  )
}

const PEEK_HEIGHT = 72

/** モバイル地図タップ判定：この距離を超えた移動はドラッグとみなす（px） */
const TAP_MAX_DISTANCE = 10
/** モバイル地図タップ判定：この時間を超えた接触はタップとみなさない（ms） */
const TAP_MAX_DURATION = 300

// ─── MapView（メインコンポーネント） ─────────────────────────────
export default function MapView({ spots, pinGroups, onSpotSelect, selectedSpot, userLocation = null, locationRadius = 60, recenterSignal = 0, onDetailOpen, onDetailClose, detailPanelOpen, isMobile = false, sheetState = 'closed', onMapTapClose, onZoomChange }: Props) {
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
  // グループピン吹き出しリスト（2件以上）をPCホバーで開閉する際の遅延クローズ用タイマー
  const groupHideTimer       = useRef<ReturnType<typeof setTimeout> | null>(null)
  // カーソルが吹き出し（GroupBubble）に乗っているか。地図mousemoveでの自動クローズ判定に使う
  const isOverBubbleRef      = useRef(false)

  // グループピンの吹き出しリスト（2件以上の PinGroup をタップした時に開く）
  const [openGroupId,     setOpenGroupId]     = useState<string | null>(null)
  const [bubbleScreenPos, setBubbleScreenPos] = useState<{ x: number; y: number } | null>(null)
  const pinGroupsByRepIdRef = useRef<Record<string, PinGroup>>({})
  useEffect(() => {
    pinGroupsByRepIdRef.current = Object.fromEntries(pinGroups.map(g => [g.representativeId, g]))
  }, [pinGroups])

  // クリック直後のアイコン差し替えによる mouseover 再発火を抑制するタイムスタンプ
  const suppressHoverUntil  = useRef(0)

  // event_images 1枚目キャッシュ: ref で二重fetch防止、state で再レンダートリガー
  const galleryCacheRef = useRef<Record<string, OgpEntry>>({})
  const [galleryCache, setGalleryCache] = useState<Record<string, string | null>>({})

  const clearHide = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHide()
    hideTimer.current = setTimeout(() => setHovered(null), 200)
  }, [clearHide])

  const clearGroupHide = useCallback(() => {
    if (groupHideTimer.current) { clearTimeout(groupHideTimer.current); groupHideTimer.current = null }
  }, [])

  const scheduleGroupHide = useCallback(() => {
    clearGroupHide()
    groupHideTimer.current = setTimeout(() => setOpenGroupId(null), 200)
  }, [clearGroupHide])

  const handleBubbleMouseEnter = useCallback(() => {
    isOverBubbleRef.current = true
    clearGroupHide()
  }, [clearGroupHide])

  const handleBubbleMouseLeave = useCallback(() => {
    isOverBubbleRef.current = false
    scheduleGroupHide()
  }, [scheduleGroupHide])

  const fetchGalleryFirst = useCallback(async (spotId: string) => {
    if (spotId in galleryCacheRef.current) return
    galleryCacheRef.current[spotId] = 'loading'
    try {
      const res  = await fetch(`/api/events/${spotId}/images`)
      const data = await res.json()
      const img  = (data.images?.[0]?.imageUrl as string | undefined) ?? null
      galleryCacheRef.current[spotId] = img
      setGalleryCache(c => ({ ...c, [spotId]: img }))
    } catch {
      galleryCacheRef.current[spotId] = null
      setGalleryCache(c => ({ ...c, [spotId]: null }))
    }
  }, [])

  const handlePinnedHoverChange = useCallback((hover: HoverState | null) => {
    setPinnedHover(hover)
    if (hover) {
      const eventId = hover.spot.eventId ?? hover.spot.id
      fetchGalleryFirst(eventId)
    }
  }, [fetchGalleryFirst])

  const handleHoverIn = useCallback((spot: Spot, x: number, y: number) => {
    if (Date.now() < suppressHoverUntil.current) return
    clearHide()
    setHovered({ spot, x, y })
    const eventId = spot.eventId ?? spot.id
    fetchGalleryFirst(eventId)
  }, [clearHide, fetchGalleryFirst])

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
    setOpenGroupId(null)
  }, [onDetailClose, isMobile, onSpotSelect, handleImmediateHide])

  // グループピン（座標一致で束ねたピン）タップ時：2件以上なら吹き出しリストのみ開き選択は解除、1件なら従来通り選択・詳細を開く
  const handleGroupPinClick = useCallback((repId: string) => {
    const group = pinGroupsByRepIdRef.current[repId]
    if (!group || group.spots.length === 0) return
    if (group.spots.length > 1) {
      onDetailClose()
      if (isMobile) onSpotSelect(null)
      setOpenGroupId(repId)
      return
    }
    handlePinClick(group.spots[0])
  }, [handlePinClick, onDetailClose, isMobile, onSpotSelect])

  // マーカーのDOMイベントハンドラ・地図イベントハンドラから常に最新のコールバック・spotを参照するためのref
  const handlersRef = useRef({ handleHoverIn, scheduleHide, clearGroupHide, scheduleGroupHide, handlePinClick, handleGroupPinClick, handleMapClick, handleImmediateHide, isMobile, onMapTapClose, onZoomChange })
  useEffect(() => {
    handlersRef.current = { handleHoverIn, scheduleHide, clearGroupHide, scheduleGroupHide, handlePinClick, handleGroupPinClick, handleMapClick, handleImmediateHide, isMobile, onMapTapClose, onZoomChange }
  })
  const selectedSpotRef = useRef<Spot | null>(selectedSpot)
  selectedSpotRef.current = selectedSpot
  const spotsByIdRef = useRef<Record<string, Spot>>({})
  useEffect(() => {
    spotsByIdRef.current = Object.fromEntries(spots.map(s => [s.id, s]))
  }, [spots])

  const icons = useMemo(() => {
    const result: Record<string, IconDef> = {}
    for (const g of pinGroups) {
      const activeSpot = g.spots.find(s => s.id === selectedSpot?.id) ?? g.spots[0]
      result[g.representativeId] = buildIconDef(activeSpot, activeSpot.id === selectedSpot?.id, isMobile)
    }
    return result
  }, [pinGroups, selectedSpot?.id, isMobile])

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

    map.on('style.load', () => hideRoadShields(map))

    map.on('load', () => {
      map.getCanvas().style.filter = 'saturate(0.5) brightness(1.05)'

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
      handlersRef.current.onZoomChange?.(map.getZoom())
    })

    map.on('movestart', () => handlersRef.current.handleImmediateHide())
    map.on('zoomstart', () => handlersRef.current.handleImmediateHide())
    map.on('zoomend', () => handlersRef.current.onZoomChange?.(map.getZoom()))
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

  // ─── ピンマーカー同期（PinGroup 単位：グループの代表spotのみマーカーを作る） ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const representativeIds = new Set(pinGroups.map(g => g.representativeId))
    for (const id of Object.keys(markersRef.current)) {
      if (!representativeIds.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    }

    for (const group of pinGroups) {
      const repId = group.representativeId
      const repSpot = group.spots[0]
      const iconDef = icons[repId]
      if (!iconDef) continue

      let marker = markersRef.current[repId]
      if (!marker) {
        const el = document.createElement('div')
        el.style.cursor = 'pointer'
        // el は mapbox-gl.css の .mapboxgl-marker クラスにより position:absolute が付与済みで、
        // バッジ（position:absolute）の配置起点として機能する。position を上書きすると
        // Marker の transform 位置合わせ（zoom/pan追従）が壊れるため、ここでは設定しない。
        el.addEventListener('mouseenter', () => {
          const g = pinGroupsByRepIdRef.current[repId]
          if (g && g.spots.length > 1) {
            if (handlersRef.current.isMobile) return
            handlersRef.current.clearGroupHide()
            setOpenGroupId(repId)
            return
          }
          const cur = g ? g.spots[0] : spotsByIdRef.current[repId]
          const m = mapRef.current
          if (!cur || !m) return
          const pt = m.project(toLngLat(cur.lat, cur.lng))
          handlersRef.current.handleHoverIn(cur, pt.x, pt.y)
        })
        el.addEventListener('mouseleave', () => {
          // 単独・グループともにBubble/Card側のonMouseLeaveで制御するため何もしない
        })
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          handlersRef.current.handleGroupPinClick(repId)
        })
        marker = new mapboxgl.Marker({ element: el, anchor: iconDef.anchor ?? 'center' })
          .setLngLat(toLngLat(group.lat, group.lng))
          .addTo(map)
        markersRef.current[repId] = marker
      } else {
        marker.setLngLat(toLngLat(group.lat, group.lng))
      }

      const el = marker.getElement()
      const badgeCount = group.spots.length - 1
      // アイコンはヒットエリア中央に配置されているため、ヒットエリアとアイコンの差の半分をオフセットとして
      // バッジをアイコンの右上外側に配置する
      const badgeOffset = (iconDef.hit - iconDef.iconSize) / 2 - 6
      const badgeHtml = badgeCount > 0
        ? `<span style="position:absolute;top:${badgeOffset}px;right:${badgeOffset}px;background:#6b7280;color:#ffffff;font-size:10px;width:16px;height:16px;line-height:16px;text-align:center;border-radius:50%;">+${badgeCount}</span>`
        : ''
      el.innerHTML  = iconDef.html + badgeHtml
      el.style.width  = `${iconDef.hit}px`
      el.style.height = `${iconDef.hit}px`

      const isGroupSelected = group.spots.some(s => s.id === selectedSpot?.id)
      const status = getEventStatus(repSpot.startDate, repSpot.endDate)
      el.style.zIndex =
        isGroupSelected ? '1000' :
        status === 'active' ? '500' :
        (status === 'upcoming' || status === 'scheduled') && repSpot.startDate ?
          String(Math.max(1, Math.min(499, 500 - Math.ceil((parseLocalDate(repSpot.startDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)))) :
        '0'
      // el（marker.getElement()）は Mapbox が map "move" イベントごとに
      // el.style.opacity を強制上書きするため、内側の描画用 div に設定する
      const opacity = selectedSpot && !isGroupSelected ? '0.6' : '1'
      const pinEl = el.firstElementChild as HTMLElement | null
      if (pinEl) pinEl.style.opacity = opacity
    }
  }, [pinGroups, icons, selectedSpot?.id, mapReady])

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

  // ─── モバイル: 地図タップでボトムシート(mid)を閉じる ───────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let tapStart: { x: number; y: number; time: number } | null = null

    const onTouchStart = (e: TouchEvent) => {
      if (!handlersRef.current.isMobile || e.touches.length !== 1) { tapStart = null; return }
      const target = e.target as Element | null
      // ピン（マーカー）上でのタップはピン側のクリック処理を優先し無視する
      if (target?.closest('.mapboxgl-marker')) { tapStart = null; return }
      const t = e.touches[0]
      tapStart = { x: t.clientX, y: t.clientY, time: Date.now() }
    }

    const onTouchEnd = (e: TouchEvent) => {
      const start = tapStart
      tapStart = null
      if (!start || !handlersRef.current.isMobile) return
      if (sheetStateRef.current !== 'mid') return
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      const elapsed = Date.now() - start.time
      // 座標差分・経過時間からドラッグ/ピンチ操作を除外し、純粋なタップのみ検知する
      if (Math.sqrt(dx * dx + dy * dy) < TAP_MAX_DISTANCE && elapsed < TAP_MAX_DURATION) {
        handlersRef.current.onMapTapClose?.()
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

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
        // iOSのURLバー等でビューポート高さが変わった直後でも、Mapbox内部の高さを
        // 実DOM高さに同期させてからoffsetを適用する（ピンが上下中央からずれる不具合対策）
        map.resize()
        const containerH = map.getContainer().clientHeight
        map.panTo(lngLat, { offset: [0, -containerH / 4.5], animate: true, duration: 500 })
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

  // ─── グループ吹き出しの画面座標追従（pan/zoom で再project） ──────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) { setBubbleScreenPos(null); return }

    const targetGroupId = openGroupId
      ?? pinGroups.find(g => g.spots.some(s => s.id === selectedSpot?.id) && g.spots.length >= 2)?.representativeId
      ?? null

    if (!targetGroupId) { setBubbleScreenPos(null); return }

    const update = () => {
      const g = pinGroupsByRepIdRef.current[targetGroupId]
      if (!g) { setBubbleScreenPos(null); return }
      const pt = map.project(toLngLat(g.lat, g.lng))
      setBubbleScreenPos({ x: pt.x, y: pt.y })
    }
    update()
    map.on('move', update)
    return () => { map.off('move', update) }
  }, [openGroupId, selectedSpot, pinGroups, mapReady])

  // ─── グループ吹き出し：PCでカーソルがピンにも吹き出しにも乗っていなければ閉じる ──
  // マーカーの mouseleave では閉じない（吹き出しがピンに重なりチャタリングするため）。
  // 地図全体の mousemove でピン近傍・吹き出し上のどちらでもないことを検出してクローズする。
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || isMobile || !openGroupId) return

    const PIN_HOVER_RADIUS = 28
    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const g = pinGroupsByRepIdRef.current[openGroupId]
      if (!g) return
      const pinPt = map.project(toLngLat(g.lat, g.lng))
      const overPin = Math.hypot(e.point.x - pinPt.x, e.point.y - pinPt.y) <= PIN_HOVER_RADIUS
      const sel = selectedSpotRef.current
      const groupHasSelected = sel ? g.spots.some(s => s.id === sel.id) : false
      if (!overPin && !isOverBubbleRef.current && !groupHasSelected) setOpenGroupId(null)
    }
    map.on('mousemove', onMouseMove)
    return () => { map.off('mousemove', onMouseMove) }
  }, [openGroupId, isMobile, mapReady])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

      {/* モバイルはホバーカード不要。PC: hovered は常に表示、pinnedHover は詳細パネルが閉じている時のみ。吹き出しリスト表示中は抑制 */}
      {(() => {
        const activeHover = isMobile || openGroupId ? null : (hovered ?? pinnedHover)
        if (!activeHover) return null
        const singleGroup: PinGroup = {
          representativeId: activeHover.spot.id,
          spots: [activeHover.spot],
          lat: activeHover.spot.lat,
          lng: activeHover.spot.lng,
        }
        return (
          <GroupBubble
            key={activeHover.spot.id}
            group={singleGroup}
            x={activeHover.x}
            y={activeHover.y}
            wrapperRef={wrapperRef}
            selectedSpotId={selectedSpot?.id}
            onSelectSpot={(spot) => onDetailOpen(spot)}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={scheduleHide}
            isMobile={isMobile}
            isSingle={true}
          />
        )
      })()}

      {/* グループピンの吹き出しリスト */}
      {(() => {
        // selectedSpotが含まれるグループは openGroupId が消えても表示維持
        const activeGroupId = openGroupId
          ?? pinGroups.find(g => g.spots.some(s => s.id === selectedSpot?.id) && g.spots.length >= 2)?.representativeId
          ?? null
        if (!activeGroupId || !bubbleScreenPos) return null
        const group = pinGroups.find(g => g.representativeId === activeGroupId)
        if (!group || group.spots.length < 2) return null
        return (
          <GroupBubble
            key={openGroupId}
            group={group}
            x={bubbleScreenPos.x}
            y={bubbleScreenPos.y}
            wrapperRef={wrapperRef}
            selectedSpotId={selectedSpot?.id}
            onSelectSpot={handlePinClick}
            onMouseEnter={handleBubbleMouseEnter}
            onMouseLeave={handleBubbleMouseLeave}
            isMobile={isMobile}
          />
        )
      })()}
    </div>
  )
}
