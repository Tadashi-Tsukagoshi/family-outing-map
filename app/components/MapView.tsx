'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import { CATEGORY_COLORS, ICON_PATHS } from '@/lib/spots'
import type { Category, Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, STATUS_CONFIG } from '@/lib/date-utils'

// ─── Types ───────────────────────────────────────────────────────
type Props = {
  spots: Spot[]
  onSpotSelect: (spot: Spot | null) => void
  selectedSpot: Spot | null
  userLocation?: [number, number] | null
  locationRadius?: number
  onDetailOpen: (spot: Spot) => void
  onDetailClose: () => void
  detailPanelOpen: boolean
  isMobile?: boolean
}

type HoverState = { spot: Spot; x: number; y: number }

/** string=取得済み, null=取得済み(画像なし), 'loading'=取得中 */
type OgpEntry = string | null | 'loading'

// ─── Constants ───────────────────────────────────────────────────
const OTA_CENTER: [number, number] = [36.2913, 139.3758]

/** カード幅（固定） */
const CARD_W   = 260
/** ピン中心からカード端までのギャップ（最大ピン半径 22px + 余白 4px） */
const GAP      = 14
/** コンテナ端の最小余白 */
const MARGIN   = 8

// ─── Unsplash images ─────────────────────────────────────────────
const CATEGORY_IMAGES: Record<Category, string> = {
  park:       'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=200',
  museum:     'https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=200',
  playground: 'https://images.unsplash.com/photo-1576398289164-c48dc021b4e1?w=200',
  food:       'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200',
  event:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
}

// ─── User location icon ──────────────────────────────────────────
const USER_LOCATION_ICON = L.divIcon({
  className: '',
  html: `
    <style>
      @keyframes sonar-ring {
        0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.5; }
        100% { transform: translate(-50%,-50%) scale(4); opacity: 0; }
      }
    </style>
    <div style="position:relative;width:24px;height:24px;">
      <div style="position:absolute;top:50%;left:50%;width:18px;height:18px;border-radius:50%;background:#3b82f6;animation:sonar-ring 3s ease-out infinite;"></div>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:15px;height:15px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 4px rgba(37,99,235,.7);"></div>
    </div>`,
  iconSize:   [24, 24],
  iconAnchor: [12, 12],
})

// ─── Helpers ─────────────────────────────────────────────────────
function buildDivIcon(category: Category, selected: boolean): L.DivIcon {
  const color  = CATEGORY_COLORS[category]
  const size   = selected ? 30 : 24
  const hit    = 44  // クリック判定エリア（視覚サイズより大きい透明領域）
  const svg    = Math.round(size * 0.52)
  const border = selected ? '3px solid #1e40af' : '2.5px solid white'
  const shadow = selected ? '0 3px 10px rgba(0,0,0,.45)' : '0 2px 8px rgba(0,0,0,.3)'

  return L.divIcon({
    className: '',
    html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:${border};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${svg}" height="${svg}" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="${ICON_PATHS[category]}" fill-rule="nonzero"/></svg></div></div>`,
    iconSize:   [hit, hit],
    iconAnchor: [hit / 2, hit / 2],
  })
}

// ─── MapMarkers ──────────────────────────────────────────────────
type MarkersProps = {
  spots: Spot[]
  icons: Record<string, L.DivIcon>
  onHoverIn: (spot: Spot, x: number, y: number) => void
  onHoverOut: () => void
  onMapMove: () => void
  onPinClick: (spot: Spot) => void
  onMapClick: () => void
}

function MapMarkers({ spots, icons, onHoverIn, onHoverOut, onMapMove, onPinClick, onMapClick }: MarkersProps) {
  const map = useMap()

  useEffect(() => {
    map.on('movestart', onMapMove)
    map.on('zoomstart', onMapMove)
    map.on('click', onMapClick)
    return () => {
      map.off('movestart', onMapMove)
      map.off('zoomstart', onMapMove)
      map.off('click', onMapClick)
    }
  }, [map, onMapMove, onMapClick])

  return (
    <>
      {spots.map((spot) => (
        <Marker
          key={spot.id}
          position={[spot.lat, spot.lng]}
          icon={icons[spot.id]}
          eventHandlers={{
            mouseover: () => {
              const pt = map.latLngToContainerPoint([spot.lat, spot.lng])
              onHoverIn(spot, pt.x, pt.y)
            },
            mouseout: onHoverOut,
            click: () => onPinClick(spot),
          }}
        />
      ))}
    </>
  )
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
  hovered:         HoverState
  wrapperRef:      React.RefObject<HTMLDivElement | null>
  onMouseEnter:    () => void
  onMouseLeave:    () => void
  ogpImage:        string | null | undefined
  onDetailOpen:    (spot: Spot) => void
  onDetailClose:   () => void
  detailPanelOpen: boolean
}

function HoverCard({ hovered, wrapperRef, onMouseEnter, onMouseLeave, ogpImage, onDetailOpen, onDetailClose, detailPanelOpen }: HoverCardProps) {
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
  const status    = getEventStatus(spot.startDate, spot.endDate)
  const dateRange = getDateDisplay(spot.scheduleNote, spot.startDate, spot.endDate)
  const statusCfg = status ? STATUS_CONFIG[status] : null

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
      {/* ── 閉じるボタン（詳細パネルが開いている時のみ） ── */}
      {detailPanelOpen && <button
        onClick={(e) => { e.stopPropagation(); onDetailClose() }}
        aria-label="閉じる"
        style={{
          position: 'absolute', top: 6, right: 6, zIndex: 1,
          width: 22, height: 22, borderRadius: '50%',
          background: 'white', color: '#111',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, lineHeight: 1,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      >
        ×
      </button>}

      {/* ── カード本体 ── */}
      <div style={{
        borderRadius: 8,
        overflow:     'hidden',
        background:   'white',
        boxShadow:    '0 2px 4px rgba(0,0,0,.10), 0 8px 24px rgba(0,0,0,.12)',
      }}>
        {/* 画像（全体の約55%） */}
        <img
          src={ogpImage || CATEGORY_IMAGES[spot.category]}
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
              fontWeight: 700, fontSize: 13, lineHeight: 1.35,
              color: '#1a1a1a', margin: '0 0 3px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {spot.name}
            </p>
            {statusCfg && (
              <p style={{
                fontSize: 10, margin: '0 0 2px',
                fontWeight: 600, color: statusCfg.color,
              }}>
                {statusCfg.label}
              </p>
            )}
            {dateRange && (
              <p style={{
                fontSize: 11, margin: '0 0 2px', color: '#6b7280',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                📅 {dateRange}
              </p>
            )}
            {spot.venue && (
              <p style={{
                fontSize: 11, margin: 0, color: '#6b7280',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                📍 {spot.venue}
              </p>
            )}
          </div>

        </div>
      </div>

      {/* 透明ブリッジ：ピンとカード間の隙間をカバーし hover を維持 */}
      {pos.ready && (() => {
        const bridgeW    = 36
        const pinInWrap  = hovered.x - pos.left + CARD_W / 2
        const bridgeLeft = Math.max(0, Math.min(CARD_W - bridgeW, pinInWrap - bridgeW / 2))
        return (
          <div style={{
            position: 'absolute',
            left: bridgeLeft,
            width: bridgeW,
            ...(pos.above
              ? { top: pos.cardH, height: GAP }
              : { top: -GAP,      height: GAP }),
          }} />
        )
      })()}
    </div>
  )
}

// ─── SelectedSpotTracker ─────────────────────────────────────────
function SelectedSpotTracker({
  selectedSpot,
  userLocation,
  onHoverChange,
}: {
  selectedSpot: Spot | null
  userLocation: [number, number] | null
  onHoverChange: (hover: HoverState | null) => void
}) {
  const map = useMap()
  const userLocationRef = useRef(userLocation)
  useEffect(() => { userLocationRef.current = userLocation }, [userLocation])

  const updatePosition = useCallback(() => {
    if (!selectedSpot) { onHoverChange(null); return }
    const pt = map.latLngToContainerPoint([selectedSpot.lat, selectedSpot.lng])
    onHoverChange({ spot: selectedSpot, x: pt.x, y: pt.y })
  }, [selectedSpot, map, onHoverChange])

  // selectedSpot 変更時: 範囲外なら flyToBounds、範囲内なら即表示
  useEffect(() => {
    if (!selectedSpot) { onHoverChange(null); return }
    const spotLatLng = L.latLng(selectedSpot.lat, selectedSpot.lng)
    if (map.getBounds().contains(spotLatLng)) {
      updatePosition()
    } else {
      const loc = userLocationRef.current
      const other = loc ? L.latLng(loc[0], loc[1]) : map.getCenter()
      map.flyToBounds(L.latLngBounds([spotLatLng, other]), { padding: [60, 60] })
      // moveend 後に updatePosition が呼ばれて吹き出しが表示される
    }
  }, [selectedSpot, map, onHoverChange, updatePosition])

  // マップ移動イベント: 移動中は非表示、終了後に再表示
  useEffect(() => {
    const onMoveStart = () => onHoverChange(null)
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
  }, [map, updatePosition, onHoverChange])

  return null
}

// ─── MapResizer ──────────────────────────────────────────────────
// detailPanelOpen の変化（サイドバー幅変化）時にタイルを再描画する。
// 位置・ズームは変えない。現在地への移動は FlyToLocation が担う。
function MapResizer({ detailPanelOpen }: { detailPanelOpen: boolean }) {
  const map = useMap()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    map.invalidateSize()
  }, [detailPanelOpen, map])

  return null
}

// ─── FlyToLocation ───────────────────────────────────────────────
function FlyToLocation({ location, radius }: { location: [number, number] | null; radius: number }) {
  const map = useMap()
  const prevLocationRef = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!location) return
    const r = radius * 1000
    const { x: w, y: h } = map.getSize()
    const targetPx = Math.min(w, h) - 12
    const cosLat = Math.cos(location[0] * Math.PI / 180)
    const zoom = Math.floor(
      Math.log2((targetPx * 40075016.686 * cosLat) / (2 * r * 256))
    )
    const prev = prevLocationRef.current
    const locationChanged = prev?.[0] !== location[0] || prev?.[1] !== location[1]
    prevLocationRef.current = location

    if (locationChanged) {
      map.setView(location, zoom, { animate: false })
    } else {
      // 半径スライダー変更のみ: 微小なズーム調整
      map.setView(location, zoom, { animate: true, duration: 0.3 })
    }
  }, [location, radius, map])
  return null
}

// ─── MapView（メインコンポーネント） ─────────────────────────────
export default function MapView({ spots, onSpotSelect, selectedSpot, userLocation = null, locationRadius = 60, onDetailOpen, onDetailClose, detailPanelOpen, isMobile = false }: Props) {
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const [hovered,      setHovered]      = useState<HoverState | null>(null)
  const [pinnedHover,  setPinnedHover]  = useState<HoverState | null>(null)
  const hideTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (hover?.spot.url) fetchOgp(hover.spot.id, hover.spot.url)
  }, [fetchOgp])

  const handleHoverIn = useCallback((spot: Spot, x: number, y: number) => {
    clearHide()
    setHovered({ spot, x, y })
    if (spot.url) fetchOgp(spot.id, spot.url)
  }, [clearHide, fetchOgp])

  const handleImmediateHide = useCallback(() => {
    clearHide()
    setHovered(null)
  }, [clearHide])

  const icons = useMemo(() => {
    const result: Record<string, L.DivIcon> = {}
    for (const s of spots) {
      result[s.id] = buildDivIcon(s.category, false)
    }
    return result
  }, [spots])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={OTA_CENTER}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={!isMobile}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapMarkers
          spots={spots}
          icons={icons}
          onHoverIn={handleHoverIn}
          onHoverOut={scheduleHide}
          onMapMove={handleImmediateHide}
          onPinClick={isMobile ? onSpotSelect : onDetailOpen}
          onMapClick={isMobile ? () => { onSpotSelect(null); handleImmediateHide() } : handleImmediateHide}
        />
        <FlyToLocation location={userLocation} radius={locationRadius} />
        <MapResizer detailPanelOpen={detailPanelOpen} />
        <SelectedSpotTracker selectedSpot={selectedSpot} userLocation={userLocation} onHoverChange={handlePinnedHoverChange} />
        {userLocation && (
          <>
            <Circle
              center={userLocation}
              radius={locationRadius * 1000}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.09,
                weight: 1.2,
                opacity: 0.7,
              }}
            />
            <Marker position={userLocation} icon={USER_LOCATION_ICON} />
          </>
        )}
      </MapContainer>

      {/* マウスホバー優先、なければサイドバー選択スポットの吹き出しを表示 */}
      {(() => {
        const activeHover = hovered ?? pinnedHover
        if (!activeHover) return null
        return (
          <HoverCard
            key={activeHover.spot.id}
            hovered={activeHover}
            wrapperRef={wrapperRef}
            onMouseEnter={clearHide}
            onMouseLeave={scheduleHide}
            ogpImage={ogpCache[activeHover.spot.id] ?? undefined}
            onDetailOpen={onDetailOpen}
            onDetailClose={onDetailClose}
            detailPanelOpen={detailPanelOpen}
          />
        )
      })()}
    </div>
  )
}
