'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useRef, useState, useMemo, useCallback, useEffect, useLayoutEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, ZoomControl, useMap } from 'react-leaflet'
import { getCategoryIconSrc, BADGE_BG_COLOR, type Category, type Spot } from '@/lib/spots'
import { getDateDisplay, getEventStatus, STATUS_CONFIG, PERMANENT_STATUS } from '@/lib/date-utils'
import { type SheetState } from './BottomSheet'

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
function pickIcon(category: Category, id: string): { src: string; bg: string; glow: string; ratio: number } {
  const lanternGlow = 'filter:drop-shadow(0 0 1.5px rgba(255,255,255,1)) drop-shadow(0 0 1.5px rgba(255,255,255,1));'
  const src = getCategoryIconSrc(category, id)
  if (category === 'fireworks') return { src, bg: '#1e1614', glow: '', ratio: 0.78 }
  if (category === 'festival')  return { src, bg: '#1e1614', glow: lanternGlow, ratio: 0.63 }
  return { src, bg: 'white', glow: '', ratio: 0.78 }
}

function buildDivIcon(spot: Spot, selected: boolean, isMobile: boolean): L.DivIcon {
  const { src: icon, bg, glow, ratio } = pickIcon(spot.category, spot.id)

  if (selected) {
    const hit  = 48
    const size = 44
    const img  = Math.round(size * ratio)
    return L.divIcon({
      className: '',
      html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><div class="pin-selected" style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid #d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.4);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`,
      iconSize:   [hit, hit],
      iconAnchor: [hit / 2, hit / 2],
    })
  }

  const hit  = isMobile ? 48 : 40
  const size = 36
  const img  = Math.round(size * ratio)
  return L.divIcon({
    className: '',
    html: `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid #d1d5db;box-shadow:0 2px 6px rgba(0,0,0,.25);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`,
    iconSize:   [hit, hit],
    iconAnchor: [hit / 2, hit / 2],
  })
}

// ─── MapMarkers ──────────────────────────────────────────────────
type MarkersProps = {
  spots: Spot[]
  icons: Record<string, L.DivIcon>
  selectedSpotId: string | null
  onHoverIn: (spot: Spot, x: number, y: number) => void
  onHoverOut: () => void
  onMapMove: () => void
  onPinClick: (spot: Spot) => void
  onMapClick: () => void
}

function MapMarkers({ spots, icons, selectedSpotId, onHoverIn, onHoverOut, onMapMove, onPinClick, onMapClick }: MarkersProps) {
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
          zIndexOffset={spot.id === selectedSpotId ? 1000 : 0}
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

// ─── SelectedSpotTracker ─────────────────────────────────────────
function SelectedSpotTracker({
  selectedSpot,
  userLocation,
  onHoverChange,
  isMobile,
  detailPanelOpen,
}: {
  selectedSpot: Spot | null
  userLocation: [number, number] | null
  onHoverChange: (hover: HoverState | null) => void
  isMobile: boolean
  detailPanelOpen: boolean
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
      // PC: 範囲内でパネルに隠れる場合・範囲外の場合ともにオフセット付き panTo
      const inBounds = map.getBounds().contains(spotLatLng)
      const pt = inBounds ? map.latLngToContainerPoint(spotLatLng) : null
      const hiddenByPanel = detailPanelOpen && (pt === null || pt.x < DETAIL_PANEL_W)

      if (!inBounds || hiddenByPanel) {
        // ズームを変えずにパネルを除いた可視エリア中央へ panTo
        const zoom = map.getZoom()
        const spotPx = map.project(spotLatLng, zoom)
        const offsetX = detailPanelOpen ? DETAIL_PANEL_W / 2 : 0
        const centerLatLng = map.unproject(L.point(spotPx.x - offsetX, spotPx.y), zoom)
        map.panTo(centerLatLng, { animate: true, duration: 0.5 })
      } else {
        updatePosition()
      }
    }
  }, [selectedSpot, map, onHoverChange, updatePosition, isMobile, detailPanelOpen])

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
const PEEK_HEIGHT = 72

function FlyToLocation({ location, radius, isMobile, sheetState }: { location: [number, number] | null; radius: number; isMobile: boolean; sheetState: SheetState }) {
  const map = useMap()
  const prevLocationRef = useRef<[number, number] | null>(null)
  const sheetStateRef = useRef<SheetState>(sheetState)
  useEffect(() => { sheetStateRef.current = sheetState }, [sheetState])

  useEffect(() => {
    if (!location) return
    const bounds = L.latLng(location[0], location[1]).toBounds(radius * 1000 * 2)
    const prev = prevLocationRef.current
    const locationChanged = prev?.[0] !== location[0] || prev?.[1] !== location[1]
    prevLocationRef.current = location

    let fitOpts: object
    if (isMobile) {
      const s = sheetStateRef.current
      const bottomPad =
        s === 'mid'  ? map.getSize().y / 2 :
        s === 'full' ? map.getSize().y * 0.85 :
        PEEK_HEIGHT
      fitOpts = { paddingTopLeft: [12, 12] as [number, number], paddingBottomRight: [12, bottomPad] as [number, number] }
    } else {
      fitOpts = { padding: [12, 12] as [number, number] }
    }

    map.options.zoomSnap = 0
    if (locationChanged) {
      map.fitBounds(bounds, { animate: false, ...fitOpts })
    } else {
      map.fitBounds(bounds, { animate: true, duration: 0.3, ...fitOpts })
    }
    map.options.zoomSnap = 1
  }, [location, radius, isMobile, map])
  return null
}

// ─── MapView（メインコンポーネント） ─────────────────────────────
export default function MapView({ spots, onSpotSelect, selectedSpot, userLocation = null, locationRadius = 60, recenterSignal = 0, onDetailOpen, onDetailClose, detailPanelOpen, isMobile = false, sheetState = 'closed' }: Props) {
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
      result[s.id] = buildDivIcon(s, s.id === selectedSpot?.id, isMobile)
    }
    return result
  }, [spots, selectedSpot, isMobile])

  return (
    <div ref={wrapperRef} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapContainer
        center={OTA_CENTER}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapMarkers
          spots={spots}
          icons={icons}
          selectedSpotId={selectedSpot?.id ?? null}
          onHoverIn={handleHoverIn}
          onHoverOut={scheduleHide}
          onMapMove={handleImmediateHide}
          onPinClick={handlePinClick}
          onMapClick={isMobile ? () => { onDetailClose(); onSpotSelect(null); handleImmediateHide() } : () => { onDetailClose(); handleImmediateHide() }}
        />
        {!isMobile && <ZoomControl position="topright" />}
        <FlyToLocation location={userLocation} radius={locationRadius} isMobile={isMobile} sheetState={sheetState} />
        <RecenterToOta signal={recenterSignal} />
        <MapResizer detailPanelOpen={detailPanelOpen} />
        <SelectedSpotTracker selectedSpot={selectedSpot} userLocation={userLocation} onHoverChange={handlePinnedHoverChange} isMobile={isMobile} detailPanelOpen={detailPanelOpen} />
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
