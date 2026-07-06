'use client'

/**
 * Leaflet map — MUST only be loaded via next/dynamic ssr:false (see GarageMap.tsx).
 * Reads the REAL garage schema (servicesOffered, location, lat/lng).
 */
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoGarage } from '@/lib/geo'

// Brand pin (petrol-yellow) via divIcon — no external icon assets needed
const pin = L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;background:#FDB913;border:3px solid #0A0A0A;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24],
})

export default function GarageMapInner({
  garages, onBook,
}: {
  garages: GeoGarage[]
  onBook: (id: string) => void
}) {
  const withCoords = garages.filter(g => g.lat && g.lng)
  const center: [number, number] = withCoords.length
    ? [withCoords[0].lat!, withCoords[0].lng!]
    : [-1.2864, 36.8172] // Nairobi

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {withCoords.map(g => (
        <Marker key={g.id} position={[g.lat!, g.lng!]} icon={pin}>
          <Popup>
            <div style={{ minWidth: 200 }}>
              <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{g.name}</p>
              <p style={{ color: '#555', fontSize: 12, margin: '2px 0 6px' }}>{g.location}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {g.servicesOffered?.slice(0, 4).map(s => (
                  <span key={s} style={{ fontSize: 10, background: '#FDB91322', color: '#8a6400', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>{s}</span>
                ))}
              </div>
              <button
                onClick={() => onBook(g.id)}
                style={{ width: '100%', background: '#FDB913', color: '#0A0A0A', fontWeight: 700, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer' }}
              >
                Book Now →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
