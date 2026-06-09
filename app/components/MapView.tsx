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
  recenterSignal?: number
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
  event:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
  music:      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200',
  exhibition: 'https://images.unsplash.com/photo-1566127992631-137a642a90f4?w=200',
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
function buildDivIcon(category: Category, selected: boolean, label = '', isMobile = false): L.DivIcon {
  const color = CATEGORY_COLORS[category]
  const hit   = isMobile ? 44 : 28

  if (selected) {
    const selHit  = 44
    const selSize = 34
    const char = label.charAt(0)
    return L.divIcon({
      className: '',
      html: `<div style="width:${selHit}px;height:${selHit}px;display:flex;align-items:center;justify-content:center;"><div class="pin-selected" style="width:${selSize}px;height:${selSize}px;border-radius:50%;background:${color};box-shadow:0 4px 16px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:400;font-family:sans-serif;line-height:1;">${char}</div></div>`,
      iconSize:   [selHit, selHit],
      iconAnchor: [selHit / 2, selHit / 2],
    })
  }

  const size = 24
  const svg  = Math.round(size * 0.52)
  return L.divIcon({
    className: '',
    html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="${svg}" height="${svg}" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="${ICON_PATHS[category]}" fill-rule="nonzero"/></svg></div></div>`,
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
            {dateRange && (
              <p style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, margin: '0 0 2px', color: '#6b7280',
                overflow: 'hidden',
              }}>
                <span style={{
                  display: 'inline-block', flexShrink: 0, padding: '1px 4px', borderRadius: 4,
                  background: '#6b7280', color: '#fff', fontSize: 10, fontWeight: 400,
                }}>
                  日時
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {dateRange}
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
                  background: '#6b7280', color: '#fff', fontSize: 10, fontWeight: 400,
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

// ─── SelectedSpotTracker ─────────────────────────────────────────
function SelectedSpotTracker({
  selectedSpot,
  userLocation,
  onHoverChange,
  isMobile,
}: {
  selectedSpot: Spot | null
  userLocation: [number, number] | null
  onHoverChange: (hover: HoverState | null) => void
  isMobile: boolean
}) {
  const map = useMap()
  const userLocationRef = useRef(userLocation)
  useEffect(() => { userLocationRef.current = userLocation }, [userLocation])

  const updatePosition = useCallback(() => {
    if (!selectedSpot) { onHoverChange(null); return }
    const pt = map.latLngToContainerPoint([selectedSpot.lat, selectedSpot.lng])
    onHoverChange({ spot: selectedSpot, x: pt.x, y: pt.y })
  }, [selectedSpot, map, onHoverChange])

  // selectedSpot 変更時
  useEffect(() => {
    if (!selectedSpot) { onHoverChange(null); return }
    const spotLatLng = L.latLng(selectedSpot.lat, selectedSpot.lng)

    if (isMobile) {
      // ボトムシート（50vh）上の可視エリア中央にピンを配置する
      // 可視エリア中央 y = containerH/4、マップ中心 y = containerH/2 なので
      // 中心の projected y = spot の projected y + containerH/4
      const zoom    = map.getZoom()
      const spotPx  = map.project(spotLatLng, zoom)
      const { y: containerH } = map.getSize()
      const centerLatLng = map.unproject(L.point(spotPx.x, spotPx.y + containerH / 4), zoom)
      map.panTo(centerLatLng, { animate: true, duration: 0.5 })
    } else {
      // PC: 範囲外なら flyToBounds、範囲内なら即表示
      if (map.getBounds().contains(spotLatLng)) {
        updatePosition()
      } else {
        const loc = userLocationRef.current
        const other = loc ? L.latLng(loc[0], loc[1]) : map.getCenter()
        map.flyToBounds(L.latLngBounds([spotLatLng, other]), { padding: [60, 60] })
      }
    }
  }, [selectedSpot, map, onHoverChange, updatePosition, isMobile])

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

// ─── RecenterToOta（現在地取得失敗時に太田市中心へ戻す） ───────────
function RecenterToOta({ signal }: { signal: number }) {
  const map = useMap()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    map.setView(OTA_CENTER, 12, { animate: false })
  }, [signal, map])
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
export default function MapView({ spots, onSpotSelect, selectedSpot, userLocation = null, locationRadius = 60, recenterSignal = 0, onDetailOpen, onDetailClose, detailPanelOpen, isMobile = false }: Props) {
  const wrapperRef  = useRef<HTMLDivElement>(null)
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

  const icons = useMemo(() => {
    const result: Record<string, L.DivIcon> = {}
    for (const s of spots) {
      result[s.id] = buildDivIcon(s.category, s.id === selectedSpot?.id, s.name, isMobile)
    }
    return result
  }, [spots, selectedSpot, isMobile])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={OTA_CENTER}
        zoom={12}
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
          onPinClick={handlePinClick}
          onMapClick={isMobile ? () => { onDetailClose(); onSpotSelect(null); handleImmediateHide() } : () => { onDetailClose(); handleImmediateHide() }}
        />
        <FlyToLocation location={userLocation} radius={locationRadius} />
        <RecenterToOta signal={recenterSignal} />
        <MapResizer detailPanelOpen={detailPanelOpen} />
        <SelectedSpotTracker selectedSpot={selectedSpot} userLocation={userLocation} onHoverChange={handlePinnedHoverChange} isMobile={isMobile} />
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
