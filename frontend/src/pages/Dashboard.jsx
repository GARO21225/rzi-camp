import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// ─────────────────────────────────────────────────────────────────
//  CARTE DIGITAL TWIN — évolution de la carte Leaflet existante
//  Conserve le chargement dynamique de Leaflet (pattern déjà en
//  prod) mais habille le rendu en thème sombre minier + légende
//  de statuts cohérente avec la nouvelle identité Roxgold.
// ─────────────────────────────────────────────────────────────────
function DigitalTwinMap({ bats, onClick }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!window.L) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => initMap()
      document.head.appendChild(script)
    } else {
      initMap()
    }
    function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return
      const L = window.L
      const map = L.map(mapRef.current, {
        center: [8.111, -6.822], zoom: 17,
        zoomControl: false, attributionControl: false
      })
      // Tuiles en mode sombre (CartoDB dark matter) pour cohérence avec l'identité minière
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 20
      }).addTo(map)
      mapInstanceRef.current = map
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !bats.length) return
    const L = window.L
    if (!L) return
    const STATUS_COLOR = {
      'Libre':'#16A34A', 'Occupé':'#C9972B', 'Réservé':'#2563EB', 'Maintenance':'#DC2626'
    }
    // Nettoyer les anciens markers avant d'en remettre (évite l'accumulation au refresh)
    mapInstanceRef.current.eachLayer(layer => {
      if (layer instanceof L.CircleMarker) mapInstanceRef.current.removeLayer(layer)
    })
    bats.forEach(b => {
      if (!b.latitude || !b.longitude) return
      const color = STATUS_COLOR[b.statut] || '#5B6472'
      const circle = L.circleMarker([parseFloat(b.latitude), parseFloat(b.longitude)], {
        radius: 9, fillColor: color, color: '#0B0F14', weight: 2, fillOpacity: 0.92
      }).addTo(mapInstanceRef.current)
      circle.bindPopup(
        `<div style="font-family:Inter,system-ui,sans-serif;font-size:13px;min-width:150px">
          <b style="color:#0B0F14">${b.residence || b.bloc || 'Résidence'}</b><br>
          <span style="color:#64748b">Statut:</span> <b style="color:${color}">${b.statut}</b><br>
          ${b.occupant ? `<span style="color:#64748b">Occupant:</span> ${b.occupant}` : ''}
        </div>`
      )
    })
    const pts = bats.filter(b=>b.latitude&&b.longitude).map(b=>[parseFloat(b.latitude),parseFloat(b.longitude)])
    if (pts.length > 1) mapInstanceRef.current.fitBounds(pts, { padding:[24,24] })
  }, [bats])

  return (
    <div style={{ height: 320, position: 'relative', borderRadius: 'var(--rzc-radius)', overflow: 'hidden' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#0B0F14' }} />
      <div onClick={onClick}
        style={{ position: 'absolute', inset: 0, zIndex: 1000, cursor: 'pointer', background: 'transparent' }} />
      {/* Overlay coin — accès rapide */}
      <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 1001,
        background: 'rgba(11,15,20,.85)', backdropFilter: 'blur(6px)',
        border: '1px solid var(--rzc-border-light)', borderRadius: 8,
        padding: '6px 12px', fontSize: 11, fontWeight: 700, color: 'var(--rzc-bright-gold)',
        pointerEvents: 'none' }}>
        🗺️ Carte complète →
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  COMPOSANTS UI — design system Roxgold (classes .rzc-*)
// ─────────────────────────────────────────────────────────────────
function Kpi({ icon, label, value, sub, accent = 'gold', loading }) {
  const accentColor = {
    gold:  'var(--rzc-ore-gold)',
    green: 'var(--rzc-green)',
    blue:  'var(--rzc-blue)',
    red:   'var(--rzc-red)',
  }[accent] || 'var(--rzc-ore-gold)'

  if (loading) {
    return (
      <div className="rzc-kpi rzc-fade-in">
        <div className="rzc-skeleton" style={{ width: 80, height: 10, marginBottom: 12 }} />
        <div className="rzc-skeleton" style={{ width: 60, height: 26, marginBottom: 8 }} />
        <div className="rzc-skeleton" style={{ width: 110, height: 9 }} />
      </div>
    )
  }

  return (
    <div className="rzc-kpi rzc-card-hover rzc-fade-in" style={{ borderLeftColor: accentColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="rzc-kpi-label">{label}</div>
          <div className="rzc-kpi-val" style={{ color: accentColor }}>
            {value ?? <span style={{ color: 'var(--rzc-text-4)' }}>—</span>}
          </div>
          {sub && <div style={{ fontSize: 11, color: 'var(--rzc-text-3)', marginTop: 5 }}>{sub}</div>}
        </div>
        <div className="rzc-kpi-icon" style={{ background: `${accentColor}22`, flexShrink: 0 }}>{icon}</div>
      </div>
    </div>
  )
}

function Panel({ title, action, children, style = {} }) {
  return (
    <div className="rzc-card" style={{ padding: 0, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', borderBottom: '1px solid var(--rzc-border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rzc-text)' }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function ProgBar({ value, color = 'var(--rzc-ore-gold)' }) {
  return (
    <div style={{ height: 5, background: 'rgba(15,26,46,.07)', borderRadius: 99, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ width: `${Math.min(100, Math.max(0, value || 0))}%`, height: '100%',
        background: color, borderRadius: 99, transition: 'width .6s ease' }} />
    </div>
  )
}

function AlertRow({ icon, title, desc, severity = 'info' }) {
  const cls = { ok:'rzc-badge-ok', alert:'rzc-badge-alert', info:'rzc-badge-info', gold:'rzc-badge-gold' }[severity]
  const borderColor = { ok:'var(--rzc-green)', alert:'var(--rzc-red)', info:'var(--rzc-blue)', gold:'var(--rzc-ore-gold)' }[severity]
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8,
      background: 'rgba(15,26,46,.025)', borderLeft: `3px solid ${borderColor}`, marginBottom: 8 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--rzc-text)', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 11, color: 'var(--rzc-text-3)', margin: '2px 0 0' }}>{desc}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  CONFIG API
//  Chaque appel reste indépendant (Promise.allSettled) afin qu'un
//  endpoint lent ou en erreur ne bloque jamais l'affichage des
//  autres KPIs — c'est le comportement déjà en place et il est
//  volontairement conservé pour la résilience réseau terrain.
// ─────────────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const tok  = () => localStorage.getItem('access_token') || ''
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` })

export default function Dashboard() {
  const nav = useNavigate()
  const [d, setD]           = useState({})
  const [perso, setPerso]   = useState([])
  const [dbBats, setDbBats] = useState([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Endpoints d'agrégats légers — jamais l'historique complet au chargement.
      // /personnel/ reste nécessaire en liste pour le calcul de conformité par société
      // (pas d'endpoint d'agrégat dédié côté backend actuellement) mais reste borné à 500.
      const [rB, rI, rV, rN, rRepas, rStock] = await Promise.allSettled([
        fetch(`${BASE}/api/batiments/stats/`,           { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/incidents/stats-sql/`,       { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/voyages/stats/`,             { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/notifications/compteur/`,    { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/repas/stats_jour/`,          { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/boutique/articles/alertes_stock/?seuil=20`, { headers: hdrs() }).then(r => r.json()),
      ])
      const merged = {}
      if (rB.status === 'fulfilled')     merged.bat    = rB.value
      if (rI.status === 'fulfilled')     merged.inc    = rI.value
      if (rV.status === 'fulfilled')     merged.voy    = rV.value
      if (rN.status === 'fulfilled')     merged.notifs = rN.value?.notifications || []
      if (rRepas.status === 'fulfilled') merged.repas  = rRepas.value
      if (rStock.status === 'fulfilled') merged.stock  = Array.isArray(rStock.value) ? rStock.value : []
      setD(merged)

      // Personnel : champ minimal nécessaire seulement (pas de page_size énorme à l'avenir
      // si un endpoint d'agrégat /personnel/stats-induction/ est ajouté côté backend).
      const rP = await fetch(`${BASE}/api/personnel/?page_size=500`, { headers: hdrs() }).then(r => r.json()).catch(() => null)
      if (rP) setPerso(rP.results || rP || [])
    } catch (e) { console.error('Dashboard load error:', e) }
    setSync(new Date())
    setLoading(false)
  }, [])

  // Bâtiments pour la carte — requête séparée, volontairement après les KPIs
  // (la carte n'est pas critique pour le premier rendu utile du dashboard)
  const loadMap = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/batiments/?page_size=500`, { headers: hdrs() }).then(r => r.json())
      setDbBats(r.results || r || [])
    } catch (e) {}
  }, [])

  useEffect(() => { load(); loadMap() }, [load, loadMap])
  useEffect(() => { const iv = setInterval(load, 60000); return () => clearInterval(iv) }, [load])

  // ── Calculs dérivés depuis les vrais champs API ──
  const ps      = d.bat?.par_statut || {}
  const libres  = ps['Libre']       || 0
  const occupes = ps['Occupé']      || 0
  const reserve = ps['Réservé']     || 0
  const maint   = ps['Maintenance'] || 0
  const taux    = d.bat?.taux_occupation ?? null
  // Règle métier camp minier : une personne peut être hébergée (chambre affectée)
  // ou non hébergée (pas de chambre, suivie uniquement en restauration). Les deux
  // comptes viennent du backend, jamais déduits par approximation côté frontend.
  const personnelLoge    = d.bat?.personnel_loge ?? null
  const personnelNonLoge = d.bat?.personnel_non_loge ?? null

  const ouverts   = (d.inc?.declare||0) + (d.inc?.assigne||0) + (d.inc?.en_cours||0)
  const critiques = d.inc?.critique    || 0
  const sla       = d.inc?.sla_depasse || 0

  const enVoyage  = d.voy?.en_voyage || 0
  const planifies = d.voy?.planifies || 0

  const total   = perso.length
  const induits = perso.filter(p => p.inductionrecord?.statut === 'valide').length
  const enCours = perso.filter(p => p.inductionrecord?.statut === 'en_cours').length
  const tauxInd = total ? Math.round(induits / total * 100) : 0

  const bySoc = {}
  perso.forEach(p => {
    const s = p.societe || 'Autre'
    if (!bySoc[s]) bySoc[s] = { total: 0, induits: 0 }
    bySoc[s].total++
    if (p.inductionrecord?.statut === 'valide') bySoc[s].induits++
  })
  const conf = Object.entries(bySoc)
    .map(([s, v]) => ({ s, pct: Math.round(v.induits / v.total * 100), ...v }))
    .sort((a, b) => b.pct - a.pct).slice(0, 5)

  const unread = (d.notifs || []).filter(n => !n.lu).length

  // Repas servis aujourd'hui — somme des types (petit-déj/déjeuner/dîner)
  const repasServisAujourdhui = d.repas
    ? Object.values(d.repas).reduce((s, v) => typeof v === 'number' ? s + v : s, 0)
    : null

  const stockCritiqueCount = d.stock?.length ?? null

  const MODULES = [
    { icon:'👥', label:'Employés',      path:'/personnel',    },
    { icon:'✈️', label:'Rotations',     path:'/rotations',    },
    { icon:'📅', label:'Réservations',  path:'/reservations', },
    { icon:'🏠', label:'Chambres',      path:'/residences',   },
    { icon:'🍽️', label:'Restauration',  path:'/restauration',  },
    { icon:'📦', label:'Stocks',        path:'/boutique',     },
    { icon:'🛠️', label:'Maintenance',   path:'/maintenance',   },
    { icon:'📋', label:'Rapports',      path:'/rapports',     },
  ]

  return (
    <div className="rzc-dark-scope rzc-fade-in" style={{ padding: 22 }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--rzc-ore-gold), var(--rzc-copper))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            ⛏️
          </div>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: '.3px' }}>
              RZI CAMP <span style={{ color: 'var(--rzc-text-4)', fontWeight: 500 }}>· Centre d'exploitation</span>
            </h1>
            <p style={{ fontSize: 11.5, color: 'var(--rzc-text-3)', margin: '3px 0 0' }}>
              Roxgold Sango · {sync ? `Synchronisé ${sync.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}` : 'Chargement...'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--rzc-green-l)', border: '1px solid rgba(74,222,128,.25)',
            borderRadius: 99, padding: '5px 13px', fontSize: 11, fontWeight: 700, color: '#15803D' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A',
              display: 'inline-block', boxShadow: '0 0 6px rgba(22,163,74,.5)' }} />
            Opérations en direct
          </div>
          <button className="rzc-btn rzc-btn-primary" onClick={load} disabled={loading}>
            {loading ? '⏳' : '🔄'} Actualiser
          </button>
        </div>
      </div>

      {/* ── KPIs PRINCIPAUX ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <Kpi loading={loading && !sync} icon="🏠" label="Occupation camp" accent="gold"
          value={taux !== null ? `${taux}%` : '—'}
          sub={`${occupes} occupées · ${libres} libres`} />
        <Kpi loading={loading && !sync} icon="👥" label="Personnel total" accent="blue"
          value={total || '—'}
          sub={`${personnelLoge ?? 0} hébergé(s) · ${personnelNonLoge ?? 0} non hébergé(s)`} />
        <Kpi loading={loading && !sync} icon="✈️" label="Rotation en cours" accent="gold"
          value={planifies || 0}
          sub={`${enVoyage} en transit actuellement`} />
        <Kpi loading={loading && !sync} icon="🛏️" label="Chambres disponibles" accent="green"
          value={libres}
          sub={`${reserve} réservées · ${maint} en maintenance`} />
        <Kpi loading={loading && !sync} icon="🍽️" label="Repas servis (jour)" accent="gold"
          value={repasServisAujourdhui ?? '—'}
          sub="Petit-déj · Déjeuner · Dîner" />
        <Kpi loading={loading && !sync} icon="📦" label="Stocks critiques" accent={stockCritiqueCount > 0 ? 'red' : 'green'}
          value={stockCritiqueCount ?? '—'}
          sub={stockCritiqueCount > 0 ? 'Articles sous le seuil' : 'Aucune alerte'} />
        <Kpi loading={loading && !sync} icon="🚨" label="Alertes sécurité" accent={critiques > 0 ? 'red' : 'green'}
          value={ouverts}
          sub={`${critiques} critique(s) · ${sla} SLA dépassé(s)`} />
        <Kpi loading={loading && !sync} icon="🛠️" label="Maintenance en attente" accent={ouverts > 0 ? 'red' : 'green'}
          value={ouverts}
          sub="Incidents non résolus" />
      </div>

      {/* ── DIGITAL TWIN + ALERTES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(280px,1fr)', gap: 14, marginBottom: 18 }}>

        <Panel title="🗺️ Carte du camp — Digital Twin"
          action={
            <span style={{ fontSize: 11, color: 'var(--rzc-text-3)' }}>
              {dbBats.length} structure(s) géolocalisée(s)
            </span>
          }>
          <DigitalTwinMap bats={dbBats} onClick={() => nav('/carte')} />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {[
              { l:'Libre', c:'#16A34A', n:libres },
              { l:'Occupé', c:'#C9972B', n:occupes },
              { l:'Réservé', c:'#2563EB', n:reserve },
              { l:'Maintenance', c:'#DC2626', n:maint },
            ].map(({ l, c, n }) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--rzc-text-3)' }}>
                  {l}: <b style={{ color: 'var(--rzc-text)' }}>{n}</b>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="⚠️ Alertes opérationnelles">
          {critiques > 0 && <AlertRow icon="🚨" severity="alert"
            title={`${critiques} incident(s) critique(s)`} desc="Intervention immédiate requise" />}
          {sla > 0 && <AlertRow icon="⏰" severity="alert"
            title={`${sla} SLA dépassé(s)`} desc="Délai de résolution expiré" />}
          {stockCritiqueCount > 0 && <AlertRow icon="📦" severity="gold"
            title={`${stockCritiqueCount} article(s) en stock bas`} desc="Réapprovisionnement à prévoir" />}
          {enVoyage > 0 && <AlertRow icon="✈️" severity="info"
            title={`${enVoyage} personne(s) hors camp`} desc={`${planifies} rotation(s) planifiée(s)`} />}
          {(d.bat?.departs_s1 || 0) > 0 && <AlertRow icon="🗓️" severity="info"
            title={`${d.bat.departs_s1} départ(s) cette semaine`} desc="Libérations de chambres à planifier" />}
          {critiques === 0 && sla === 0 && !stockCritiqueCount && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#15803D', margin: 0 }}>Opérations nominales</p>
              <p style={{ fontSize: 11, color: 'var(--rzc-text-3)', marginTop: 4 }}>Aucune alerte active</p>
            </div>
          )}
        </Panel>
      </div>

      {/* ── CONFORMITÉ + ACTIVITÉ + MODULES ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(260px,1fr)', gap: 14 }}>

        <Panel title="🎓 Conformité induction QHSE">
          {conf.length === 0
            ? <p style={{ color:'var(--rzc-text-3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Chargement...</p>
            : conf.map(({ s, pct, total: t, induits: i }) => (
              <div key={s} style={{ marginBottom: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--rzc-text-2)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{s}</span>
                  <span style={{ fontSize: 12, fontWeight: 700,
                    color: pct >= 80 ? '#15803D' : pct >= 60 ? 'var(--rzc-bright-gold)' : '#DC2626' }}>{pct}%</span>
                </div>
                <ProgBar value={pct} color={pct >= 80 ? 'var(--rzc-green)' : pct >= 60 ? 'var(--rzc-bright-gold)' : 'var(--rzc-red)'} />
                <p style={{ fontSize: 10, color: 'var(--rzc-text-4)', marginTop: 3 }}>{i}/{t} membres</p>
              </div>
            ))}
        </Panel>

        <Panel title="🔔 Activité récente"
          action={unread > 0 && <span className="rzc-badge rzc-badge-info">{unread} nouvelles</span>}>
          {(d.notifs || []).length === 0
            ? <p style={{ color:'var(--rzc-text-3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Aucune notification</p>
            : (d.notifs || []).slice(0, 5).map((n, i) => (
              <div key={n.id || i} style={{ display: 'flex', gap: 9, padding: '8px 0',
                borderBottom: i < 4 ? '1px solid var(--rzc-border)' : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: !n.lu ? 'var(--rzc-blue)' : 'var(--rzc-text-4)' }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--rzc-text-2)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.evenement_titre || n.message || 'Notification'}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--rzc-text-4)', margin: '2px 0 0' }}>
                    {n.date_envoi ? new Date(n.date_envoi).toLocaleString('fr-FR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                  </p>
                </div>
              </div>
            ))}
        </Panel>

        <Panel title="⚡ Accès rapides">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MODULES.map(({ icon, label, path }) => (
              <div key={path} onClick={() => nav(path)}
                className="rzc-card-hover"
                style={{ background: 'rgba(15,26,46,.025)', border: '1px solid var(--rzc-border)',
                  borderRadius: 9, padding: '11px 12px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 19, marginBottom: 4 }}>{icon}</div>
                <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--rzc-text-2)', margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
