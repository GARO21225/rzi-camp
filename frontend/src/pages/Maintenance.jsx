import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { incidents as incAPI } from '../api'
import { useStore } from '../store'


// ── Générateur de rapport maintenance ──────────────────────────
function genererRapport(incidents, stats, periode={}) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})
  const timeStr = now.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})

  // Calculs KPIs
  const ouverts   = incidents.filter(i=>!['resolu','cloture','annule'].includes(i.statut))
  const resolus   = incidents.filter(i=>['resolu','cloture'].includes(i.statut))
  const critiques = incidents.filter(i=>i.priorite==='critique')
  const slaDepasse= incidents.filter(i=>i.sla_depasse)

  // Durée moy résolution
  const avecDuree = resolus.filter(i=>i.date_creation&&i.date_resolution)
  const avgDays   = avecDuree.length
    ? (avecDuree.reduce((s,i)=>(s+(new Date(i.date_resolution)-new Date(i.date_creation))/86400000),0)/avecDuree.length).toFixed(1)
    : null

  // Plus vieux ouvert
  const oldest    = ouverts.length ? ouverts.reduce((a,b)=>new Date(a.date_creation)<new Date(b.date_creation)?a:b) : null
  const oldestDays= oldest ? Math.round((now-new Date(oldest.date_creation))/86400000) : null

  // Taux résolution
  const tauxRes   = incidents.length ? Math.round(resolus.length/incidents.length*100) : 0

  // Par catégorie
  const byCat = {}
  incidents.forEach(i=>{ if(i.categorie) byCat[i.categorie]=(byCat[i.categorie]||0)+1 })
  const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1])

  // Par statut
  const byStatut = {
    declare:  (stats.declare||0),
    assigne:  (stats.assigne||0),
    en_cours: (stats.en_cours||0),
    resolu:   (stats.resolu||0),
    cloture:  (stats.cloture||0),
  }

  // Par priorité
  const byPrio = {}
  incidents.forEach(i=>{ if(i.priorite) byPrio[i.priorite]=(byPrio[i.priorite]||0)+1 })

  // Par mois (12 derniers mois)
  const byMonth = {}
  incidents.forEach(i=>{
    if(i.date_creation) {
      const m = new Date(i.date_creation).toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})
      byMonth[m]=(byMonth[m]||0)+1
    }
  })
  const months = Object.entries(byMonth).slice(-12)

  // Incidents ouverts liste
  const incOuverts = ouverts
    .sort((a,b)=>new Date(a.date_creation)-new Date(b.date_creation))
    .slice(0,20)

  // SVG Charts inline
  const maxCat  = Math.max(...cats.map(([,n])=>n), 1)
  const maxMonth= Math.max(...months.map(([,n])=>n), 1)
  const COLORS  = ['#1e3a8a','#059669','#dc2626','#ea580c','#7c3aed','#0891b2','#ca8a04','#db2777']

  // Camembert statuts (SVG)
  function svgPie(data, r=80) {
    const total = data.reduce((s,[,n])=>s+n,0)
    if(!total) return '<text x="100" y="100" text-anchor="middle">Aucune donnée</text>'
    let angle = -Math.PI/2
    const clrs = ['#3b82f6','#f97316','#eab308','#16a34a','#64748b']
    return data.map(([lbl,n],i)=>{
      if(n===0) return ''
      const slice = (n/total)*Math.PI*2
      const x1=100+r*Math.cos(angle), y1=100+r*Math.sin(angle)
      angle += slice
      const x2=100+r*Math.cos(angle), y2=100+r*Math.sin(angle)
      const large = slice > Math.PI ? 1 : 0
      const pct = Math.round(n/total*100)
      return `<path d="M100,100 L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${clrs[i%clrs.length]}" stroke="#fff" stroke-width="2"/>`
    }).join('')
  }

  // Histogramme catégories (SVG)
  const barWidth = Math.min(40, Math.floor(360/Math.max(cats.length,1)))
  const svgBars = cats.slice(0,8).map(([cat,n],i)=>{
    const h = Math.round((n/maxCat)*120)
    const x = i*(barWidth+8)+20
    return `<rect x="${x}" y="${140-h}" width="${barWidth}" height="${h}" fill="${COLORS[i%COLORS.length]}" rx="3"/>
<text x="${x+barWidth/2}" y="${155}" text-anchor="middle" font-size="9" fill="#64748b">${cat.slice(0,8)}</text>
<text x="${x+barWidth/2}" y="${138-h}" text-anchor="middle" font-size="10" font-weight="bold" fill="${COLORS[i%COLORS.length]}">${n}</text>`
  }).join('')

  // Courbe temporelle (SVG)
  const svgLine = months.length > 1 ? (() => {
    const pts = months.map(([,n],i)=>({
      x: 20+i*(360/(months.length-1)),
      y: 130-Math.round((n/maxMonth)*110)
    }))
    const polyline = pts.map(p=>`${p.x},${p.y}`).join(' ')
    const labels = months.map(([m,],i)=>`<text x="${pts[i].x}" y="148" text-anchor="middle" font-size="9" fill="#64748b">${m}</text>`).join('')
    const dots   = pts.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#1e3a8a"/><text x="${p.x}" y="${p.y-8}" text-anchor="middle" font-size="9" font-weight="bold" fill="#1e3a8a">${months[i][1]}</text>`).join('')
    return `<polyline points="${polyline}" fill="none" stroke="#1e3a8a" stroke-width="2.5"/>${dots}${labels}`
  })() : '<text x="190" y="90" text-anchor="middle" font-size="12" fill="#94a3b8">Données insuffisantes</text>'

  // Camembert priorités
  const prioData = [
    ['Critique', byPrio.critique||0],
    ['Haute',    byPrio.haute||0],
    ['Moyenne',  byPrio.moyenne||0],
    ['Basse',    byPrio.basse||0],
  ].filter(([,n])=>n>0)

  const HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport Maintenance — ${dateStr}</title>
<style>
  @media print {
    .no-print { display:none }
    .page-break { page-break-before: always }
    body { margin:0 }
  }
  * { box-sizing:border-box; margin:0; padding:0 }
  body { font-family:Arial,sans-serif; color:#1e293b; background:#fff; font-size:13px }
  .header { background:linear-gradient(135deg,#0f172a,#1e3a8a); color:#fff; padding:32px 40px; }
  .header h1 { font-size:28px; font-weight:900; margin-bottom:6px }
  .header p  { font-size:13px; opacity:.8 }
  .section   { padding:24px 40px; border-bottom:1px solid #e2e8f0 }
  .section h2{ font-size:16px; font-weight:800; color:#1e3a8a; margin-bottom:16px;
    display:flex; align-items:center; gap:8px }
  .kpi-grid  { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:8px }
  .kpi-box   { border-radius:10px; padding:14px; border-left:4px solid }
  .kpi-val   { font-size:28px; font-weight:900; line-height:1 }
  .kpi-lbl   { font-size:11px; font-weight:600; margin-top:4px; text-transform:uppercase; letter-spacing:.5px }
  .charts-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px }
  .chart-box { background:#f8fafc; border-radius:10px; padding:16px; border:1px solid #e2e8f0 }
  .chart-box h3 { font-size:13px; font-weight:700; color:#374151; margin-bottom:12px }
  table { width:100%; border-collapse:collapse; font-size:12px }
  th { background:#f1f5f9; padding:8px 12px; text-align:left; font-weight:700; font-size:11px;
    text-transform:uppercase; letter-spacing:.5px; color:#64748b; border-bottom:2px solid #e2e8f0 }
  td { padding:8px 12px; border-bottom:1px solid #f1f5f9; vertical-align:top }
  tr:hover td { background:#f8fafc }
  .badge { display:inline-block; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:700 }
  .footer { padding:16px 40px; font-size:11px; color:#94a3b8; text-align:center }
  .no-print { margin:20px 40px }
  .print-btn { background:#1e3a8a; color:#fff; border:none; padding:10px 24px; border-radius:8px;
    cursor:pointer; font-size:14px; font-weight:700; margin-right:10px }
  .legend-item { display:inline-flex; align-items:center; gap:5px; margin-right:12px; font-size:11px }
  .legend-dot  { width:10px; height:10px; border-radius:50% }
  .alert-box { background:#fee2e2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:8px; margin-bottom:12px }
</style>
</head>
<body>

<div class="no-print">
  <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Sauvegarder PDF</button>
  <button onclick="window.close()" style="background:#f1f5f9;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px">✕ Fermer</button>
</div>

<!-- En-tête -->
<div class="header">
  <div style="font-size:11px;opacity:.6;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">
    RZI Camp · Résidence Roxgold Sango · Côte d'Ivoire
  </div>
  <h1>🔧 Rapport de Maintenance</h1>
  <p>Généré le ${dateStr} à ${timeStr} · ${incidents.length} incident(s) au total</p>
</div>

<!-- Alertes critiques -->
${critiques.length > 0 ? `<div class="section">
  <div class="alert-box">
    <strong>⚠️ ${critiques.length} incident(s) CRITIQUE(S) en cours</strong><br>
    ${critiques.filter(i=>!['resolu','cloture'].includes(i.statut)).map(i=>`• ${i.titre} (${i.residence})`).join('<br>')}
  </div>
</div>` : ''}

<!-- KPIs principaux -->
<div class="section">
  <h2>📊 Indicateurs clés de performance</h2>
  <div class="kpi-grid">
    <div class="kpi-box" style="background:#eff6ff;border-color:#3b82f6">
      <div class="kpi-val" style="color:#1e3a8a">${incidents.length}</div>
      <div class="kpi-lbl" style="color:#3b82f6">Total incidents</div>
    </div>
    <div class="kpi-box" style="background:#fee2e2;border-color:#dc2626">
      <div class="kpi-val" style="color:#dc2626">${ouverts.length}</div>
      <div class="kpi-lbl" style="color:#dc2626">Incidents ouverts</div>
    </div>
    <div class="kpi-box" style="background:#f0fdf4;border-color:#16a34a">
      <div class="kpi-val" style="color:#16a34a">${tauxRes}%</div>
      <div class="kpi-lbl" style="color:#16a34a">Taux de résolution</div>
    </div>
    <div class="kpi-box" style="background:#fefce8;border-color:#ca8a04">
      <div class="kpi-val" style="color:#ca8a04">${slaDepasse.length}</div>
      <div class="kpi-lbl" style="color:#ca8a04">SLA dépassés</div>
    </div>
    <div class="kpi-box" style="background:#f5f3ff;border-color:#7c3aed">
      <div class="kpi-val" style="color:#7c3aed">${avgDays ? avgDays+'j' : '—'}</div>
      <div class="kpi-lbl" style="color:#7c3aed">Durée moy. résolution</div>
    </div>
    <div class="kpi-box" style="background:#fff7ed;border-color:#ea580c">
      <div class="kpi-val" style="color:#ea580c">${oldestDays != null ? oldestDays+'j' : '—'}</div>
      <div class="kpi-lbl" style="color:#ea580c">Plus vieux ouvert</div>
    </div>
    <div class="kpi-box" style="background:#fee2e2;border-color:#dc2626">
      <div class="kpi-val" style="color:#dc2626">${critiques.length}</div>
      <div class="kpi-lbl" style="color:#dc2626">Critiques</div>
    </div>
    <div class="kpi-box" style="background:#f0fdf4;border-color:#16a34a">
      <div class="kpi-val" style="color:#16a34a">${resolus.length}</div>
      <div class="kpi-lbl" style="color:#16a34a">Résolus / Clôturés</div>
    </div>
  </div>
</div>

<!-- Graphiques -->
<div class="section">
  <h2>📈 Analyses graphiques</h2>
  <div class="charts-grid">

    <!-- Histogramme par catégorie -->
    <div class="chart-box">
      <h3>Répartition par catégorie</h3>
      <svg viewBox="0 0 400 165" width="100%" style="overflow:visible">
        <line x1="20" y1="20" x2="20" y2="140" stroke="#e2e8f0" stroke-width="1"/>
        <line x1="20" y1="140" x2="390" y2="140" stroke="#e2e8f0" stroke-width="1"/>
        ${svgBars}
      </svg>
    </div>

    <!-- Camembert statuts -->
    <div class="chart-box">
      <h3>Répartition par statut</h3>
      <div style="display:flex;align-items:center;gap:20px">
        <svg viewBox="0 0 200 200" width="150" height="150">
          ${svgPie([
            ['Déclaré',   byStatut.declare],
            ['Assigné',   byStatut.assigne],
            ['En cours',  byStatut.en_cours],
            ['Résolu',    byStatut.resolu],
            ['Clôturé',   byStatut.cloture],
          ])}
        </svg>
        <div>
          ${[['Déclaré','#3b82f6',byStatut.declare],
             ['Assigné','#f97316',byStatut.assigne],
             ['En cours','#eab308',byStatut.en_cours],
             ['Résolu','#16a34a',byStatut.resolu],
             ['Clôturé','#64748b',byStatut.cloture]
          ].map(([l,c,n])=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:11px">
            <div style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0"></div>
            <span>${l}: <b>${n}</b></span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Courbe temporelle -->
    <div class="chart-box">
      <h3>Évolution mensuelle des incidents</h3>
      <svg viewBox="0 0 400 165" width="100%">
        <line x1="20" y1="20" x2="20" y2="140" stroke="#e2e8f0" stroke-width="1"/>
        <line x1="20" y1="140" x2="390" y2="140" stroke="#e2e8f0" stroke-width="1"/>
        ${svgLine}
      </svg>
    </div>

    <!-- Camembert priorités -->
    <div class="chart-box">
      <h3>Répartition par priorité</h3>
      <div style="display:flex;align-items:center;gap:20px">
        <svg viewBox="0 0 200 200" width="150" height="150">
          ${svgPie([
            ['Critique',byPrio.critique||0],
            ['Haute',   byPrio.haute||0],
            ['Moyenne', byPrio.moyenne||0],
            ['Basse',   byPrio.basse||0],
          ], 80)}
        </svg>
        <div>
          ${[['Critique','#dc2626',byPrio.critique||0],
             ['Haute','#f97316',byPrio.haute||0],
             ['Moyenne','#eab308',byPrio.moyenne||0],
             ['Basse','#16a34a',byPrio.basse||0]
          ].map(([l,c,n])=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;font-size:11px">
            <div style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0"></div>
            <span>${l}: <b>${n}</b></span>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Liste des incidents ouverts -->
<div class="section page-break">
  <h2>📋 Incidents ouverts (${ouverts.length})</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Titre</th>
        <th>Catégorie</th>
        <th>Priorité</th>
        <th>Statut</th>
        <th>Résidence</th>
        <th>Déclaré le</th>
        <th>Assigné à</th>
        <th>SLA</th>
      </tr>
    </thead>
    <tbody>
      ${incOuverts.map((inc,i)=>`<tr>
        <td style="color:#94a3b8;font-size:11px">${inc.id}</td>
        <td style="font-weight:600;max-width:200px">${inc.titre||'—'}</td>
        <td>${inc.categorie||'—'}</td>
        <td>
          <span class="badge" style="background:${
            inc.priorite==='critique'?'#fee2e2':inc.priorite==='haute'?'#fff7ed':
            inc.priorite==='moyenne'?'#fefce8':'#f0fdf4'
          };color:${
            inc.priorite==='critique'?'#dc2626':inc.priorite==='haute'?'#ea580c':
            inc.priorite==='moyenne'?'#ca8a04':'#16a34a'
          }">${inc.priorite||'—'}</span>
        </td>
        <td>
          <span class="badge" style="background:#eff6ff;color:#1e3a8a">${inc.statut||'—'}</span>
        </td>
        <td>${inc.residence||'—'}${inc.bloc?' '+inc.bloc:''}</td>
        <td style="font-size:11px;white-space:nowrap">${inc.date_creation?new Date(inc.date_creation).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'2-digit'}):'—'}</td>
        <td style="font-size:11px">${inc.assigne_nom||'Non assigné'}</td>
        <td style="font-size:11px;color:${inc.sla_depasse?'#dc2626':'#16a34a'};font-weight:700">
          ${inc.sla_depasse?'⚠️ Dépassé':'✓'}
        </td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- Footer -->
<div class="footer">
  RZI Camp ERP · Rapport généré automatiquement le ${dateStr} à ${timeStr} ·
  Roxgold Sango, Côte d'Ivoire
</div>

</body>
</html>`

  return HTML
}

class MaintenanceBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(e) { return { err: e } }
  componentDidCatch(e) { console.error('[Maintenance crash]', e) }
  render() {
    if (this.state.err) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
        <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 16, marginBottom: 8 }}>
          Erreur dans Maintenance
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '10px 16px', fontSize: 11, color: '#991b1b', maxWidth: 400,
          margin: '0 auto 16px', fontFamily: 'monospace' }}>
          {String(this.state.err?.message || this.state.err)}
        </div>
        <button onClick={() => this.setState({ err: null })}
          style={{ background: 'var(--rzc-navy)', color: '#fff', border: 'none',
            padding: '10px 24px', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
          Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

const STATUTS = {
  declare:  { l: 'Déclaré',  c: '#3b82f6', bg: '#eff6ff' },
  assigne:  { l: 'Assigné',  c: '#f97316', bg: '#fff7ed' },
  en_cours: { l: 'En cours', c: '#eab308', bg: '#fefce8' },
  resolu:   { l: 'Résolu',   c: '#16a34a', bg: '#f0fdf4' },
  cloture:  { l: 'Clôturé',  c: '#64748b', bg: '#f8fafc' },
}
const PRIOS = {
  critique: { l: 'Critique', c: '#dc2626' },
  haute:    { l: 'Haute',    c: '#f97316' },
  moyenne:  { l: 'Moyenne',  c: '#eab308' },
  basse:    { l: 'Basse',    c: '#16a34a' },
}
const CATS = ['Plomberie','Electricite','Climatisation','Serrurerie','Toiture','Peinture','Informatique','Autre']
const WF = [
  { s: 'declare',  icon: '📢', l: 'Déclaré' },
  { s: 'assigne',  icon: '👷', l: 'Assigné' },
  { s: 'en_cours', icon: '⚙️',  l: 'En cours' },
  { s: 'resolu',   icon: '✅', l: 'Résolu' },
  { s: 'cloture',  icon: '🔒', l: 'Clôturé' },
]

export default function Maintenance() {
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser)
  const [incidents, setIncidents] = useState([])
  const [stats,     setStats]     = useState({})
  const [techns,    setTechns]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [editInc,   setEditInc]   = useState(null)
  const [showEdit,  setShowEdit]  = useState(false)
  const [search,    setSearch]    = useState('')
  const [statFilter, setStatFilter] = useState('')
  const [prioFilter, setPrioFilter] = useState('')
  const [slaOnly,    setSlaOnly]    = useState(false)
  const [selIds,     setSelIds]     = useState(new Set())
  const [massAct,    setMassAct]    = useState('')
  const [residences, setResidences] = useState([])
  const [dateDebut,  setDateDebut]  = useState('')
  const [dateFin,    setDateFin]    = useState('')
  const [showNew,    setShowNew]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err,        setErr]        = useState('')
  const EMPTY = { titre:'', description:'', categorie:'Plomberie', priorite:'moyenne', residence:'', bloc:'', photo_b64:'' }
  const [form, setForm] = useState(EMPTY)
  const [actionModal, setActionModal] = useState(null)
  const [actionComment, setActionComment] = useState('')
  const [actionTechId,  setActionTechId]  = useState('')
  const [showPeriodeModal, setShowPeriodeModal] = useState(false)
  const [periodeRapport,   setPeriodeRapport]   = useState({debut:'',fin:''})

  // Agrégats coûteux mémoïsés — recalculés uniquement quand `incidents`/`stats`
  // changent réellement, pas à chaque render du composant (recherche, filtres,
  // ouverture de modal, etc. qui n'ont rien à voir avec la liste d'incidents).
  const chartsData = useMemo(() => {
    const COLORS_STATUT = { declare:'#2563EB', assigne:'#D4A017', en_cours:'#B87333', resolu:'#16A34A', cloture:'#5B6472' }
    const LABELS_STATUT = { declare:'Déclarés', assigne:'Assignés', en_cours:'En cours', resolu:'Résolus', cloture:'Clôturés' }
    const pieData = Object.entries(stats)
      .filter(([k]) => COLORS_STATUT[k])
      .map(([k, n]) => [LABELS_STATUT[k], n, COLORS_STATUT[k]])
      .filter(([,n]) => n > 0)
    const pieTotal = pieData.reduce((s,[,n]) => s + n, 0)

    const byCatFull = {}
    incidents.forEach(i => { if (i.categorie) byCatFull[i.categorie] = (byCatFull[i.categorie] || 0) + 1 })
    const catData = Object.entries(byCatFull).sort((a,b) => b[1]-a[1]).slice(0, 8)
    const maxCatVal = Math.max(...catData.map(([,n]) => n), 1)

    const byMonthFull = {}
    incidents.forEach(i => {
      if (i.date_creation) {
        const m = new Date(i.date_creation).toLocaleDateString('fr-FR', { month:'short', year:'2-digit' })
        byMonthFull[m] = (byMonthFull[m] || 0) + 1
      }
    })
    const monthData = Object.entries(byMonthFull).slice(-12)
    const maxMonthVal = Math.max(...monthData.map(([,n]) => n), 1)

    return { pieData, pieTotal, catData, maxCatVal, monthData, maxMonthVal }
  }, [incidents, stats])

  const kpisComplementaires = useMemo(() => {
    const byPrioFull = { critique:0, haute:0, moyenne:0, basse:0 }
    incidents.forEach(i => { if (i.priorite && byPrioFull[i.priorite] !== undefined) byPrioFull[i.priorite]++ })
    const prioTotal = Object.values(byPrioFull).reduce((s,n) => s+n, 0)

    const byTech = {}
    incidents.forEach(i => {
      const nom = i.assigne_a_nom || i.assigne_a_username || (i.assigne_a ? `Technicien #${i.assigne_a}` : null)
      if (nom) byTech[nom] = (byTech[nom] || 0) + 1
    })
    const topTechs = Object.entries(byTech).sort((a,b) => b[1]-a[1]).slice(0,5)

    const byResidence = {}
    incidents.forEach(i => { if (i.residence) byResidence[i.residence] = (byResidence[i.residence] || 0) + 1 })
    const topResidences = Object.entries(byResidence).sort((a,b) => b[1]-a[1]).slice(0,5)

    const critResolus = incidents.filter(i => i.priorite==='critique' && ['resolu','cloture'].includes(i.statut))
    const critTotal = incidents.filter(i => i.priorite==='critique')
    const tauxCritResolu = critTotal.length ? Math.round(critResolus.length / critTotal.length * 100) : null

    return { byPrioFull, prioTotal, topTechs, topResidences, tauxCritResolu }
  }, [incidents])

  useEffect(() => {
    const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
    const token = localStorage.getItem('access_token') || ''
    fetch(`${BASE}/api/batiments/?page_size=500`, {headers:{'Authorization':`Bearer ${token}`}})
      .then(r=>r.json())
      .then(d=>{
        const list = d.results || d || []
        const resids = [...new Set(list.map(b=>b.residence).filter(Boolean))].sort()
        if(resids.length) setResidences(resids)
      }).catch(()=>{})
  },[])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ri, rs, rt] = await Promise.allSettled([
        incAPI.list({ page_size:100 }),
        incAPI.stats(),
        incAPI.techniciens ? incAPI.techniciens() : Promise.resolve({data:[]}),
      ])
      if (ri.status === 'fulfilled') setIncidents(ri.value.data.results || ri.value.data || [])
      if (rs.status === 'fulfilled') setStats(rs.value.data || {})
      if (rt.status === 'fulfilled') setTechns(rt.value.data || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = incidents.filter(i => {
    // Masquer clôturés par défaut sauf si sélectionné explicitement
    if (i.statut === 'cloture' && statFilter !== 'cloture') return false
    if (search && ![i.titre,i.residence,i.categorie,i.auteur_nom].some(v=>(v||'').toLowerCase().includes(search.toLowerCase()))) return false
    if (statFilter && i.statut !== statFilter) return false
    if (prioFilter && i.priorite !== prioFilter) return false
    if (slaOnly && !i.sla_depasse) return false
    if (dateDebut && i.date_creation && new Date(i.date_creation) < new Date(dateDebut)) return false
    if (dateFin && i.date_creation && new Date(i.date_creation) > new Date(dateFin + 'T23:59:59')) return false
    return true
  })

  const declarer = async () => {
    if (!form.titre || !form.description || !form.residence) { setErr('Titre, description et résidence requis'); return }
    setSubmitting(true); setErr('')
    try {
      const payload = { titre:form.titre, description:form.description, categorie:form.categorie,
        priorite:form.priorite, residence:form.residence, bloc:form.bloc }
      if (form.photo_b64 && form.photo_b64.startsWith('data:')) {
        const parts = form.photo_b64.split(',')
        payload.photo_mime = form.photo_b64.split(';')[0].replace('data:','') || 'image/jpeg'
        payload.photo_base64 = parts[1] || ''
      }
      await incAPI.declarer(payload)
      setShowNew(false); setForm(EMPTY); await load()
    } catch(e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data) || 'Erreur serveur')
    } finally { setSubmitting(false) }
  }

  const doAction = async (action) => {
    if (!selected) return
    setSubmitting(true)
    try {
      if (action === 'assigner')  await incAPI.assigner(selected.id, { technicien_id: actionTechId })
      if (action === 'commencer') await incAPI.commencer(selected.id, { commentaire: actionComment })
      if (action === 'resoudre')  await incAPI.resoudre(selected.id, { commentaire: actionComment })
      if (action === 'cloturer')  await incAPI.cloturer(selected.id, { commentaire: actionComment })
      if (action === 'commenter') {
        const fn = incAPI.addComment || incAPI.commenter
        await fn(selected.id, { contenu: actionComment, type_comment: 'info' })
      }
      setActionModal(null); setActionComment(''); setActionTechId('')
      await load()
      const updated = await incAPI.list({ page_size:100 })
      const items = updated.data.results || updated.data || []
      setSelected(items.find(i => i.id === selected.id) || null)
    } catch(e) { alert(e.response?.data?.detail || 'Erreur action') }
    finally { setSubmitting(false) }
  }

  const compressImage = (file, maxSizeKB=800) => new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height
      const maxDim = 1200
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round(h * maxDim/w); w = maxDim }
        else { w = Math.round(w * maxDim/h); h = maxDim }
      }
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      let quality = 0.85
      let b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      while (b64.length > maxSizeKB*1024 && quality > 0.3) {
        quality -= 0.1
        b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      }
      URL.revokeObjectURL(url)
      resolve(b64)
    }
    img.src = url
  })

  const uploadPhoto = (type_comment) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 10*1024*1024) { alert('Max 10Mo'); return }
      try {
        const b64 = await compressImage(file, 800)
        const BASE = (import.meta?.env?.VITE_API_URL || window.location.origin.replace('frontend','backend')).replace(/\/+$/,'')
        const token = localStorage.getItem('access_token') || ''
        const resp = await fetch(`${BASE}/api/incidents/${selected.id}/commenter/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ type_comment, contenu: 'Photo ' + type_comment.replace('_',' '), photo_base64: b64 })
        })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}))
          alert('Erreur upload: ' + (err.detail || err.error || `HTTP ${resp.status}`))
          return
        }
        await load()
        try {
          const rd = await incAPI.detail(selected.id)
          setSelected(rd.data)
        } catch {
          const updated = await incAPI.list({ page_size:100 })
          const items = updated.data.results || updated.data || []
          setSelected(items.find(i => i.id === selected.id) || null)
        }
      } catch(err2) { alert('Erreur upload: ' + (err2.message || String(err2))) }
    }
    input.click()
  }

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9,
    padding:'10px 12px', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  const exportCSV = (filteredList) => {
    const headers = ['ID','Titre','Description','Catégorie','Priorité','Statut','Résidence','Bloc','Déclaré par','Assigné à','Date déclaration','Échéance SLA','SLA dépassé']
    const rows = filteredList.map(inc => [
      inc.id,
      '"' + (inc.titre||'').replace(/"/g,'""') + '"',
      '"' + (inc.description||'').replace(/"/g,'""') + '"',
      inc.categorie||'',
      inc.priorite||'',
      inc.statut||'',
      inc.residence||'',
      inc.bloc||'',
      inc.auteur_nom||'',
      inc.assigne_nom||'Non assigné',
      inc.date_creation ? new Date(inc.date_creation).toLocaleString('fr-FR') : '',
      inc.sla_echeance ? new Date(inc.sla_echeance).toLocaleString('fr-FR') : '',
      inc.sla_depasse ? 'OUI' : 'NON'
    ])
    const csv = [headers.join(';'), ...rows.map(r=>r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'incidents_' + new Date().toISOString().slice(0,10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTemplate = () => {
    const csv = 'titre;description;residence;categorie;priorite;bloc\n' +
      'Fuite d\'eau salle de bain;Fuite sous le lavabo;B1;Plomberie;haute;Chambre 101\n' +
      'Climatisation en panne;L\'unité ne démarre plus;B2;Climatisation;moyenne;Chambre 205\n' +
      'Porte bloquée;Serrure coincée;B3;Serrurerie;basse;Chambre 310'
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download='template_incidents.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const importCSV = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.csv,.txt'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const lines = text.split('\n').filter(l=>l.trim())
      if (lines.length < 2) { alert('CSV vide ou invalide'); return }
      // Détecter séparateur
      const sep = lines[0].includes(';') ? ';' : ','
      const headers = lines[0].split(sep).map(h=>h.trim().replace(/["﻿]/g,'').toLowerCase())
      const getCol = (row, names) => {
        for (const n of names) {
          const idx = headers.findIndex(h=>h.includes(n))
          if (idx>=0) return row[idx]?.replace(/^"|"$/g,'').trim() || ''
        }
        return ''
      }
      let imported=0, errors=[]
      for (let i=1; i<lines.length; i++) {
        const row = lines[i].split(sep)
        const titre = getCol(row,['titre','title'])
        const description = getCol(row,['description','desc'])
        const residence = getCol(row,['residence','résidence'])
        const categorie = getCol(row,['catégorie','categorie','category']) || 'Autre'
        const priorite = getCol(row,['priorité','priorite','priority']) || 'moyenne'
        if (!titre || !description || !residence) { errors.push(`Ligne ${i+1}: titre/description/résidence requis`); continue }
        try {
          await incAPI.declarer({ titre, description, residence, categorie, priorite, bloc: getCol(row,['bloc','chambre']) })
          imported++
        } catch(err) {
          errors.push(`Ligne ${i+1}: ${err.response?.data?.detail||err.message}`)
        }
      }
      alert(`✅ ${imported} incident(s) importé(s)${errors.length ? '\n\n⚠️ Erreurs:\n'+errors.slice(0,5).join('\n') : ''}`)
      load()
    }
    input.click()
  }

  const exportIncident = (inc) => {
    const cmts = (inc.commentaires || []).map(c => {
      const d = c.date_creation ? new Date(c.date_creation).toLocaleString('fr-FR') : ''
      const ph = c.photo_base64 && c.photo_base64.length > 10
        ? '<img style="max-width:100%;max-height:180px;border-radius:6px" src="data:image/jpeg;base64,' + c.photo_base64 + '"/>'
        : ''
      return '<div style="border-left:3px solid var(--rzc-navy);padding:8px;margin:8px 0">' +
        '<strong>' + c.type_comment + '</strong> — ' + (c.auteur_nom || '') + ' — ' + d +
        '<p>' + c.contenu + '</p>' + ph + '</div>'
    }).join('')
    const ph_decl = inc.photo_base64 && inc.photo_base64.length > 10
      ? '<h2>Photo déclaration</h2><img style="max-width:100%;max-height:200px" src="data:' + inc.photo_mime + ';base64,' + inc.photo_base64 + '"/>'
      : ''
    const html = '<!DOCTYPE html><html><head><title>Incident #' + inc.id + '</title>' +
      '<style>body{font-family:Arial,sans-serif;max-width:800px;margin:20px auto;padding:0 20px}' +
      'table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}' +
      'th{background:#eef2f7}h2{color:var(--rzc-navy)}</style></head><body>' +
      '<h2>Rapport Incident #' + inc.id + ' — ' + inc.titre + '</h2><table>' +
      '<tr><th>Catégorie</th><td>' + inc.categorie + '</td><th>Priorité</th><td>' + inc.priorite + '</td></tr>' +
      '<tr><th>Statut</th><td>' + inc.statut + '</td><th>Résidence</th><td>' + inc.residence + ' ' + (inc.bloc || '') + '</td></tr>' +
      '<tr><th>Déclaré par</th><td>' + (inc.auteur_nom || '?') + '</td><th>Assigné à</th><td>' + (inc.assigne_nom || 'Non assigné') + '</td></tr>' +
      '<tr><th>Déclaration</th><td>' + (inc.date_creation ? new Date(inc.date_creation).toLocaleString('fr-FR') : '?') + '</td>' +
      '<th>SLA</th><td>' + (inc.sla_echeance ? new Date(inc.sla_echeance).toLocaleString('fr-FR') : 'N/A') + '</td></tr>' +
      '</table><p>' + inc.description + '</p>' + ph_decl +
      '<h2>Historique (' + (inc.commentaires || []).length + ' entrées)</h2>' + cmts + '</body></html>'
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 500)
  }

  return (
    <MaintenanceBoundary>
      <div className="rzc-page-scope" style={{ padding:20 }}>

        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <h2 style={{ fontSize:22, fontWeight:900, color:'var(--rzc-navy)', margin:0 }}>
              🔧 Maintenance
            </h2>
            <p style={{ fontSize:11, color:'#64748b', margin:'3px 0 0' }}>
              Workflow · SLA · Assignation · Historique
            </p>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowPeriodeModal(true)}
              style={{ background:'var(--rzc-green)', color:'#fff', border:'none',
                padding:'10px 20px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                display:'flex', alignItems:'center', gap:6 }}>
              📄 Rapport PDF
            </button>
            <button onClick={() => { setForm(EMPTY); setErr(''); setShowNew(true) }}
              style={{ background:'var(--rzc-navy)', color:'#fff', border:'none',
                padding:'10px 20px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              + Déclarer un incident
            </button>
          </div>
        </div>

        {/* ── KPIs enrichis ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:12 }}>
          {[
            ['📢','Déclarés',    stats.declare||0,   '#3b82f6','#eff6ff'],
            ['👷','Assignés',    stats.assigne||0,   '#f97316','#fff7ed'],
            ['⚙️','En cours',   stats.en_cours||0,  '#eab308','#fefce8'],
            ['✅','Résolus',     stats.resolu||0,    '#16a34a','#f0fdf4'],
            ['⚠️','SLA dépassé',stats.sla_depasse||0,'#dc2626','#fee2e2'],
            ['🔴','Critiques',  stats.critique||0,  '#7c3aed','#f5f3ff'],
          ].map(([ic,l,v,c,bg]) => (
            <div key={l} style={{ background:bg, borderRadius:12, padding:'12px 14px',
              borderLeft:`3px solid ${c}`, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{ic}</div>
              <div style={{ fontSize:22, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:10, color:'#64748b', fontWeight:600, marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* ── KPIs avancés (calcul local) ── */}
        {incidents.length > 0 && (() => {
          const now = Date.now()
          const ouverts = incidents.filter(i=>!['resolu','cloture','annule'].includes(i.statut))
          // Durée moy. résolution
          const resolved = incidents.filter(i=>['resolu','cloture'].includes(i.statut)&&i.date_creation)
          const avgDays = resolved.length ? (resolved.reduce((s,i)=>{
            const end = i.date_resolution ? new Date(i.date_resolution) : new Date()
            return s + (end - new Date(i.date_creation))/86400000
          },0)/resolved.length).toFixed(1) : null
          // Plus vieux ouvert
          const oldest = ouverts.length ? ouverts.reduce((a,b)=>
            new Date(a.date_creation)<new Date(b.date_creation)?a:b
          ) : null
          const oldestDays = oldest ? Math.round((now-new Date(oldest.date_creation))/86400000) : null
          // Répartition catégories
          const byCat = {}
          incidents.forEach(i=>{ if(i.categorie) byCat[i.categorie]=(byCat[i.categorie]||0)+1 })
          const topCats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,4)
          // Taux résolution
          const tauxRes = incidents.length ? Math.round((resolved.length/incidents.length)*100) : 0

          return (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10, marginBottom:20 }}>
              <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #e2e8f0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>⏱️ Durée moy. résolution</div>
                <div style={{ fontSize:26, fontWeight:900, color:'#7c3aed' }}>{avgDays ? `${avgDays}j` : '—'}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{resolved.length} incident(s) résolu(s)</div>
              </div>
              <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #e2e8f0',
                borderLeft: oldestDays&&oldestDays>7 ? '3px solid #dc2626' : '1px solid #e2e8f0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>🕰️ Plus vieux ouvert</div>
                <div style={{ fontSize:26, fontWeight:900, color: oldestDays&&oldestDays>7?'#dc2626':'#ea580c' }}>{oldestDays != null ? `${oldestDays}j` : '—'}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{oldest?.titre?.slice(0,30)||'—'}</div>
              </div>
              <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #e2e8f0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>✅ Taux de résolution</div>
                <div style={{ fontSize:26, fontWeight:900, color: tauxRes>=70?'#16a34a':'#ea580c' }}>{tauxRes}%</div>
                <div style={{ height:5, background:'#f1f5f9', borderRadius:99, marginTop:6, overflow:'hidden' }}>
                  <div style={{ width:`${tauxRes}%`, height:'100%', background:tauxRes>=70?'#16a34a':'#ea580c', borderRadius:99, transition:'width .5s' }}/>
                </div>
              </div>
              <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', border:'1px solid #e2e8f0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>📊 Top catégories</div>
                {topCats.map(([cat,n])=>(
                  <div key={cat} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                    <span style={{ fontSize:11, color:'#374151', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat}</span>
                    <div style={{ height:5, width:60, background:'#f1f5f9', borderRadius:99, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ width:`${Math.round(n/incidents.length*100)}%`, height:'100%', background:'var(--rzc-navy)', borderRadius:99 }}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:'var(--rzc-navy)', flexShrink:0 }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── KPIs complémentaires : priorité, charge technicien, top résidences ── */}
        {incidents.length > 0 && (() => {
          const { byPrioFull, prioTotal, topTechs, topResidences, tauxCritResolu } = kpisComplementaires
          const PRIO_COLORS = { critique:'#DC2626', haute:'#D4A017', moyenne:'#2563EB', basse:'#16A34A' }
          const PRIO_LABELS = { critique:'Critique', haute:'Haute', moyenne:'Moyenne', basse:'Basse' }

          return (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:14, marginBottom:20 }}>

              {/* Répartition par priorité */}
              <div className="rzc-card" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'var(--rzc-navy)', margin:'0 0 12px' }}>🎯 Par priorité</h3>
                {prioTotal === 0 ? (
                  <p style={{ textAlign:'center', color:'var(--rzc-text-3)', fontSize:12, padding:'20px 0' }}>Aucune donnée</p>
                ) : Object.entries(byPrioFull).filter(([,n])=>n>0).map(([k,n]) => (
                  <div key={k} style={{ marginBottom:9 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:11.5, color:'var(--rzc-text-2)' }}>{PRIO_LABELS[k]}</span>
                      <span style={{ fontSize:11.5, fontWeight:700, color:PRIO_COLORS[k] }}>{n} ({Math.round(n/prioTotal*100)}%)</span>
                    </div>
                    <div style={{ height:6, background:'rgba(15,26,46,.06)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ width:`${n/prioTotal*100}%`, height:'100%', background:PRIO_COLORS[k], borderRadius:99 }}/>
                    </div>
                  </div>
                ))}
                {tauxCritResolu !== null && (
                  <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--rzc-border)' }}>
                    <span style={{ fontSize:11, color:'var(--rzc-text-3)' }}>Critiques résolus : </span>
                    <span style={{ fontSize:13, fontWeight:700, color: tauxCritResolu>=80?'#15803D':'#DC2626' }}>{tauxCritResolu}%</span>
                  </div>
                )}
              </div>

              {/* Charge par technicien */}
              <div className="rzc-card" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'var(--rzc-navy)', margin:'0 0 12px' }}>👷 Charge par technicien</h3>
                {topTechs.length === 0 ? (
                  <p style={{ textAlign:'center', color:'var(--rzc-text-3)', fontSize:12, padding:'20px 0' }}>Aucune assignation</p>
                ) : topTechs.map(([nom,n]) => (
                  <div key={nom} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <span style={{ fontSize:11.5, color:'var(--rzc-text-2)', flex:1, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nom}</span>
                    <div style={{ height:6, width:70, background:'rgba(15,26,46,.06)', borderRadius:99, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ width:`${Math.round(n/topTechs[0][1]*100)}%`, height:'100%', background:'var(--rzc-navy)', borderRadius:99 }}/>
                    </div>
                    <span style={{ fontSize:11.5, fontWeight:700, color:'var(--rzc-navy)', flexShrink:0, minWidth:18, textAlign:'right' }}>{n}</span>
                  </div>
                ))}
              </div>

              {/* Top résidences à incidents */}
              <div className="rzc-card" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'var(--rzc-navy)', margin:'0 0 12px' }}>🏠 Résidences les + touchées</h3>
                {topResidences.length === 0 ? (
                  <p style={{ textAlign:'center', color:'var(--rzc-text-3)', fontSize:12, padding:'20px 0' }}>Aucune donnée</p>
                ) : topResidences.map(([res,n]) => (
                  <div key={res} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                    <span style={{ fontSize:11.5, color:'var(--rzc-text-2)', flex:1, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{res}</span>
                    <div style={{ height:6, width:70, background:'rgba(15,26,46,.06)', borderRadius:99, overflow:'hidden', flexShrink:0 }}>
                      <div style={{ width:`${Math.round(n/topResidences[0][1]*100)}%`, height:'100%', background:'var(--rzc-ore-gold)', borderRadius:99 }}/>
                    </div>
                    <span style={{ fontSize:11.5, fontWeight:700, color:'var(--rzc-ore-gold)', flexShrink:0, minWidth:18, textAlign:'right' }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── Graphiques visuels à l'écran (camembert, histogramme, courbe) ── */}
        {incidents.length > 0 && (() => {
          const { pieData, pieTotal, catData, maxCatVal, monthData, maxMonthVal } = chartsData

          // ── Camembert SVG (statuts) ──
          let pieAngle = -Math.PI / 2
          const pieR = 70, pieCx = 90, pieCy = 90
          const pieSlices = pieData.map(([lbl, n, color]) => {
            const slice = pieTotal ? (n / pieTotal) * Math.PI * 2 : 0
            const x1 = pieCx + pieR * Math.cos(pieAngle), y1 = pieCy + pieR * Math.sin(pieAngle)
            pieAngle += slice
            const x2 = pieCx + pieR * Math.cos(pieAngle), y2 = pieCy + pieR * Math.sin(pieAngle)
            const large = slice > Math.PI ? 1 : 0
            const pct = pieTotal ? Math.round(n / pieTotal * 100) : 0
            return { lbl, n, color, pct, d: `M${pieCx},${pieCy} L${x1.toFixed(1)},${y1.toFixed(1)} A${pieR},${pieR} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z` }
          })

          const barW = Math.min(38, Math.floor(300 / Math.max(catData.length, 1)))
          const ROXGOLD_BARS = ['#0F2A5C','#2563EB','#D4A017','#B87333','#16A34A','#DC2626','#5B6472','#7C3AED']

          return (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
              gap:14, marginBottom:20 }}>

              {/* Camembert statuts */}
              <div className="rzc-card" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'var(--rzc-navy)', margin:'0 0 12px' }}>🥧 Répartition par statut</h3>
                {pieTotal === 0 ? (
                  <p style={{ textAlign:'center', color:'var(--rzc-text-3)', fontSize:12, padding:'30px 0' }}>Aucune donnée</p>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    <svg width={180} height={180} viewBox="0 0 180 180" style={{ flexShrink:0 }}>
                      {pieSlices.map((s,i) => <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth={2} />)}
                    </svg>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, minWidth:0 }}>
                      {pieSlices.map((s,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ width:9, height:9, borderRadius:'50%', background:s.color, flexShrink:0 }} />
                          <span style={{ fontSize:11.5, color:'var(--rzc-text-2)', whiteSpace:'nowrap' }}>{s.lbl}</span>
                          <span style={{ fontSize:11.5, fontWeight:700, color:s.color, marginLeft:'auto' }}>{s.n} ({s.pct}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Histogramme catégories */}
              <div className="rzc-card" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'var(--rzc-navy)', margin:'0 0 12px' }}>📊 Incidents par catégorie</h3>
                {catData.length === 0 ? (
                  <p style={{ textAlign:'center', color:'var(--rzc-text-3)', fontSize:12, padding:'30px 0' }}>Aucune donnée</p>
                ) : (
                  <svg width="100%" height={150} style={{maxHeight:150}} viewBox={`0 0 ${catData.length*(barW+10)+20} 170`} preserveAspectRatio="xMinYMid meet">
                    {catData.map(([cat,n],i) => {
                      const h = Math.round((n/maxCatVal)*120)
                      const x = i*(barW+10)+10
                      const color = ROXGOLD_BARS[i % ROXGOLD_BARS.length]
                      return (
                        <g key={cat}>
                          <rect x={x} y={140-h} width={barW} height={h} fill={color} rx={4} />
                          <text x={x+barW/2} y={155} textAnchor="middle" fontSize="9" fill="var(--rzc-text-3)">{cat.slice(0,9)}</text>
                          <text x={x+barW/2} y={134-h} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{n}</text>
                        </g>
                      )
                    })}
                  </svg>
                )}
              </div>

              {/* Courbe mensuelle */}
              <div className="rzc-card" style={{ padding:'16px 18px' }}>
                <h3 style={{ fontSize:13, fontWeight:700, color:'var(--rzc-navy)', margin:'0 0 12px' }}>📈 Évolution mensuelle</h3>
                {monthData.length < 2 ? (
                  <p style={{ textAlign:'center', color:'var(--rzc-text-3)', fontSize:12, padding:'30px 0' }}>Données insuffisantes (minimum 2 mois)</p>
                ) : (
                  <svg width="100%" height={150} style={{maxHeight:150}} viewBox="0 0 380 170" preserveAspectRatio="xMinYMid meet">
                    {(() => {
                      const pts = monthData.map(([,n],i) => ({
                        x: 20 + i*(340/(monthData.length-1)),
                        y: 130 - Math.round((n/maxMonthVal)*110),
                      }))
                      return (
                        <>
                          <polyline points={pts.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--rzc-navy)" strokeWidth={2.5} />
                          {pts.map((p,i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r={4} fill="var(--rzc-ore-gold)" />
                              <text x={p.x} y={p.y-10} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--rzc-navy)">{monthData[i][1]}</text>
                              <text x={p.x} y={148} textAnchor="middle" fontSize="9" fill="var(--rzc-text-3)">{monthData[i][0]}</text>
                            </g>
                          ))}
                        </>
                      )
                    })()}
                  </svg>
                )}
              </div>
            </div>
          )
        })()}

        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:'#64748b',fontWeight:600}}>
          <input type="checkbox"
            checked={selIds.size===filtered.length && filtered.length>0}
            onChange={e=>setSelIds(e.target.checked ? new Set(filtered.map(i=>i.id)) : new Set())}
            style={{width:16,height:16,accentColor:'var(--rzc-navy)',cursor:'pointer'}}/>
          Tout sélectionner
        </label>
        <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Rechercher..."
            style={{ ...inp, maxWidth:220 }} />
          <select value={statFilter} onChange={e=>setStatFilter(e.target.value)} style={{ ...inp, maxWidth:130 }}>
            <option value="">Actifs (hors clôturés)</option>
            <option value="cloture">Clôturés</option>
            {Object.entries(STATUTS).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <select value={prioFilter} onChange={e=>setPrioFilter(e.target.value)} style={{ ...inp, maxWidth:130 }}>
            <option value="">Toutes priorités</option>
            {Object.entries(PRIOS).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6,
            fontSize:12, fontWeight:700, color:'#dc2626', cursor:'pointer' }}>
            <input type="checkbox" checked={slaOnly} onChange={e=>setSlaOnly(e.target.checked)} />
            ⚠️ SLA dépassé
          </label>
          <input type="date" value={dateDebut} onChange={e=>setDateDebut(e.target.value)}
            title="Date début"
            style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px', fontSize:12, fontFamily:'inherit' }}/>
          <input type="date" value={dateFin} onChange={e=>setDateFin(e.target.value)}
            title="Date fin"
            style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'6px 10px', fontSize:12, fontFamily:'inherit' }}/>
          <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
            <button onClick={()=>downloadTemplate()}
              style={{ background:'#7c3aed', color:'#fff', border:'none',
                padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              📋 Template
            </button>
            <button onClick={()=>importCSV()}
              style={{ background:'#2563eb', color:'#fff', border:'none',
                padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              📤 Import CSV
            </button>
            <button onClick={()=>exportCSV(filtered)}
              style={{ background:'#16a34a', color:'#fff', border:'none',
                padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
              📥 Export CSV ({filtered.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60, fontSize:32 }}>⏳</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔧</div>
            <div style={{ fontWeight:600 }}>Aucun incident</div>
            <div style={{ fontSize:12 }}>Cliquer sur "Déclarer un incident"</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(inc => {
              const st = STATUTS[inc.statut] || STATUTS.declare
              const pr = PRIOS[inc.priorite] || PRIOS.moyenne
              const wfIdx = WF.findIndex(x => x.s === inc.statut)
              return (
                <div key={inc.id}
                  style={{ position:'relative', background:'#fff', borderRadius:12, padding:'14px 16px',
                    boxShadow:'0 1px 4px rgba(0,0,0,.07)', cursor:'pointer',
                    borderLeft:`4px solid ${st.c}`,
                    outline: selected?.id === inc.id ? `2px solid ${st.c}` : 'none' }}
                  onClick={async() => {
                    setSelected(inc)
                    try {
                      const r = await incAPI.detail(inc.id)
                      setSelected(r.data)
                    } catch(e) { console.warn('detail load failed', e) }
                  }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#1e293b', marginBottom:3 }}>
                        {inc.titre}
                        {inc.sla_depasse && <span style={{ background:'#fef2f2', color:'#dc2626',
                          fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99, marginLeft:8 }}>SLA ⚠️</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#64748b' }}>
                        📍 {inc.residence}{inc.bloc ? ` · ${inc.bloc}` : ''} · {inc.categorie} · {inc.auteur_nom}
                      </div>
                      <div style={{ fontSize:11, color:'#94a3b8', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' }}>
                        <span>📅 {inc.date_creation ? new Date(inc.date_creation).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}) : '—'}</span>
                        {inc.sla_echeance && <span style={{color: new Date(inc.sla_echeance)<new Date()?'#dc2626':'#64748b'}}>⏳ SLA: {new Date(inc.sla_echeance).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span>}
                        {inc.assigne_nom && <span>👷 {inc.assigne_nom}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
                      <span style={{ background:pr.c+'20', color:pr.c, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>{pr.l}</span>
                      <span style={{ background:st.bg, color:st.c, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>{st.l}</span>
                      {isAdmin && (
                        <>
                          <input type="checkbox"
                            checked={selIds.has(inc.id)}
                            onChange={e=>{
                              e.stopPropagation()
                              setSelIds(prev=>{const next=new Set(prev);e.target.checked?next.add(inc.id):next.delete(inc.id);return next})
                            }}
                            onClick={e=>e.stopPropagation()}
                            style={{width:16,height:16,cursor:'pointer',accentColor:'var(--rzc-navy)'}}/>
                          <button onClick={e=>{e.stopPropagation();setEditInc({...inc});setShowEdit(true)}}
                            title="Modifier l'incident"
                            style={{ background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',
                              padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700 }}>
                            ✏️
                          </button>
                          <button onClick={e=>{e.stopPropagation();
                            if(window.confirm(`Supprimer l'incident "${inc.titre}" ?`))
                              incAPI.supprimer(inc.id).then(()=>load()).catch(e=>alert('Erreur suppression: '+(e.response?.data?.detail||e.message||'inconnue')))
                          }}
                            title="Supprimer l'incident"
                            style={{ background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',
                              padding:'3px 8px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700 }}>
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:0, marginTop:10 }}>
                    {WF.map((w,i) => (
                      <React.Fragment key={w.s}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:50 }}>
                          <div style={{ width:24, height:24, borderRadius:'50%',
                            background: i<=wfIdx ? st.c : '#e2e8f0',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:10, fontWeight:900, color: i<=wfIdx ? '#fff' : '#94a3b8' }}>
                            {i<=wfIdx ? (i===wfIdx ? w.icon : '✓') : i+1}
                          </div>
                          <div style={{ fontSize:8, color: i<=wfIdx ? st.c : '#94a3b8', marginTop:2 }}>{w.l}</div>
                        </div>
                        {i < WF.length-1 && <div style={{ flex:1, height:2,
                          background: i<wfIdx ? st.c : '#e2e8f0', marginBottom:16, minWidth:8 }}/>}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ══ MODAL DÉCLARER ══ */}
        {showNew && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520,
              maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,var(--rzc-navy),#2563eb)', color:'#fff',
                padding:'14px 20px', position:'sticky', top:0, display:'flex',
                justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:15 }}>🔧 Déclarer un incident</div>
                <button onClick={()=>setShowNew(false)}
                  style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                    width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                {err && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:8,
                  padding:'8px 12px', color:'#dc2626', fontSize:12 }}>❌ {err}</div>}
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>TITRE *</label>
                  <input value={form.titre} onChange={e=>setForm({...form,titre:e.target.value})}
                    placeholder="Titre de l'incident..." style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION *</label>
                  <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                    placeholder="Décrivez le problème..." rows={3} style={{ ...inp, resize:'vertical' }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>CATÉGORIE</label>
                    <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})} style={inp}>
                      {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>PRIORITÉ</label>
                    <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={inp}>
                      {Object.entries(PRIOS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>RÉSIDENCE *</label>
                    <input value={form.residence} onChange={e=>setForm({...form,residence:e.target.value})}
                      placeholder="Sélectionner ou saisir..." style={inp} list="res-list"/>
                    <datalist id="res-list">
                      {(residences.length>0 ? residences
                        : [...new Set(incidents.map(i=>i.residence).filter(Boolean))]
                      ).map(r=><option key={r} value={r}/>)}
                    </datalist>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>BLOC / CHAMBRE</label>
                    <input value={form.bloc} onChange={e=>setForm({...form,bloc:e.target.value})}
                      placeholder="Ex: Bloc 3, Ch. 12" style={inp}/>
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                  background: form.photo_b64 ? '#f0fdf4' : '#f8fafc',
                  border: `2px dashed ${form.photo_b64 ? '#16a34a' : '#e2e8f0'}`,
                  borderRadius:10, cursor:'pointer', fontSize:12,
                  color: form.photo_b64 ? '#16a34a' : '#64748b' }}>
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e=>{
                      const file=e.target.files?.[0]
                      if(!file) return
                      if(file.size>3*1024*1024){alert('Max 3Mo');return}
                      const r=new FileReader()
                      r.onload=ev=>setForm(f=>({...f,photo_b64:ev.target.result}))
                      r.readAsDataURL(file)
                    }}/>
                  {form.photo_b64 ? '✅ Photo ajoutée' : '📷 Photo (optionnel, max 3Mo)'}
                </label>
                <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8,
                  padding:'8px 12px', fontSize:11, color:'#92400e' }}>
                  ⏱️ SLA assigné automatiquement selon la priorité
                </div>
                <button onClick={declarer} disabled={submitting}
                  style={{ background:submitting?'#94a3b8':'var(--rzc-navy)', color:'#fff', border:'none',
                    padding:13, borderRadius:10, cursor:submitting?'wait':'pointer',
                    fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                  {submitting ? '⏳ Envoi...' : '🔧 Déclarer l\'incident'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ DETAIL INCIDENT (slide-over) ══ */}
        {selected && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.5)',
            display:'flex', alignItems:'center', justifyContent:'flex-end', zIndex:900 }}
            onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
            <div style={{ background:'#fff', width:'100%', maxWidth:460,
              height:'100%', overflow:'auto', boxShadow:'-4px 0 30px rgba(0,0,0,.2)' }}>
              <div style={{ background:`linear-gradient(135deg,${STATUTS[selected.statut]?.c||'var(--rzc-navy)'},var(--rzc-navy))`,
                color:'#fff', padding:'14px 16px', position:'sticky', top:0, zIndex:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{selected.titre}</div>
                    <div style={{ fontSize:11, opacity:.8, marginTop:2 }}>{selected.residence} · {selected.categorie}</div>
                  </div>
                  
                  <button onClick={()=>exportIncident(selected)}
                    title="Imprimer / Exporter"
                    style={{ background:'rgba(240,165,0,.3)', border:'none', color:'#fff',
                      padding:'3px 8px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, marginRight:4 }}>
                    🖨️
                  </button>
                  <button onClick={()=>setSelected(null)}
                    style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                      width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', marginTop:10, gap:0 }}>
                  {WF.map((w,i)=>{
                    const idx=WF.findIndex(x=>x.s===selected.statut)
                    const done=i<=idx
                    return (
                      <React.Fragment key={w.s}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ width:26, height:26, borderRadius:'50%',
                            background: done?'rgba(255,255,255,.9)':'rgba(255,255,255,.2)',
                            color: done?(STATUTS[selected.statut]?.c||'var(--rzc-navy)'):'rgba(255,255,255,.4)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:11, fontWeight:700 }}>
                            {done?(i===idx?w.icon:'✓'):i+1}
                          </div>
                          <div style={{ fontSize:8, color:'rgba(255,255,255,.6)', marginTop:2 }}>{w.l}</div>
                        </div>
                        {i<WF.length-1 && <div style={{ flex:1, height:2,
                          background: i<idx?'rgba(255,255,255,.7)':'rgba(255,255,255,.2)',
                          marginBottom:16, minWidth:8 }}/>}
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>

              <div style={{ padding:16 }}>
                <div style={{ background:'#f8fafc', borderRadius:10, padding:12, marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION</div>
                  <div style={{ fontSize:13 }}>{selected.description}</div>
                  {selected.photo_base64 && String(selected.photo_base64).length>10 && (
                    <img
                      src={`data:${selected.photo_mime||'image/jpeg'};base64,${String(selected.photo_base64).replace(/^data:[^;]+;base64,/,'')}`}
                      alt="Photo" style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:8, marginTop:8, cursor:'pointer' }}
                      onClick={()=>window.open('data:image/jpeg;base64,'+String(selected.photo_base64).replace(/^data:[^;]+;base64,/,''),'_blank')}
                      onError={e=>{e.target.style.display='none'}}/>
                  )}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  {/* Timeline parcours */}
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Parcours</div>
                    <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto', paddingBottom:4 }}>
                      {[
                        {s:'declare', label:'Déclaré', icon:'📢', date: selected.date_creation},
                        {s:'assigne', label:'Assigné', icon:'👷', date: selected.date_assignation},
                        {s:'en_cours', label:'En cours', icon:'⚙️', date: selected.date_debut},
                        {s:'resolu', label:'Résolu', icon:'✅', date: selected.date_resolution},
                        {s:'cloture', label:'Clôturé', icon:'🔒', date: selected.date_cloture},
                      ].map((step, i, arr) => {
                        const statuts = ['declare','assigne','en_cours','resolu','cloture']
                        const curIdx = statuts.indexOf(selected.statut)
                        const stepIdx = statuts.indexOf(step.s)
                        const done = stepIdx <= curIdx
                        const active = step.s === selected.statut
                        return (
                          <div key={step.s} style={{ display:'flex', alignItems:'center', flex: i < arr.length-1 ? 1 : 'none', minWidth: i < arr.length-1 ? 60 : 'auto' }}>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:52 }}>
                              <div style={{ width:32, height:32, borderRadius:'50%',
                                background: active ? 'var(--rzc-navy)' : done ? '#16a34a' : '#f1f5f9',
                                border: active ? '2px solid #f0a500' : done ? '2px solid #16a34a' : '2px solid #e2e8f0',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:14, boxShadow: active ? '0 0 0 3px rgba(240,165,0,.2)' : 'none',
                                transition:'all .2s' }}>
                                {done ? (active ? step.icon : '✓') : <span style={{color:'#cbd5e1',fontSize:11}}>{i+1}</span>}
                              </div>
                              <div style={{ fontSize:9, fontWeight: active?700:500, color: active?'var(--rzc-navy)':done?'#16a34a':'#94a3b8', textAlign:'center', lineHeight:1.2 }}>{step.label}</div>
                              {step.date && <div style={{ fontSize:8, color:'#94a3b8', textAlign:'center' }}>{new Date(step.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</div>}
                            </div>
                            {i < arr.length-1 && <div style={{ flex:1, height:2, background: stepIdx < curIdx ? '#16a34a' : '#e2e8f0', margin:'0 2px', marginBottom:18, transition:'background .3s' }}/>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {[['Priorité',PRIOS[selected.priorite]?.l||selected.priorite],
                    ['Statut',STATUTS[selected.statut]?.l||selected.statut],
                    ['Déclaré par',selected.auteur_nom||'?'],
                    ['Assigné à',selected.assigne_nom||'Non assigné'],
                    ['📅 Déclaration', selected.date_creation ? new Date(selected.date_creation).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '?'],
                    ['⏰ Échéance SLA', selected.sla_echeance ? new Date(selected.sla_echeance).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'N/A'],
                    ['⏱️ Durée tâche', (() => {
                      const start = selected.date_debut || selected.date_creation
                      const end = selected.date_resolution || selected.date_cloture || (selected.statut==='en_cours'?new Date().toISOString():null)
                      if (!start || !end) return 'En attente'
                      const h = Math.round((new Date(end)-new Date(start))/3600000)
                      return h < 24 ? `${h}h` : `${Math.floor(h/24)}j ${h%24}h`
                    })()],
                  ].map(([k,v])=>(
                    <div key={k} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 10px' }}>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:2 }}>{k}</div>
                      <div style={{ fontSize:12, fontWeight:600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {isAdmin && selected.statut==='declare' && (
                  <button onClick={()=>{setActionModal('assigner');setActionTechId('')}}
                    style={{ width:'100%', background:'#f97316', color:'#fff', border:'none',
                      padding:11, borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      marginBottom:8, fontFamily:'inherit' }}>
                    👷 Assigner à un technicien
                  </button>
                )}
                {selected.statut==='assigne' && (
                  <button onClick={()=>setActionModal('commencer')}
                    style={{ width:'100%', background:'#eab308', color:'#fff', border:'none',
                      padding:11, borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      marginBottom:8, fontFamily:'inherit' }}>
                    ⚙️ Commencer l'intervention
                  </button>
                )}
                {selected.statut==='en_cours' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={()=>uploadPhoto('photo_avant')}
                        style={{ flex:1, background:'#f5f3ff', color:'#7c3aed',
                          border:'2px dashed #c4b5fd', padding:10, borderRadius:9,
                          cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
                        📷 Photo Avant
                      </button>
                      <button onClick={()=>uploadPhoto('photo_apres')}
                        style={{ flex:1, background:'#f0fdf4', color:'#16a34a',
                          border:'2px dashed #86efac', padding:10, borderRadius:9,
                          cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit' }}>
                        📷 Photo Après
                      </button>
                    </div>
                    {(() => {
                      const hasAvant = (selected.commentaires||[]).some(c=>c.type_comment==='photo_avant')
                      const hasApres = (selected.commentaires||[]).some(c=>c.type_comment==='photo_apres')
                      const canResolve = hasAvant && hasApres
                      return (
                        <div>
                          {!hasAvant && <div style={{fontSize:11,color:'#dc2626',background:'#fef2f2',
                            border:'1px solid #fecaca',borderRadius:7,padding:'5px 10px',marginBottom:5}}>
                            ⚠️ Photo AVANT requise
                          </div>}
                          {!hasApres && <div style={{fontSize:11,color:'#dc2626',background:'#fef2f2',
                            border:'1px solid #fecaca',borderRadius:7,padding:'5px 10px',marginBottom:5}}>
                            ⚠️ Photo APRÈS requise
                          </div>}
                          <button onClick={()=>canResolve&&setActionModal('resoudre')}
                            disabled={!canResolve}
                            title={!canResolve?'Photos avant et après obligatoires':'Marquer résolu'}
                            style={{ width:'100%', background:canResolve?'#16a34a':'#94a3b8', color:'#fff', border:'none',
                              padding:11, borderRadius:10, cursor:canResolve?'pointer':'not-allowed',
                              fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
                            ✅ Marquer résolu {!canResolve?'(photos requises)':''}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )}
                {isAdmin && selected.statut==='resolu' && (
                  <button onClick={()=>setActionModal('cloturer')}
                    style={{ width:'100%', background:'#64748b', color:'#fff', border:'none',
                      padding:11, borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700,
                      marginBottom:8, fontFamily:'inherit' }}>
                    🔒 Clôturer
                  </button>
                )}
                <button onClick={()=>setActionModal('commenter')}
                  style={{ width:'100%', background:'#f8fafc', color:'var(--rzc-navy)',
                    border:'1px solid #e2e8f0', padding:10, borderRadius:10, cursor:'pointer',
                    fontSize:12, fontWeight:700, marginBottom:14, marginTop:4, fontFamily:'inherit' }}>
                  💬 Commentaire
                </button>

                <div style={{ fontSize:12, fontWeight:700, color:'#64748b',
                  marginBottom:8, textTransform:'uppercase', letterSpacing:.5 }}>
                  Historique ({selected.commentaires?.length||0})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(selected.commentaires||[]).map(c=>{
                    const tc={info:'#64748b',assignation:'#2563eb',debut:'#f97316',
                      photo_avant:'#7c3aed',photo_apres:'#059669',resolution:'#16a34a',cloture:'#64748b'}[c.type_comment]||'#64748b'
                    return (
                      <div key={c.id} style={{ display:'flex', gap:8 }}>
                        <div style={{ width:3, borderRadius:99, background:tc, flexShrink:0 }}/>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                            <span style={{ fontSize:10, fontWeight:700, color:tc }}>{c.type_label||c.type_comment}</span>
                            <span style={{ fontSize:10, color:'#94a3b8' }}>{c.auteur_nom}</span>
                          </div>
                          <div style={{ fontSize:12, color:'#334155' }}>{c.contenu}</div>
                          {c.photo_base64 && String(c.photo_base64).length>10 && (
                            <img src={'data:image/jpeg;base64,'+String(c.photo_base64).replace(/^data:[^;]+;base64,/,'')}
                              alt="Photo" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8, marginTop:6, cursor:'pointer' }}
                              onClick={()=>window.open('data:image/jpeg;base64,'+String(c.photo_base64).replace(/^data:[^;]+;base64,/,''),'_blank')}
                              onError={e=>{e.target.style.display='none'}}/>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL MODIFIER INCIDENT ══ */}
        {showEdit && editInc && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200, padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setShowEdit(false)}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:520,
              maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,var(--rzc-navy),#2563eb)', color:'#fff',
                padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:15 }}>✏️ Modifier l'incident</div>
                <button onClick={()=>setShowEdit(false)}
                  style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                    width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>TITRE *</label>
                  <input value={editInc.titre} onChange={e=>setEditInc({...editInc,titre:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>DESCRIPTION *</label>
                  <textarea value={editInc.description} onChange={e=>setEditInc({...editInc,description:e.target.value})}
                    rows={3} style={{ ...inp, resize:'vertical' }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>CATÉGORIE</label>
                    <select value={editInc.categorie} onChange={e=>setEditInc({...editInc,categorie:e.target.value})} style={inp}>
                      {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>PRIORITÉ</label>
                    <select value={editInc.priorite} onChange={e=>setEditInc({...editInc,priorite:e.target.value})} style={inp}>
                      {Object.entries(PRIOS).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>RÉSIDENCE *</label>
                    <input value={editInc.residence} onChange={e=>setEditInc({...editInc,residence:e.target.value})} style={inp}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4 }}>BLOC / CHAMBRE</label>
                    <input value={editInc.bloc||''} onChange={e=>setEditInc({...editInc,bloc:e.target.value})} style={inp}/>
                  </div>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={async()=>{
                    try {
                      await incAPI.modifier(editInc.id, {
                        titre: editInc.titre, description: editInc.description,
                        categorie: editInc.categorie, priorite: editInc.priorite,
                        residence: editInc.residence, bloc: editInc.bloc||''
                      })
                      setShowEdit(false); load()
                    } catch(e) { alert(e.response?.data?.detail||'Erreur modification') }
                  }}
                    style={{ flex:1, background:'var(--rzc-navy)', color:'#fff', border:'none',
                      padding:12, borderRadius:10, cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                    💾 Enregistrer
                  </button>
                  <button onClick={()=>setShowEdit(false)}
                    style={{ background:'#f1f5f9', color:'#64748b', border:'1px solid #e2e8f0',
                      padding:12, borderRadius:10, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL ACTION ══ */}
        {actionModal && (
          <div style={{ position:'fixed', inset:0, background:'rgba(15,36,71,.7)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
            onClick={e=>e.target===e.currentTarget&&setActionModal(null)}>
            <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:420,
              overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ background:'linear-gradient(135deg,var(--rzc-navy),#2563eb)', color:'#fff',
                padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700 }}>
                  {{assigner:'👷 Assigner',commencer:'⚙️ Commencer',
                    resoudre:'✅ Résoudre',cloturer:'🔒 Clôturer',commenter:'💬 Commentaire'}[actionModal]}
                </div>
                <button onClick={()=>setActionModal(null)}
                  style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                    width:28, height:28, borderRadius:8, cursor:'pointer', fontSize:16 }}>✕</button>
              </div>
              <div style={{ padding:18, display:'flex', flexDirection:'column', gap:12 }}>
                {actionModal==='assigner' ? (
                  <select value={actionTechId} onChange={e=>setActionTechId(e.target.value)} style={inp}>
                    <option value="">-- Sélectionner un technicien --</option>
                    {techns.map(t=>(
                      <option key={t.id} value={t.id}>{t.first_name} {t.last_name} ({t.username})</option>
                    ))}
                  </select>
                ) : (
                  <textarea value={actionComment} onChange={e=>setActionComment(e.target.value)}
                    placeholder={actionModal==='commenter'?'Votre commentaire...':'Commentaire (optionnel)...'}
                    rows={3} style={{ ...inp, resize:'vertical' }}/>
                )}
                <button onClick={()=>doAction(actionModal)} disabled={submitting}
                  style={{ background:submitting?'#94a3b8':'var(--rzc-navy)', color:'#fff', border:'none',
                    padding:12, borderRadius:10, cursor:submitting?'wait':'pointer',
                    fontSize:14, fontWeight:700, fontFamily:'inherit' }}>
                  {submitting?'⏳...':'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL Période Rapport ── */}
      {showPeriodeModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',zIndex:3000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:400}}>
            <h3 style={{fontSize:16,fontWeight:800,color:'#0f172a',margin:'0 0 16px'}}>📄 Générer un rapport</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
              {['Cette semaine','Ce mois','Tout'].map((l,i)=>(
                <button key={l} onClick={()=>{
                  const n=new Date()
                  if(i===0){const d=new Date(n);d.setDate(n.getDate()-((n.getDay()||7)-1));setPeriodeRapport({debut:d.toISOString().slice(0,10),fin:n.toISOString().slice(0,10)})}
                  else if(i===1){setPeriodeRapport({debut:`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`,fin:n.toISOString().slice(0,10)})}
                  else setPeriodeRapport({debut:'',fin:''})
                }}
                  style={{background:'#eff6ff',color:'var(--rzc-navy)',border:'1px solid #bfdbfe',
                    borderRadius:8,padding:'8px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                  {l}
                </button>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['Du',  'debut'],['Au','fin']].map(([l,k])=>(
                  <div key={k}>
                    <label style={{fontSize:10,fontWeight:600,color:'#64748b',display:'block',marginBottom:3}}>{l}</label>
                    <input type="date" value={periodeRapport[k]||''}
                      onChange={e=>setPeriodeRapport(p=>({...p,[k]:e.target.value}))}
                      style={{width:'100%',height:36,border:'1.5px solid #e2e8f0',borderRadius:7,
                        padding:'0 8px',fontSize:12,outline:'none',color:'#0f172a'}}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{
                  const incP = incidents.filter(i=>{
                    if(periodeRapport.debut&&new Date(i.date_creation)<new Date(periodeRapport.debut)) return false
                    if(periodeRapport.fin&&new Date(i.date_creation)>new Date(periodeRapport.fin+'T23:59:59')) return false
                    return true
                  })
                  const html = genererRapport(incP, stats, periodeRapport)
                  const blob = new Blob([html],{type:'text/html;charset=utf-8'})
                  const url  = URL.createObjectURL(blob)
                  const a    = document.createElement('a')
                  a.href=url;a.target='_blank';a.rel='noopener'
                  document.body.appendChild(a);a.click()
                  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url)},500)
                  setShowPeriodeModal(false)
                }}
                style={{flex:1,background:'#059669',color:'#fff',border:'none',borderRadius:9,
                  padding:'10px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                📄 Générer le rapport
              </button>
              <button onClick={()=>setShowPeriodeModal(false)}
                style={{background:'#f1f5f9',color:'#374151',border:'none',borderRadius:9,
                  padding:'10px 14px',cursor:'pointer',fontSize:13}}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </MaintenanceBoundary>
  )
}