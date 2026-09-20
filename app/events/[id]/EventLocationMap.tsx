'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { getCategoryIconSrc, type AllCategory } from '@/lib/spots'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

type Props = {
  eventId: string
  latitude: number
  longitude: number
  eventName: string
  category: AllCategory
}

/** MapView.tsx の setMapLanguage と同じロジック（そのまま移植）。地図の表示言語を日本語優先に切り替える */
function setMapLanguage(map: mapboxgl.Map) {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    const layout = layer.layout as { 'text-field'?: unknown } | undefined
    if (!layout || !('text-field' in layout)) continue
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name_ja'], ['get', 'name']])
  }
}

/** MapView.tsx の pickIcon と同じロジック（そのまま移植）。カテゴリ別のアイコン・背景色・発光エフェクトを決定 */
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

/**
 * MapView.tsx の buildIconDef（非選択・通常サイズの分岐）と同じロジック（そのまま移植）で
 * ピンのHTMLを生成する。events/[id] では単一イベント・非選択状態のピンを1つ出すだけでよいため、
 * selected/グループピン分岐は持たない。
 */
function buildPinHtml(category: AllCategory): string {
  if (category === 'event' || category === 'park') {
    const { src: icon } = pickIcon(category)
    const hit = 37
    const size = 33
    return `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${size}px;height:${size}px;object-fit:contain;display:block;"></div>`
  }

  const { src: icon, bg, glow, ratio } = pickIcon(category)
  const borderColor = '#9ca3af'
  const useGradientBorder = category === 'fireworks' || category === 'festival' || category === 'kumamoto_earthquake_r8'
  const gradientBorder = 'conic-gradient(from 0deg, #ffd600 0deg, #ffd600 60deg, #ff8a00 120deg, #ea4335 200deg, #bc2a8d 280deg, #ffd600 360deg)'
  const gradientBorderWidth = 2.5 * 0.7

  const hit = 37
  const size = 33
  const img = Math.round(size * ratio)
  const inner = size - gradientBorderWidth * 2
  const circle = useGradientBorder
    ? `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${gradientBorder};box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;"><div style="width:${inner}px;height:${inner}px;margin:${gradientBorderWidth}px;border-radius:50%;background:${bg};overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div></div>`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,.25);overflow:hidden;display:flex;align-items:center;justify-content:center;"><img src="${icon}" style="width:${img}px;height:${img}px;object-fit:contain;display:block;${glow}"></div>`
  return `<div style="width:${hit}px;height:${hit}px;display:flex;align-items:center;justify-content:center;">${circle}</div>`
}

export default function EventLocationMap({ eventId, latitude, longitude, eventName, category }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [longitude, latitude],
      zoom: 14,
      interactive: false,
      attributionControl: false,
    })

    map.on('load', () => {
      // MapView.tsxと同じ彩度・明度フィルタ、同じ日本語化ロジックでアプリ本体の地図と見た目を揃える
      map.getCanvas().style.filter = 'saturate(0.5) brightness(1.05)'
      setMapLanguage(map)
    })

    const el = document.createElement('div')
    el.innerHTML = buildPinHtml(category)
    new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([longitude, latitude])
      .addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude, category])

  return (
    <a
      href={`/?event=${eventId}`}
      aria-label={`${eventName}を地図で開く`}
      style={{
        display: 'block',
        position: 'relative',
        width: '100%',
        height: 200,
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <span
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(255,255,255,0.92)',
          color: '#111',
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 999,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}
      >
        🗺 地図で開く
      </span>
    </a>
  )
}
