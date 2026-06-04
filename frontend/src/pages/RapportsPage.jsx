import { useState, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({ Authorization:`Bearer ${localStorage.getItem('access_token')||''}` })
const j = r => r.json()

function fmt(iso){ return iso ? new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}) : '—' }
function fmtShort(iso){ return iso ? new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '—' }

// ── Générateur HTML rapport ─────────────────────────────────────────
function buildHTML(d, periode) {
  const now    = new Date()
  const dateStr= now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
  const timeStr= now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
  const periodeStr = periode.debut
    ? `Du ${fmt(periode.debut)} au ${fmt(periode.fin||now.toISOString().slice(0,10))}`
    : 'Toutes périodes confondues'

  // Batiments
  const bat     = d.batiments_stats || {}
  const ps      = bat.par_statut || {}
  const occupes = ps['Occupé']     || 0
  const libres  = ps['Libre']      || 0
  const reserve = ps['Réservé']    || 0
  const maint   = ps['Maintenance']|| 0
  const taux    = bat.taux_occupation ?? '—'

  // Personnel
  const perso   = d.personnel || []
  const total_p = perso.length
  const induits = perso.filter(p=>p.inductionrecord?.statut==='valide').length
  const enCours = perso.filter(p=>p.inductionrecord?.statut==='en_cours').length
  const bySoc   = {}
  perso.forEach(p=>{ const s=p.societe||'Autre'; if(!bySoc[s]) bySoc[s]={total:0,induits:0}; bySoc[s].total++; if(p.inductionrecord?.statut==='valide') bySoc[s].induits++ })
  const societes = Object.entries(bySoc).sort((a,b)=>b[1].total-a[1].total)

  // Incidents
  const inc     = d.incidents_stats || {}
  const incidents_list = d.incidents || []
  const byCat   = {}; incidents_list.forEach(i=>{ if(i.categorie) byCat[i.categorie]=(byCat[i.categorie]||0)+1 })
  const byPrio  = {}; incidents_list.forEach(i=>{ if(i.priorite)  byPrio[i.priorite]=(byPrio[i.priorite]||0)+1 })

  // Résolution moy
  const resolus = incidents_list.filter(i=>['resolu','cloture'].includes(i.statut)&&i.date_creation)
  const avgDays = resolus.length ? (resolus.reduce((s,i)=>{
    const end = i.date_resolution ? new Date(i.date_resolution) : now
    return s+(end-new Date(i.date_creation))/86400000
  },0)/resolus.length).toFixed(1) : '—'

  // Voyages
  const voy_stats = d.voyages_stats || {}
  const voyages   = d.voyages || []

  // Articles / Stock
  const articles  = d.articles || []
  const val_stock = articles.reduce((s,a)=>s+(a.stock||0)*(a.prix||0),0)
  const en_rupture= articles.filter(a=>(a.stock||0)===0).length
  const stock_faible = articles.filter(a=>(a.stock||0)>0&&(a.stock||0)<=5).length
  const top_conso = [...articles].sort((a,b)=>(b.total_vendu||0)-(a.total_vendu||0)).slice(0,8)

  // Consommations
  const consos    = d.consommations || []
  const ca_total  = consos.reduce((s,c)=>s+(c.montant||0),0)

  // Barres SVG helper
  const maxBar = (arr,key) => Math.max(...arr.map(x=>x[1][key]||0), 1)
  const pctBar = (v,max) => Math.round(v/max*100)

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport Opérationnel Global — RZI Camp</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
@media print {
  .no-print{display:none!important}
  .page-break{page-break-before:always}
  body{margin:0;font-size:12px}
  h2{font-size:15px}
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;color:#0f172a;background:#fff;font-size:13px;line-height:1.5}

/* Header */
.header{background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#1d4ed8 100%);color:#fff;padding:36px 48px 28px}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
.header-logo{font-size:28px;font-weight:900;letter-spacing:-1px}
.header-badge{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;text-align:center}
.header h1{font-size:22px;font-weight:900;margin-bottom:6px}
.header p{font-size:12px;opacity:.75}
.header-meta{display:grid;grid-template-columns:repeat(3,auto);gap:24px;margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,.2)}
.header-meta-item label{font-size:10px;opacity:.6;text-transform:uppercase;letter-spacing:.5px;display:block}
.header-meta-item span{font-size:13px;font-weight:600}

/* Sections */
.section{padding:28px 48px;border-bottom:1px solid #e2e8f0}
.section:last-child{border-bottom:none}
.section-header{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.section-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.section-title{font-size:17px;font-weight:800;color:#0f172a}
.section-sub{font-size:12px;color:#64748b;margin-top:2px}

/* KPI Grid */
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.kpi{border-radius:12px;padding:16px;border-left:4px solid}
.kpi-val{font-size:28px;font-weight:900;line-height:1}
.kpi-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;opacity:.8}

/* Tables */
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:9px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;background:#f8fafc;border-bottom:2px solid #e2e8f0}
td{padding:9px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tr:hover td{background:#fafafa}
tr:last-child td{border-bottom:none}

/* Badge */
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:10px;font-weight:700}
.badge-green{background:#d1fae5;color:#065f46}
.badge-red{background:#fee2e2;color:#991b1b}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-orange{background:#ffedd5;color:#9a3412}
.badge-gray{background:#f1f5f9;color:#475569}
.badge-purple{background:#ede9fe;color:#4c1d95}

/* Barres */
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-label{font-size:12px;font-weight:500;width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
.bar-track{flex:1;height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden}
.bar-fill{height:100%;border-radius:99px}
.bar-val{font-size:11px;font-weight:700;width:40px;text-align:right;flex-shrink:0}

/* Alert */
.alert-box{padding:12px 16px;border-radius:10px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start;border-left:4px solid}
.alert-content p{font-size:12px;font-weight:600}
.alert-content span{font-size:11px;opacity:.7}

/* 2-col layout */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.card{background:#f8fafc;border-radius:12px;padding:16px}
.card h4{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}

/* Footer */
.footer{padding:20px 48px;background:#f8fafc;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0}

/* No-print */
.no-print{margin:16px 48px;display:flex;gap:10px}
.btn-print{background:#1e3a8a;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit}
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨️ Imprimer / Exporter PDF</button>
  <button onclick="window.close()" style="background:#f1f5f9;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px">✕ Fermer</button>
</div>

<!-- HEADER -->
<div class="header">
  <div class="header-top">
    <div>
      <div class="header-logo">⛏️ RZI CAMP ERP</div>
      <p style="opacity:.7;font-size:12px;margin-top:4px">Camp Résidentiel Roxgold Sango · Côte d'Ivoire</p>
    </div>
    <div class="header-badge">
      <div style="font-size:18px;margin-bottom:4px">📋</div>
      <div>RAPPORT OPÉRATIONNEL</div>
      <div style="font-size:10px;opacity:.7">GLOBAL</div>
    </div>
  </div>
  <h1>Rapport Opérationnel Global</h1>
  <p>${periodeStr}</p>
  <div class="header-meta">
    <div class="header-meta-item"><label>Généré le</label><span>${dateStr}</span></div>
    <div class="header-meta-item"><label>À</label><span>${timeStr}</span></div>
    <div class="header-meta-item"><label>Données</label><span>${total_p} membres · ${articles.length} articles · ${incidents_list.length} incidents</span></div>
  </div>
</div>

<!-- SYNTHÈSE EXÉCUTIVE -->
<div class="section">
  <div class="section-header">
    <div class="section-icon" style="background:#eff6ff">📊</div>
    <div><div class="section-title">Synthèse Exécutive</div><div class="section-sub">Vue d'ensemble de toutes les opérations</div></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi" style="background:#eff6ff;border-color:#3b82f6">
      <div class="kpi-val" style="color:#1e3a8a">${taux}%</div>
      <div class="kpi-label" style="color:#3b82f6">Taux d'occupation</div>
    </div>
    <div class="kpi" style="background:#f0fdf4;border-color:#16a34a">
      <div class="kpi-val" style="color:#166534">${total_p}</div>
      <div class="kpi-label" style="color:#16a34a">Personnel actif</div>
    </div>
    <div class="kpi" style="background:${inc.critique>0?'#fee2e2':'#f0fdf4'};border-color:${inc.critique>0?'#dc2626':'#16a34a'}">
      <div class="kpi-val" style="color:${inc.critique>0?'#991b1b':'#166534'}">${(inc.declare||0)+(inc.assigne||0)+(inc.en_cours||0)}</div>
      <div class="kpi-label" style="color:${inc.critique>0?'#dc2626':'#16a34a'}">Incidents ouverts</div>
    </div>
    <div class="kpi" style="background:#f8fafc;border-color:#64748b">
      <div class="kpi-val" style="color:#374151">${ca_total.toLocaleString('fr-FR')} F</div>
      <div class="kpi-label" style="color:#64748b">CA Boutique/Bar</div>
    </div>
  </div>

  ${inc.critique>0?`<div class="alert-box" style="background:#fee2e2;border-color:#dc2626">
    <div>🚨</div>
    <div class="alert-content"><p>${inc.critique} incident(s) CRITIQUE(S) en cours — Intervention requise</p></div>
  </div>`:''}
  ${inc.sla_depasse>0?`<div class="alert-box" style="background:#fff7ed;border-color:#ea580c">
    <div>⏰</div>
    <div class="alert-content"><p>${inc.sla_depasse} SLA dépassé(s) — Escalade nécessaire</p></div>
  </div>`:''}
  ${en_rupture>0?`<div class="alert-box" style="background:#fff7ed;border-color:#ea580c">
    <div>📦</div>
    <div class="alert-content"><p>${en_rupture} article(s) en rupture de stock — Réapprovisionnement urgent</p></div>
  </div>`:''}
</div>

<!-- HÉBERGEMENT -->
<div class="section">
  <div class="section-header">
    <div class="section-icon" style="background:#dbeafe">🏠</div>
    <div><div class="section-title">Hébergement & Résidences</div><div class="section-sub">${bat.total||0} résidences au total</div></div>
  </div>
  <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
    <div class="kpi" style="background:#eff6ff;border-color:#3b82f6"><div class="kpi-val" style="color:#1e3a8a">${taux}%</div><div class="kpi-label" style="color:#3b82f6">Taux d'occupation</div></div>
    <div class="kpi" style="background:#fee2e2;border-color:#ef4444"><div class="kpi-val" style="color:#7f1d1d">${occupes}</div><div class="kpi-label" style="color:#dc2626">Occupées</div></div>
    <div class="kpi" style="background:#d1fae5;border-color:#10b981"><div class="kpi-val" style="color:#065f46">${libres}</div><div class="kpi-label" style="color:#059669">Libres</div></div>
    <div class="kpi" style="background:#ffedd5;border-color:#f97316"><div class="kpi-val" style="color:#9a3412">${reserve}</div><div class="kpi-label" style="color:#ea580c">Réservées</div></div>
  </div>
  ${bat.par_bloc ? `
  <h4 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:10px">Occupation par bloc</h4>
  <table>
    <thead><tr><th>Bloc</th><th>Total</th><th>Taux</th></tr></thead>
    <tbody>
      ${(bat.par_bloc||[]).map(b=>`<tr><td style="font-weight:600">${b.bloc||'—'}</td><td>${b.total}</td><td><span class="badge ${b.taux>80?'badge-red':b.taux>60?'badge-orange':'badge-green'}">${b.taux||'—'}%</span></td></tr>`).join('')}
    </tbody>
  </table>` : ''}
</div>

<!-- PERSONNEL & INDUCTION -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-icon" style="background:#ede9fe">👥</div>
    <div><div class="section-title">Personnel & Induction QHSE</div><div class="section-sub">${total_p} membres actifs</div></div>
  </div>
  <div class="two-col">
    <div>
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr">
        <div class="kpi" style="background:#ede9fe;border-color:#7c3aed"><div class="kpi-val" style="color:#4c1d95">${Math.round(induits/Math.max(total_p,1)*100)}%</div><div class="kpi-label" style="color:#7c3aed">Taux induction</div></div>
        <div class="kpi" style="background:#d1fae5;border-color:#059669"><div class="kpi-val" style="color:#065f46">${induits}</div><div class="kpi-label" style="color:#059669">Induits validés</div></div>
        <div class="kpi" style="background:#fef3c7;border-color:#f59e0b"><div class="kpi-val" style="color:#92400e">${enCours}</div><div class="kpi-label" style="color:#f59e0b">En cours</div></div>
        <div class="kpi" style="background:#fee2e2;border-color:#dc2626"><div class="kpi-val" style="color:#7f1d1d">${total_p-induits-enCours}</div><div class="kpi-label" style="color:#dc2626">Non commencé</div></div>
      </div>
    </div>
    <div class="card">
      <h4>Conformité par société</h4>
      ${societes.slice(0,6).map(([soc,v])=>{
        const pct = Math.round(v.induits/v.total*100)
        const c   = pct>=80?'#16a34a':pct>=60?'#f59e0b':'#dc2626'
        return `<div class="bar-row">
          <div class="bar-label">${soc}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${c}"></div></div>
          <div class="bar-val" style="color:${c}">${pct}%</div>
        </div>`
      }).join('')}
    </div>
  </div>
  <h4 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin:16px 0 10px">Liste du personnel</h4>
  <table>
    <thead><tr><th>#</th><th>Nom</th><th>Société</th><th>Type</th><th>Induction</th></tr></thead>
    <tbody>
      ${perso.slice(0,30).map((p,i)=>`<tr>
        <td style="color:#94a3b8;font-size:11px">${p.id}</td>
        <td style="font-weight:600">${p.nom||''} ${p.prenom||''}</td>
        <td>${p.societe||'—'}</td>
        <td>${p.type_personnel||'—'}</td>
        <td><span class="badge ${p.inductionrecord?.statut==='valide'?'badge-green':p.inductionrecord?.statut==='en_cours'?'badge-orange':'badge-gray'}">${p.inductionrecord?.statut==='valide'?'Induit':p.inductionrecord?.statut==='en_cours'?'En cours':'Non commencé'}</span></td>
      </tr>`).join('')}
      ${perso.length>30?`<tr><td colspan="5" style="text-align:center;color:#94a3b8;font-style:italic">... et ${perso.length-30} autres membres</td></tr>`:''}
    </tbody>
  </table>
</div>

<!-- MAINTENANCE & INCIDENTS -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-icon" style="background:#fee2e2">🔧</div>
    <div><div class="section-title">Maintenance & Incidents</div><div class="section-sub">${incidents_list.length} incident(s) sur la période</div></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi" style="background:#eff6ff;border-color:#3b82f6"><div class="kpi-val" style="color:#1e3a8a">${inc.declare||0}</div><div class="kpi-label" style="color:#3b82f6">Déclarés</div></div>
    <div class="kpi" style="background:#fff7ed;border-color:#f97316"><div class="kpi-val" style="color:#9a3412">${(inc.assigne||0)+(inc.en_cours||0)}</div><div class="kpi-label" style="color:#ea580c">En traitement</div></div>
    <div class="kpi" style="background:#d1fae5;border-color:#059669"><div class="kpi-val" style="color:#065f46">${inc.resolu||0}</div><div class="kpi-label" style="color:#059669">Résolus</div></div>
    <div class="kpi" style="background:#ede9fe;border-color:#7c3aed"><div class="kpi-val" style="color:#4c1d95">${avgDays}j</div><div class="kpi-label" style="color:#7c3aed">Durée moy. résolution</div></div>
    <div class="kpi" style="background:#fee2e2;border-color:#dc2626"><div class="kpi-val" style="color:#7f1d1d">${inc.critique||0}</div><div class="kpi-label" style="color:#dc2626">Critiques</div></div>
    <div class="kpi" style="background:#fff7ed;border-color:#ea580c"><div class="kpi-val" style="color:#9a3412">${inc.sla_depasse||0}</div><div class="kpi-label" style="color:#ea580c">SLA dépassés</div></div>
    <div class="kpi" style="background:#f8fafc;border-color:#64748b"><div class="kpi-val" style="color:#374151">${inc.cloture||0}</div><div class="kpi-label" style="color:#64748b">Clôturés</div></div>
    <div class="kpi" style="background:#f0fdf4;border-color:#16a34a"><div class="kpi-val" style="color:#166534">${incidents_list.length>0?Math.round((inc.resolu||0)/incidents_list.length*100):0}%</div><div class="kpi-label" style="color:#059669">Taux résolution</div></div>
  </div>
  <div class="two-col">
    <div class="card">
      <h4>Par catégorie</h4>
      ${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([cat,n])=>`
        <div class="bar-row">
          <div class="bar-label">${cat}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(n/incidents_list.length*100)}%;background:#1e3a8a"></div></div>
          <div class="bar-val" style="color:#1e3a8a">${n}</div>
        </div>`).join('')}
    </div>
    <div class="card">
      <h4>Par priorité</h4>
      ${[['critique','#dc2626'],['haute','#ea580c'],['moyenne','#f59e0b'],['basse','#64748b']].map(([p,c])=>`
        <div class="bar-row">
          <div class="bar-label" style="text-transform:capitalize">${p}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((byPrio[p]||0)/Math.max(incidents_list.length,1)*100)}%;background:${c}"></div></div>
          <div class="bar-val" style="color:${c}">${byPrio[p]||0}</div>
        </div>`).join('')}
    </div>
  </div>
  <h4 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin:16px 0 10px">Incidents ouverts</h4>
  <table>
    <thead><tr><th>#</th><th>Titre</th><th>Catégorie</th><th>Priorité</th><th>Statut</th><th>Résidence</th><th>Date</th><th>SLA</th></tr></thead>
    <tbody>
      ${incidents_list.filter(i=>!['cloture','annule'].includes(i.statut)).slice(0,25).map(i=>`<tr>
        <td style="color:#94a3b8;font-size:10px">${i.id}</td>
        <td style="font-weight:600;max-width:180px">${i.titre||'—'}</td>
        <td>${i.categorie||'—'}</td>
        <td><span class="badge ${i.priorite==='critique'?'badge-red':i.priorite==='haute'?'badge-orange':i.priorite==='moyenne'?'badge-gray':'badge-gray'}">${i.priorite||'—'}</span></td>
        <td><span class="badge badge-blue">${i.statut||'—'}</span></td>
        <td>${i.residence||'—'}</td>
        <td style="font-size:11px;white-space:nowrap">${i.date_creation?new Date(i.date_creation).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'}):'—'}</td>
        <td style="font-size:11px;color:${i.sla_depasse?'#dc2626':'#059669'};font-weight:700">${i.sla_depasse?'⚠️ Dépassé':'✓ OK'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- ROTATIONS & VOYAGES -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-icon" style="background:#dbeafe">✈️</div>
    <div><div class="section-title">Rotations & Voyages</div><div class="section-sub">${voyages.length} voyage(s) sur la période</div></div>
  </div>
  <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr)">
    <div class="kpi" style="background:#eff6ff;border-color:#3b82f6"><div class="kpi-val" style="color:#1e3a8a">${voy_stats.planifies||0}</div><div class="kpi-label" style="color:#3b82f6">Planifiés</div></div>
    <div class="kpi" style="background:#fef3c7;border-color:#f59e0b"><div class="kpi-val" style="color:#92400e">${voy_stats.en_voyage||0}</div><div class="kpi-label" style="color:#f59e0b">En voyage</div></div>
    <div class="kpi" style="background:#d1fae5;border-color:#059669"><div class="kpi-val" style="color:#065f46">${voy_stats.retours||0}</div><div class="kpi-label" style="color:#059669">Retours</div></div>
    <div class="kpi" style="background:#fee2e2;border-color:#dc2626"><div class="kpi-val" style="color:#7f1d1d">${voy_stats.annules||0}</div><div class="kpi-label" style="color:#dc2626">Annulés</div></div>
    <div class="kpi" style="background:#f8fafc;border-color:#64748b"><div class="kpi-val" style="color:#374151">${voy_stats.total||0}</div><div class="kpi-label" style="color:#64748b">Total</div></div>
  </div>
  <table>
    <thead><tr><th>Personnel</th><th>Destination</th><th>Départ</th><th>Retour prévu</th><th>Statut</th><th>Motif</th></tr></thead>
    <tbody>
      ${voyages.slice(0,20).map(v=>`<tr>
        <td style="font-weight:600">${v.personnel_nom||'—'}</td>
        <td>${v.destination||'—'}</td>
        <td style="white-space:nowrap">${v.date_depart?new Date(v.date_depart).toLocaleDateString('fr-FR'):'—'}</td>
        <td style="white-space:nowrap">${v.date_retour_prevue?new Date(v.date_retour_prevue).toLocaleDateString('fr-FR'):'—'}</td>
        <td><span class="badge ${v.statut==='retour'||v.statut==='arrive'?'badge-green':v.statut==='en_voyage'?'badge-orange':v.statut==='annule'?'badge-red':'badge-blue'}">${v.statut||'—'}</span></td>
        <td>${v.motif||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- STOCK & BOUTIQUE -->
<div class="section page-break">
  <div class="section-header">
    <div class="section-icon" style="background:#d1fae5">📦</div>
    <div><div class="section-title">Gestion des Stocks & Boutique</div><div class="section-sub">${articles.length} articles · Valeur totale: ${val_stock.toLocaleString('fr-FR')} FCFA</div></div>
  </div>
  <div class="kpi-grid">
    <div class="kpi" style="background:#d1fae5;border-color:#059669"><div class="kpi-val" style="color:#065f46">${val_stock.toLocaleString('fr-FR')} F</div><div class="kpi-label" style="color:#059669">Valeur du stock</div></div>
    <div class="kpi" style="background:#fee2e2;border-color:#dc2626"><div class="kpi-val" style="color:#7f1d1d">${en_rupture}</div><div class="kpi-label" style="color:#dc2626">En rupture</div></div>
    <div class="kpi" style="background:#fff7ed;border-color:#ea580c"><div class="kpi-val" style="color:#9a3412">${stock_faible}</div><div class="kpi-label" style="color:#ea580c">Stock faible</div></div>
    <div class="kpi" style="background:#eff6ff;border-color:#3b82f6"><div class="kpi-val" style="color:#1e3a8a">${ca_total.toLocaleString('fr-FR')} F</div><div class="kpi-label" style="color:#3b82f6">CA ventes</div></div>
  </div>
  <div class="two-col">
    <div class="card">
      <h4>Top consommation</h4>
      ${top_conso.filter(a=>a.total_vendu>0).map(a=>`
        <div class="bar-row">
          <div class="bar-label">${a.nom||'—'}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((a.total_vendu||0)/Math.max(...top_conso.map(x=>x.total_vendu||0),1)*100)}%;background:#7c3aed"></div></div>
          <div class="bar-val" style="color:#7c3aed">${a.total_vendu}</div>
        </div>`).join('')}
    </div>
    <div class="card">
      <h4>Articles en rupture / stock faible</h4>
      <table style="font-size:11px">
        <thead><tr><th>Article</th><th>Stock</th><th>État</th></tr></thead>
        <tbody>
          ${articles.filter(a=>(a.stock||0)<=5).sort((a,b)=>(a.stock||0)-(b.stock||0)).slice(0,10).map(a=>`
            <tr><td>${a.nom}</td><td style="font-weight:700;color:${(a.stock||0)===0?'#dc2626':'#ea580c'}">${a.stock||0}</td>
            <td><span class="badge ${(a.stock||0)===0?'badge-red':'badge-orange'}">${(a.stock||0)===0?'Rupture':'Faible'}</span></td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <h4 style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin:16px 0 10px">Inventaire complet</h4>
  <table>
    <thead><tr><th>Article</th><th>Catégorie</th><th>Stock</th><th>Consommé</th><th>Prix unit.</th><th>Valeur stock</th><th>État</th></tr></thead>
    <tbody>
      ${articles.map(a=>`<tr>
        <td style="font-weight:600">${a.nom||'—'}</td>
        <td>${a.categorie||'—'}</td>
        <td style="font-weight:700;color:${(a.stock||0)===0?'#dc2626':(a.stock||0)<=5?'#ea580c':'#059669'}">${a.stock||0}</td>
        <td style="color:#7c3aed;font-weight:600">${a.total_vendu||0}</td>
        <td style="font-family:monospace">${(a.prix||0).toLocaleString('fr-FR')} F</td>
        <td style="font-family:monospace;font-weight:600">${((a.stock||0)*(a.prix||0)).toLocaleString('fr-FR')} F</td>
        <td><span class="badge ${(a.stock||0)===0?'badge-red':(a.stock||0)<=5?'badge-orange':'badge-green'}">${(a.stock||0)===0?'Rupture':(a.stock||0)<=5?'Faible':'OK'}</span></td>
      </tr>`).join('')}
      <tr style="background:#f8fafc;font-weight:700">
        <td colspan="2"><b>TOTAUX</b></td>
        <td style="color:#059669;font-weight:900">${articles.reduce((s,a)=>s+(a.stock||0),0)}</td>
        <td style="color:#7c3aed;font-weight:900">${articles.reduce((s,a)=>s+(a.total_vendu||0),0)}</td>
        <td></td>
        <td style="font-family:monospace;font-weight:900;color:#059669">${val_stock.toLocaleString('fr-FR')} F</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>

<!-- FOOTER -->
<div class="footer">
  RZI Camp ERP — Rapport généré le ${dateStr} à ${timeStr} — Camp Résidentiel Roxgold Sango, Côte d'Ivoire<br>
  Ce document est confidentiel et à usage interne uniquement.
</div>

</body>
</html>`
}

// ── Composant principal ────────────────────────────────────────────────
export default function RapportsPage() {
  const [loading,  setLoading]  = useState(false)
  const [progress, setProgress] = useState('')
  const [periode,  setPeriode]  = useState({debut:'',fin:''})
  const [lastGen,  setLastGen]  = useState(null)

  const generer = useCallback(async () => {
    setLoading(true)
    setProgress('Chargement des données...')
    try {
      const now = new Date()
      const p   = periode.debut ? periode : { debut:'', fin:'' }

      setProgress('Résidences & hébergement...')
      const [rBat, rPerso, rInc, rIncList, rVoy, rVoyList, rArt, rConso] = await Promise.allSettled([
        fetch(`${BASE}/api/batiments/stats/`,          {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/personnel/?page_size=500`,  {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/incidents/stats-sql/`,      {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/incidents/?page_size=500`,  {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/voyages/stats/`,            {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/voyages/?page_size=200`,    {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/boutique/articles/?page_size=500`, {headers:hdrs()}).then(j),
        fetch(`${BASE}/api/boutique/consommations/?page_size=500`, {headers:hdrs()}).then(j),
      ])

      setProgress('Compilation du rapport...')

      const data = {
        batiments_stats: rBat.status==='fulfilled'    ? rBat.value    : {},
        personnel:       rPerso.status==='fulfilled'  ? (rPerso.value?.results||rPerso.value||[]) : [],
        incidents_stats: rInc.status==='fulfilled'    ? rInc.value    : {},
        incidents:       rIncList.status==='fulfilled'? (rIncList.value?.results||rIncList.value||[]) : [],
        voyages_stats:   rVoy.status==='fulfilled'    ? rVoy.value    : {},
        voyages:         rVoyList.status==='fulfilled'? (rVoyList.value?.results||rVoyList.value||[]) : [],
        articles:        rArt.status==='fulfilled'    ? (rArt.value?.results||rArt.value||[]) : [],
        consommations:   rConso.status==='fulfilled'  ? (rConso.value?.results||rConso.value||[]) : [],
      }

      setProgress('Génération du PDF...')
      const html = buildHTML(data, p)
      const blob = new Blob([html], {type:'text/html;charset=utf-8'})
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href=url; a.target='_blank'; a.rel='noopener'
      document.body.appendChild(a); a.click()
      setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url) }, 500)
      setLastGen(now)
    } catch(e) {
      console.error(e)
    }
    setLoading(false)
    setProgress('')
  }, [periode])

  const now = new Date()
  const PERIODES = [
    { l:'Aujourd\'hui',     d:{ debut:now.toISOString().slice(0,10), fin:now.toISOString().slice(0,10) } },
    { l:'Cette semaine',    d:{ debut: (() => { const d=new Date(now); d.setDate(now.getDate()-((now.getDay()||7)-1)); return d.toISOString().slice(0,10) })(), fin:now.toISOString().slice(0,10) } },
    { l:'Ce mois',          d:{ debut:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, fin:now.toISOString().slice(0,10) } },
    { l:'Tout',             d:{ debut:'', fin:'' } },
  ]

  return (
    <div style={{padding:24,background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{maxWidth:800,margin:'0 auto'}}>

        {/* Header */}
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:22,fontWeight:900,color:'#0f172a',margin:0}}>📋 Rapports</h1>
          <p style={{fontSize:13,color:'#64748b',margin:'6px 0 0'}}>
            Génération automatique de rapports détaillés sur tous les périmètres
          </p>
        </div>

        {/* Rapport global */}
        <div style={{background:'#fff',borderRadius:16,border:'1px solid #e2e8f0',
          overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,.06)',marginBottom:16}}>
          
          {/* En-tête */}
          <div style={{background:'linear-gradient(135deg,#0f172a,#1e3a8a)',padding:'24px 28px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{color:'rgba(255,255,255,.6)',fontSize:10,textTransform:'uppercase',
                  letterSpacing:1,marginBottom:4}}>RAPPORT PRINCIPAL</div>
                <h2 style={{color:'#fff',fontSize:18,fontWeight:900,margin:0}}>
                  📋 Rapport Opérationnel Global
                </h2>
                <p style={{color:'rgba(255,255,255,.6)',fontSize:12,margin:'6px 0 0'}}>
                  Hébergement · Personnel · Induction · Incidents · Voyages · Stock · Boutique
                </p>
              </div>
              <div style={{fontSize:40}}>📊</div>
            </div>
          </div>

          {/* Config période */}
          <div style={{padding:'20px 28px',borderBottom:'1px solid #f1f5f9'}}>
            <p style={{fontSize:12,fontWeight:600,color:'#374151',marginBottom:12}}>
              Période du rapport
            </p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
              {PERIODES.map(({l,d})=>(
                <button key={l} onClick={()=>setPeriode(d)}
                  style={{padding:'6px 14px',borderRadius:8,border:'1.5px solid',cursor:'pointer',
                    fontSize:12,fontWeight:600,
                    background: JSON.stringify(periode)===JSON.stringify(d)?'#1e3a8a':'#f8fafc',
                    color:      JSON.stringify(periode)===JSON.stringify(d)?'#fff':'#374151',
                    borderColor:JSON.stringify(periode)===JSON.stringify(d)?'#1e3a8a':'#e2e8f0'}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['Du','debut'],['Au','fin']].map(([l,k])=>(
                <div key={k}>
                  <label style={{fontSize:10,fontWeight:600,color:'#64748b',
                    display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>
                    {l}
                  </label>
                  <input type="date" value={periode[k]||''}
                    onChange={e=>setPeriode(p=>({...p,[k]:e.target.value}))}
                    style={{width:'100%',height:36,border:'1.5px solid #e2e8f0',borderRadius:8,
                      padding:'0 12px',fontSize:13,outline:'none',color:'#0f172a'}}/>
                </div>
              ))}
            </div>
          </div>

          {/* Sections incluses */}
          <div style={{padding:'16px 28px',borderBottom:'1px solid #f1f5f9'}}>
            <p style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:10,
              textTransform:'uppercase',letterSpacing:.5}}>
              Sections incluses dans le rapport
            </p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {[
                ['🏠','Hébergement','#eff6ff','#1e3a8a'],
                ['👥','Personnel & Induction','#ede9fe','#7c3aed'],
                ['🔧','Maintenance & Incidents','#fee2e2','#dc2626'],
                ['✈️','Rotations & Voyages','#dbeafe','#3b82f6'],
                ['📦','Stocks & Boutique','#d1fae5','#059669'],
              ].map(([ic,l,bg,c])=>(
                <div key={l} style={{background:bg,color:c,padding:'4px 12px',borderRadius:99,
                  fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
                  <span>{ic}</span>{l}
                </div>
              ))}
            </div>
          </div>

          {/* Bouton génération */}
          <div style={{padding:'20px 28px',display:'flex',justifyContent:'space-between',
            alignItems:'center'}}>
            <div>
              {lastGen && (
                <p style={{fontSize:11,color:'#94a3b8'}}>
                  Dernière génération : {lastGen.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                </p>
              )}
              {loading && progress && (
                <p style={{fontSize:12,color:'#1e3a8a',fontWeight:600}}>
                  ⏳ {progress}
                </p>
              )}
            </div>
            <button onClick={generer} disabled={loading}
              style={{background:loading?'#94a3b8':'linear-gradient(135deg,#1e3a8a,#2563eb)',
                color:'#fff',border:'none',borderRadius:12,
                padding:'14px 32px',fontSize:14,fontWeight:800,cursor:loading?'not-allowed':'pointer',
                boxShadow:loading?'none':'0 4px 16px rgba(30,58,138,.35)',
                display:'flex',alignItems:'center',gap:8,transition:'all .2s'}}>
              {loading ? '⏳ Génération...' : '📄 Générer le rapport PDF'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div style={{background:'#eff6ff',borderRadius:12,padding:'14px 18px',
          border:'1px solid #bfdbfe',fontSize:12,color:'#1e40af'}}>
          <p style={{fontWeight:700,marginBottom:4}}>💡 Comment utiliser ce rapport</p>
          <p style={{color:'#374151',lineHeight:1.6}}>
            Le rapport s'ouvre dans un nouvel onglet. Utilisez <strong>Ctrl+P</strong> (ou ⌘+P sur Mac) 
            pour imprimer ou sauvegarder en PDF. Choisissez "Enregistrer au format PDF" comme imprimante 
            pour obtenir un fichier PDF téléchargeable.
          </p>
        </div>
      </div>
    </div>
  )
}
