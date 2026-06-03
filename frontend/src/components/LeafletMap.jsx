import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export default function LeafletMap({ geojson, center = [8.111, -6.822], zoom = 16 }) {
  const STATUS_COLOR = {
    'Libre': '#16a34a',
    'Occupé': '#2563eb',
    'Réservé': '#ca8a04',
    'Maintenance': '#dc2626',
  }

  return (
    <MapContainer
      center={center} zoom={zoom}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {geojson && (
        <GeoJSON
          data={geojson}
          pointToLayer={(feature, latlng) => {
            const statut = feature.properties?.statut || 'Libre'
            const color  = STATUS_COLOR[statut] || '#1e3a8a'
            return L.circleMarker(latlng, {
              radius: 9,
              fillColor: color,
              color: '#fff',
              weight: 2,
              fillOpacity: 0.9,
            })
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties
            layer.bindPopup(
              `<div style="font-family:system-ui;font-size:13px;min-width:140px">
                <b style="color:#0f172a">${p.residence || p.bloc || 'Résidence'}</b><br>
                <span style="color:#64748b">Statut:</span> <b>${p.statut || '—'}</b><br>
                <span style="color:#64748b">Occupant:</span> ${p.occupant || 'Libre'}
              </div>`
            )
          }}
        />
      )}
    </MapContainer>
  )
}
