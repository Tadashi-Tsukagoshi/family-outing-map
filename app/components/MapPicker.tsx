'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'
import { useEffect, useRef, useState } from 'react'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

const OTA_CENTER: [number, number] = [36.2913, 139.3758] // [lat, lng]

function toLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat]
}

function buildPinElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width  = '36px'
  el.style.height = '36px'
  el.style.cursor = 'grab'
  el.innerHTML = `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
    <div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>
  </div>`
  return el
}

function setMapLanguage(map: mapboxgl.Map) {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.type !== 'symbol') continue
    const layout = layer.layout as { 'text-field'?: unknown } | undefined
    if (!layout || !('text-field' in layout)) continue
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name_ja'], ['get', 'name']])
  }
}

type Props = {
  lat:      number | null
  lng:      number | null
  onChange: (lat: number, lng: number) => void
}

export default function MapPicker({ lat, lng, onChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<mapboxgl.Map | null>(null)
  const markerRef      = useRef<mapboxgl.Marker | null>(null)
  const onChangeRef    = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : OTA_CENTER

  // ─── 地図の初期化（一度だけ） ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: toLngLat(center[0], center[1]),
      zoom: 15,
    })
    mapRef.current = map

    map.on('load', () => setMapLanguage(map))
    map.on('click', (e) => onChangeRef.current(e.lngLat.lat, e.lngLat.lng))

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── マーカーの表示・更新 ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (lat === null || lng === null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ element: buildPinElement(), anchor: 'center', draggable: true })
        .setLngLat(toLngLat(lat, lng))
        .addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLngLat()
        onChangeRef.current(pos.lat, pos.lng)
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLngLat(toLngLat(lat, lng))
    }
  }, [lat, lng])

  // ─── 全画面切り替え時にサイズを再計算 ────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.resize())
    return () => cancelAnimationFrame(id)
  }, [isExpanded])

  return (
    <>
      {/* 全画面時の黒背景オーバーレイ */}
      <div
        style={{
          display: isExpanded ? 'block' : 'none',
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: '#000', zIndex: 9999,
        }}
      />

      <div
        style={
          isExpanded
            ? { position: 'fixed', top: 16, left: 16, right: 16, bottom: 16, zIndex: 9999, borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db' }
            : { height: 240, borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db', position: 'relative' }
        }
      >
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {/* 拡大ボタン */}
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          aria-label="地図を全画面表示"
          style={{
            display: isExpanded ? 'none' : 'flex',
            position: 'absolute', top: 8, right: 8,
            width: 32, height: 32, borderRadius: '50%',
            background: 'white', border: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 16, lineHeight: 1, color: '#374151', cursor: 'pointer',
          }}
        >
          ⤢
        </button>
      </div>

      {/* 閉じるボタン */}
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        aria-label="全画面表示を閉じる"
        style={{
          display: isExpanded ? 'flex' : 'none',
          position: 'fixed', top: 24, right: 24, zIndex: 10000,
          width: 36, height: 36, borderRadius: '50%',
          background: 'white', border: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 18, lineHeight: 1, color: '#374151', cursor: 'pointer',
        }}
      >
        ✕
      </button>

      {/* 決定ボタン */}
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        style={{
          display: isExpanded ? 'block' : 'none',
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
          padding: '10px 24px', borderRadius: 9999,
          background: '#22c55e', color: 'white', border: 'none',
          fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)', cursor: 'pointer',
        }}
      >
        この位置に決定
      </button>
    </>
  )
}
