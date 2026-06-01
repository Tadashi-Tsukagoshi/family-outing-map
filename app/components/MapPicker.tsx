'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'

const OTA_CENTER: [number, number] = [36.2913, 139.3758]

const PIN_ICON = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
    <div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45);"></div>
  </div>`,
  iconSize:   [36, 36],
  iconAnchor: [18, 18],
})

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onChange(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

type Props = {
  lat:      number | null
  lng:      number | null
  onChange: (lat: number, lng: number) => void
}

export default function MapPicker({ lat, lng, onChange }: Props) {
  const center: [number, number] = lat !== null && lng !== null ? [lat, lng] : OTA_CENTER

  return (
    <div style={{ height: 240, borderRadius: 8, overflow: 'hidden', border: '1px solid #d1d5db' }}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onChange={onChange} />
        {lat !== null && lng !== null && (
          <Marker
            position={[lat, lng]}
            icon={PIN_ICON}
            draggable
            eventHandlers={{
              dragend(e) {
                const pos = (e.target as L.Marker).getLatLng()
                onChange(pos.lat, pos.lng)
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}
