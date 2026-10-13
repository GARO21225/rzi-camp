// ── Générateur de rapport maintenance ──────────────────────────
export function genererRapport(incidents, stats, periode={}) {
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
    Roxgold SiteLife · Résidence Roxgold Sango · Côte d'Ivoire
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
  Roxgold SiteLife · Rapport généré automatiquement le ${dateStr} à ${timeStr} ·
  Roxgold Sango, Côte d'Ivoire
</div>

</body>
</html>`

  return HTML
}
