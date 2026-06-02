import React, { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl } from 'react-leaflet'
import { Filter, Layers, Maximize2, MapPin, Activity, Zap, Droplets, Thermometer, Building2 } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import BarChart from '../components/BarChart'
import { generateBuildings, STATUS_COLORS, STATUS_LABELS, BUILDING_TYPES } from '../utils/buildings'

const CENTER = { lat: 12.452, lng: -0.512 }

const TABS = [
  { id: 'statut', label: 'Statut' },
  { id: 'occupation', label: 'Occupation' },
  { id: 'energie', label: 'Énergie' },
  { id: 'securite', label: 'Sécurité' },
]

export default function DigitalTwin() {
  const [buildings, setBuildings] = useState([])
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('statut')

  useEffect(() => { setBuildings(generateBuildings()) }, [])

  const stats = useMemo(() => {
    const s = { ok: 0, warn: 0, alert: 0, empty: 0, total: 0, occupants: 0, kwh: 0, m3: 0 }
    buildings.forEach((b) => {
      s[b.status]++
      s.total++
      s.occupants += b.occupants
      s.kwh += b.consommation_kwh
      s.m3 += b.eau_m3
    })
    return s
  }, [buildings])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Jumeau Numérique</h1>
          <p className="page-sub">Vue spatiale temps réel · {stats.total} bâtiments · données IoT + GPS personnel</p>
        </div>
        <div className="flex gap-2">
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <button className="btn btn-soft"><Filter size={14} /> Filtres</button>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Carte Leaflet */}
        <div className="card card-pad-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-title"><span className="dot dot-pulse dot-info" />Camp en direct</div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Carte interactive · {stats.total} bâtiments</h3>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-ghost"><Layers size={14} /> Couches</button>
              <button className="btn btn-sm btn-ghost"><Maximize2 size={14} /></button>
            </div>
          </div>

          <div className="twin-map" style={{ height: 520, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <MapContainer center={CENTER} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
              <ZoomControl position="bottomright" />
              {buildings.map((b) => (
                <CircleMarker
                  key={b.id}
                  center={[b.lat, b.lng]}
                  radius={b.status === 'alert' ? 9 : 6}
                  pathOptions={{
                    color: STATUS_COLORS[b.status] || STATUS_COLORS.ok,
                    fillColor: STATUS_COLORS[b.status] || STATUS_COLORS.ok,
                    fillOpacity: 0.85,
                    weight: b.status === 'alert' ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelected(b) }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#001e42' }}>{b.id} · {b.section}</div>
                      <div style={{ fontSize: 11, color: '#5a7794', marginTop: 2 }}>{BUILDING_TYPES[b.type]?.label}</div>
                      <div style={{ fontSize: 12, marginTop: 6 }}>{b.occupants}/{b.chambres} occupants</div>
                      <div style={{ fontSize: 11, color: '#5a7794' }}>{b.consommation_kwh.toFixed(0)} kWh · {b.eau_m3.toFixed(1)} m³</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLORS[k] }} />
                {v}
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
            Bâtiment sélectionné
          </h3>

          {selected ? (
            <BuildingDetail b={selected} />
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
              <MapPin size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontSize: 13 }}>Cliquez sur un bâtiment<br />sur la carte pour voir les détails</div>
            </div>
          )}

          <div className="divider" />
          <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Statistiques globales
          </h3>
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>Occupants</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{stats.occupants.toLocaleString('fr-FR')}</div>
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>Conso jour</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{Math.round(stats.kwh).toLocaleString('fr-FR')} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>kWh</span></div>
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>Eau</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{stats.m3.toFixed(0)} <span style={{ fontSize: 12, color: 'var(--text-3)' }}>m³</span></div>
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>Alertes</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--status-alert)' }}>{stats.alert}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bar charts — consommation par section */}
      <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad-lg">
          <div className="section-title">⚡ Top 5 bâtiments · consommation électrique</div>
          <BarChart
            data={buildings
              .slice()
              .sort((a, b) => b.consommation_kwh - a.consommation_kwh)
              .slice(0, 5)
              .map((b) => ({ label: `${b.id} · ${b.section}`, value: Math.round(b.consommation_kwh), unit: ' kWh' }))}
            color="var(--copper-500)"
          />
        </div>
        <div className="card card-pad-lg">
          <div className="section-title">💧 Top 5 bâtiments · consommation eau</div>
          <BarChart
            data={buildings
              .slice()
              .sort((a, b) => b.eau_m3 - a.eau_m3)
              .slice(0, 5)
              .map((b) => ({ label: `${b.id} · ${b.section}`, value: b.eau_m3.toFixed(1), unit: ' m³' }))}
            color="var(--status-info)"
          />
        </div>
      </div>

      <style>{`
        .grid { display: grid; }
        .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .mt-3 { margin-top: 12px; } .mt-4 { margin-top: 16px; }
        .divider { height: 1px; background: var(--border); margin: 16px 0; }
      `}</style>
    </div>
  )
}

function BuildingDetail({ b }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${STATUS_COLORS[b.status]}, ${STATUS_COLORS[b.status]}dd)`, display: 'grid', placeItems: 'center', color: 'white', fontWeight: 800, fontSize: 14, boxShadow: `0 4px 12px ${STATUS_COLORS[b.status]}55` }}>
          {b.id}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{BUILDING_TYPES[b.type]?.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Section {b.section} · {b.chambres} chambres</div>
        </div>
        <span className={`badge badge-${b.status === 'ok' ? 'ok' : b.status === 'warn' ? 'warn' : b.status === 'alert' ? 'alert' : 'ink'}`} style={{ marginLeft: 'auto' }}>
          {STATUS_LABELS[b.status]}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <Metric icon={<Building2 size={12} />} label="Occupants" value={`${b.occupants}/${b.chambres}`} />
        <Metric icon={<Zap size={12} />} label="Conso" value={`${b.consommation_kwh.toFixed(0)} kWh`} />
        <Metric icon={<Droplets size={12} />} label="Eau" value={`${b.eau_m3.toFixed(1)} m³`} />
        <Metric icon={<Thermometer size={12} />} label="Temp." value={`${b.temperature.toFixed(1)}°C`} />
      </div>

      <div className="divider" />

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Occupation
      </div>
      <ProgressBar value={b.occupants} max={b.chambres} color="copper" size="md" showLabel label={`${b.occupants}/${b.chambres} chambres`} />

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 14, marginBottom: 10 }}>
        Hygrométrie
      </div>
      <ProgressBar value={b.humidity} max={100} color="info" size="md" showLabel label={`${b.humidity.toFixed(0)}% humidité`} />

      <div className="divider" />

      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        👤 Responsable : <strong style={{ color: 'var(--text-2)' }}>{b.responsable}</strong>
      </div>

      <button className="btn btn-primary mt-3" style={{ width: '100%' }}>
        Créer intervention
      </button>
      <style>{`.mt-3 { margin-top: 12px; } .divider { height: 1px; background: var(--border); margin: 16px 0; }`}</style>
    </>
  )
}

function Metric({ icon, label, value }) {
  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  )
}
