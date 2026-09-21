'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

type Props = {
  eventId: string
  latitude: number
  longitude: number
  eventName: string
}

export default function EventLocationMap({ eventId, latitude, longitude, eventName }: Props) {
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
      // MapView.tsxと同じ彩度・明度フィルタでアプリ本体の地図と見た目を揃える
      map.getCanvas().style.filter = 'saturate(0.5) brightness(1.05)'
    })
    new mapboxgl.Marker({ color: '#2f50c7' })
      .setLngLat([longitude, latitude])
      .addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [latitude, longitude])

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
