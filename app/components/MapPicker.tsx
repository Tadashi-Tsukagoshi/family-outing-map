'use client'

import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'
import { useEffect, useRef } from 'react'

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

  return (
    <div style={{ height: 240, borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
