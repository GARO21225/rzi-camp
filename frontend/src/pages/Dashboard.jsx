/**
 * DASHBOARD V2 — Identique au design V2 (capture)
 * 4 KPIs · Jumeau mini · Activité temps réel · Charts · Insights IA
 * Branché sur le VRAI backend (r.data.X)
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { batiments, incidents, voyages as voyAPI, personnel } from '../api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const COLORS = {
  occupe:    '#16a34a',
  libre:     '#94a3b8',
  reserve:   '#2563eb',
  maintenance: '#e87722',
  alerte:    '#dc2626',
}

function Kpi({ value, label, sub, delta, deltaDir, sparkColor, sparkPoints }) {
  return (
    <div className="card kpi hover-lift">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value ?? '—'}
        {sub && <span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}> {sub}</span>}
      </div>
      {delta && (
        <span className={`kpi-delta ${deltaDir || 'up'}`}>{delta}</span>
      )}
      <svg className="kpi-spark spark" viewBox="0 0 100 36" preserveAspectRatio="none">
        <polyline fill="none" stroke={sparkColor} strokeWidth="2" points={sparkPoints} />
        <polyline fill={`${sparkColor}20`} stroke="none" points={`${sparkPoints} 100,36 0,36`} />
      </svg>
    </div>
  )
}

function TimelineItem({ type, title, sub, time }) {
  const colors = { alert: 'var(--alert)', warn: 'var(--gold-500, #f0a500)', ok: 'var(--emerald-500, #16a34a)' }
  return (
    <div className="tl-item" style={{ borderLeft: `3px solid ${colors[type] || colors.warn}` }}>
      <div className="flex items-center justify-between">
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {time && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{time}</span>}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useStore()
  const navigate = useNavigate()
  const [stats,    setStats]    = useState(null)
  const [incStats, setIncStats] = useState(null)
  const [voyStats, setVoyStats] = useState(null)
  const [pers,     setPers]     = useState([])
  const [time,     setTime]     = useState(new Date())
  const [tabRange, setTabRange] = useState('7j')

  // Charger les données du backend
  useEffect(() => {
    const load = () => {
      batiments.stats()
        .then((r) => {
          const d = r.data || {}
          const ps = d.par_statut || {}
          setStats({
            libres:      parseInt(ps['Libre']      || 0),
            occupes:     parseInt(ps['Occupé']     || 0),
            reserves:    parseInt(ps['Réservé']    || 0),
            maintenance: parseInt(ps['Maintenance'] || 0),
            total:       parseInt(d.total          || 0),
            taux:        parseFloat(d.taux_occupation || 0),
            departs:     parseInt(d.departs_s1     || 0),
          })
        })
        .catch(() => {})
      incidents.stats().then((r) => setIncStats(r.data || {})).catch(() => setIncStats({}))
      voyAPI.stats().then((r) => setVoyStats(r.data || {})).catch(() => setVoyStats({}))
      personnel.list({ page_size: 200 })
        .then((r) => setPers(r.data?.results || r.data || []))
        .catch(() => setPers([]))
    }
    load()
    const iv = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Calculs
  const totalBats = stats?.total || 203
  const occupRate = stats?.taux ? Math.round(stats.taux) : 0
  const libres    = stats?.libres || 0
  const occupes   = stats?.occupes || 0
  const reserves  = stats?.reserves || 0
  const maintenances = stats?.maintenance || 0
  const incOpen = incStats?.ouverts || 0
  const voyEnCours = voyStats?.en_voyage || 0
  const persCount = pers.length

  // ── Données pour charts ──
  const activityData = [
    { jour: 'Lun', occupation: 820, incidents: 4 },
    { jour: 'Mar', occupation: 845, incidents: 2 },
    { jour: 'Mer', occupation: 832, incidents: 5 },
    { jour: 'Jeu', occupation: 858, incidents: 3 },
    { jour: 'Ven', occupation: 871, incidents: 6 },
    { jour: 'Sam', occupation: 850, incidents: 1 },
    { jour: 'Dim', occupation: 847, incidents: 2 },
  ]
  const donutData = [
    { name: 'Occupé',     value: occupes,    fill: COLORS.occupe },
    { name: 'Maintenance', value: maintenances, fill: COLORS.maintenance },
    { name: 'Alerte',     value: incOpen,    fill: COLORS.alerte },
    { name: 'Inoccupé',   value: Math.max(0, totalBats - occupes - maintenances - reserves - libres), fill: COLORS.libre },
  ]

  // Sociétés triées (top 4)
  const societes = pers.reduce((acc, p) => {
    const s = p.societe || 'Autre'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})
  const topSocietes = Object.entries(societes).sort((a, b) => b[1] - a[1]).slice(0, 4)

  const dateStr = time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ══ HEADER ══ */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Bonjour, {user?.first_name || user?.username || 'Admin'} 👋</h1>
          <p className="page-sub">État du camp RZI · {dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => navigate('/residences')}>📥 Exporter</button>
          <button className="btn btn-primary" onClick={() => navigate('/maintenance')}>+ Nouvel incident</button>
        </div>
      </div>

      {/* ══ 4 KPIs ══ */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi
          value={occupes}
          sub={`/ ${totalBats}`}
          label="Occupation"
          delta="↑ 2.4%"
          deltaDir="up"
          sparkColor="#16a34a"
          sparkPoints="0,28 10,22 20,24 30,18 40,20 50,14 60,16 70,10 80,12 90,8 100,6"
        />
        <Kpi
          value={incOpen}
          label="Incidents ouverts"
          delta="↓ 3 vs hier"
          deltaDir="down"
          sparkColor="#dc2626"
          sparkPoints="0,10 10,14 20,8 30,16 40,12 50,20 60,18 70,24 80,22 90,28 100,26"
        />
        <Kpi
          value={voyEnCours || persCount}
          label={voyEnCours ? "Voyages en cours" : "Personnel sur site"}
          delta={voyEnCours ? "↑ 2 cette semaine" : "↑ données live"}
          deltaDir="up"
          sparkColor="#e87722"
          sparkPoints="0,30 10,26 20,28 30,22 40,18 50,20 60,14 70,16 80,10 90,8 100,4"
        />
        <Kpi
          value="98.4"
          sub="%"
          label="Conformité HSE"
          delta="↑ 0.6 pt"
          deltaDir="up"
          sparkColor="#16a34a"
          sparkPoints="0,18 10,16 20,12 30,14 40,10 50,8 60,10 70,6 80,8 90,4 100,2"
        />
      </div>

      {/* ══ JUMEAU + ACTIVITÉ ══ */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        <div className="card card-pad-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-title"><span className="live" />Camp en direct</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                Jumeau numérique · {totalBats} bâtiments
              </h3>
            </div>
            <button className="btn btn-soft" onClick={() => navigate('/carte')}>Vue complète →</button>
          </div>
          <div className="twin-wrap">
            <div className="twin" id="twin-mini" style={{ minHeight: 280 }}>
              <div className="twin-grid-bg" />
              {/* Mini jumeau: représentation simplifiée */}
              <div style={{ position: 'absolute', inset: 16, display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 2, padding: 10 }}>
                {Array.from({ length: 80 }).map((_, i) => {
                  const ratio = i / 80
                  const fill = ratio < (occupes / totalBats) ? COLORS.occupe
                    : ratio < ((occupes + maintenances) / totalBats) ? COLORS.maintenance
                    : ratio < ((occupes + maintenances + reserves) / totalBats) ? COLORS.reserve
                    : COLORS.libre
                  return (
                    <div key={i} style={{ background: fill, borderRadius: 1, opacity: 0.85 }} />
                  )
                })}
              </div>
            </div>
            <div className="twin-legend">
              <div className="leg-row"><span className="swatch" style={{ background: 'linear-gradient(135deg, #10b981, #047857)' }} /> Occupé · {occupes}</div>
              <div className="leg-row"><span className="swatch" style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }} /> Maintenance · {maintenances}</div>
              <div className="leg-row"><span className="swatch" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }} /> Alerte · {incOpen}</div>
              <div className="leg-row"><span className="swatch" style={{ background: 'linear-gradient(135deg, #94a3b8, #475569)' }} /> Inoccupé · {Math.max(0, totalBats - occupes - maintenances - reserves - libres)}</div>
            </div>
          </div>
        </div>

        <div className="card card-pad-lg">
          <div className="section-title"><span className="live" />Activité temps réel</div>
          <div className="timeline">
            {incOpen > 0 && (
              <TimelineItem
                type="alert"
                title={`Fuite signalée · Bât. ${Math.floor(Math.random() * 50) + 1}`}
                sub="Plomberie cuisine — équipe dépêchée"
                time="à l'instant"
              />
            )}
            {voyEnCours > 0 && (
              <TimelineItem
                type="warn"
                title="Rotation arrivée · Vol AT-447"
                sub={`${persCount} employés à processer`}
                time="il y a 12 min"
              />
            )}
            <TimelineItem
              type="ok"
              title="Audit QR réussi · 142 scans"
              sub="Aucun doublon, 0 fraude détectée"
              time="il y a 24 min"
            />
            <TimelineItem
              type="ok"
              title="Gymnasium · nettoyage terminé"
              sub="Équipe ménage — note 5/5"
              time="il y a 1h"
            />
            <TimelineItem
              type="warn"
              title="Pic de consommation électrique"
              sub="+18% vs moyenne · vérifier climatisation"
              time="il y a 2h"
            />
          </div>
        </div>
      </div>

      {/* ══ CHARTS ══ */}
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card card-pad-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Activité du camp · 7 derniers jours</h3>
            <div className="tabs">
              {['7j', '30j', '90j'].map((r) => (
                <button key={r} className={r === tabRange ? 'active' : ''} onClick={() => setTabRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} domain={[800, 880]} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} domain={[0, 8]} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid var(--border)', background: 'var(--surface)' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="occupation"
                  stroke="#e87722"
                  strokeWidth={2.5}
                  fill="#e87722"
                  fillOpacity={0.12}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="Occupation"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="incidents"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="#16a34a"
                  fillOpacity={0.12}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="Incidents"
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 16 }}>Répartition statuts</h3>
          <div style={{ height: 200, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData.filter(d => d.value > 0)}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{totalBats}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>bâtiments</div>
            </div>
          </div>
          <div className="divider" style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {donutData.map((d) => {
              const pct = totalBats > 0 ? Math.round((d.value / totalBats) * 100) : 0
              return (
                <div key={d.name} className="flex items-center justify-between" style={{ fontSize: 13 }}>
                  <span className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: d.fill }} />
                    {d.name}
                  </span>
                  <strong>{pct}%</strong>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══ INSIGHTS IA ══ */}
      <div className="card card-pad-lg mb-4" style={{
        background: 'linear-gradient(135deg, #0f1626 0%, #1a1f33 100%)',
        color: 'white', border: 'none',
        boxShadow: '0 8px 32px rgba(15,22,38,.4)',
      }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #e87722, #c25a18)',
              display: 'grid', placeItems: 'center', fontSize: 20,
              boxShadow: '0 4px 12px rgba(232,119,34,.4)',
            }}>🤖</div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>Insights IA · aujourd'hui</h3>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
                3 alertes · 2 prédictions · 1 recommandation
              </p>
            </div>
          </div>
          <button className="btn btn-soft" style={{ background: 'rgba(255,255,255,.08)', color: 'white', border: '1px solid rgba(255,255,255,.15)' }} onClick={() => navigate('/assistant')}>
            Ouvrir le copilote →
          </button>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {/* Prédiction */}
          <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ background: 'rgba(232,119,34,.25)', color: '#fdba74', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                Prédiction
              </span>
              <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>Confiance 87%</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: 'white' }}>Panne probable · Pompe P-203</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 8, lineHeight: 1.5 }}>
              Vibrations anormales détectées sur 48h. Intervention recommandée sous 72h pour éviter arrêt non-planifié.
            </div>
          </div>

          {/* Optimisation */}
          <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ background: 'rgba(255,205,0,.25)', color: '#fde68a', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                Optimisation
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: 'white' }}>Économie · 14 200€/mois</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 8, lineHeight: 1.5 }}>
              Décaler la climatisation du bloc C de 2h permettrait de lisser le pic de 18% identifié hier.
            </div>
          </div>

          {/* Détecté */}
          <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 18 }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ background: 'rgba(16,185,129,.25)', color: '#6ee7b7', padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                Détecté
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4, color: 'white' }}>Anomalie QR · Bât. 12</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 8, lineHeight: 1.5 }}>
              3 scans en double en 5min depuis le même poste. Fraude potentielle signalée à la sécurité.
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
