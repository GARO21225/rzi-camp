/**
 * RAPPORTS — Génération de rapports hebdo/mensuel
 * Export PDF ou impression directe
 */
import React, { useState, useEffect } from 'react'
import { batiments, incidents, voyages as voyAPI, personnel as personnelAPI } from '../api'

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom:24, pageBreakInside:'avoid' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingBottom:8, borderBottom:'2px solid #e2e8f0' }}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <h3 style={{ fontSize:16, fontWeight:700, color:'#1e3a8a', margin:0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#f8fafc', borderRadius:8, marginBottom:6 }}>
      <span style={{ fontSize:13, color:'#475569' }}>{label}</span>
      <span style={{ fontSize:14, fontWeight:700, color: color||'#1e3a8a' }}>{value}</span>
    </div>
  )
}

export default function RapportPage() {
  const [stats, setStats]   = useState(null)
  const [inc,   setInc]     = useState(null)
  const [voy,   setVoy]     = useState(null)
  const [pers,  setPers]    = useState(null)
  const [period, setPeriod] = useState('semaine')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const [rb, ri, rv, rp] = await Promise.all([
        batiments.stats(),
        incidents.stats(),
        voyAPI.stats(),
        personnelAPI.list({ page_size:1 }),
      ])
      const ps = rb.data.par_statut || {}
      setStats({ libres: ps['Libre']||0, occupes: ps['Occupé']||0, reserves: ps['Réservé']||0, maintenance: ps['Maintenance']||0, total: rb.data.total||0, taux: rb.data.taux_occupation||0 })
      setInc(ri.data)
      setVoy(rv.data)
      setPers(rp.data.count || 0)
      setGenerated(true)
    } finally { setLoading(false) }
  }

  const printReport = () => window.print()

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
  const timeStr = now.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })

  return (
    <div style={{ padding:20, maxWidth:900, margin:'0 auto' }}>

      {/* Header non-imprimable */}
      <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>📑 Rapports de gestion</h2>
          <p style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>Générez et imprimez les rapports d'activité du camp</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)}
            style={{ border:'1px solid #e2e8f0', borderRadius:9, padding:'8px 12px', fontSize:13, background:'#fff' }}>
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
            <option value="annee">Cette année</option>
          </select>
          <button onClick={generate} disabled={loading}
            style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'9px 20px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            {loading ? '⏳ Génération...' : '🔄 Générer le rapport'}
          </button>
          {generated && (
            <button onClick={printReport}
              style={{ background:'#16a34a', color:'#fff', border:'none', padding:'9px 20px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              🖨️ Imprimer / PDF
            </button>
          )}
        </div>
      </div>

      {!generated ? (
        <div style={{ textAlign:'center', padding:80, color:'#94a3b8', background:'#fff', borderRadius:16, border:'2px dashed #e2e8f0' }}>
          <div style={{ fontSize:52, marginBottom:12 }}>📑</div>
          <div style={{ fontSize:15, fontWeight:600, color:'#64748b' }}>Cliquez sur "Générer le rapport"</div>
          <div style={{ fontSize:13, marginTop:6 }}>Rapport instantané avec les données actuelles du camp</div>
        </div>
      ) : (

        /* ══ RAPPORT IMPRIMABLE ══ */
        <div id="rapport" style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 2px 12px rgba(0,0,0,.07)', border:'1px solid #e2e8f0' }}>

          {/* En-tête du rapport */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, paddingBottom:16, borderBottom:'3px solid #1e3a8a' }}>
            <div>
              <div style={{ fontSize:24, fontWeight:900, color:'#1e3a8a', letterSpacing:-.5 }}>RÉSIDENCE ROXGOLD SANGO</div>
              <div style={{ fontSize:14, color:'#64748b', marginTop:4 }}>Rapport de gestion · {period === 'semaine'?'Hebdomadaire':period==='mois'?'Mensuel':'Annuel'}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:'monospace', fontSize:13, color:'#94a3b8' }}>Généré le {dateStr} à {timeStr}</div>
              <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>ERP GIS Camp · Côte d'Ivoire</div>
            </div>
          </div>

          {/* Résumé exécutif */}
          <div style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)', borderRadius:12, padding:'20px 24px', marginBottom:24, color:'#fff' }}>
            <div style={{ fontSize:11, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,.6)', marginBottom:8 }}>RÉSUMÉ EXÉCUTIF</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:16 }}>
              {[
                ['Bâtiments',        stats?.total,                           '#f0a500'],
                ['Taux occupation',  `${Math.round(stats?.taux||0)}%`,       '#6ee7a0'],
                ['Incidents actifs', inc?.ouverts + inc?.en_cours,           '#fca5a5'],
                ['En voyage',        voy?.en_voyage,                          '#93c5fd'],
                ['Personnel total',  pers,                                    '#e9d5ff'],
              ].map(([l,v,c]) => (
                <div key={l}>
                  <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:900, color:c }}>{v ?? '—'}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:1, marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <Section title="Résidences & Hébergement" icon="🏠">
            <StatRow label="Total bâtiments gérés" value={stats?.total} />
            <StatRow label="Chambres libres" value={`${stats?.libres} (${stats?.total?Math.round(stats.libres/stats.total*100):0}%)`} color="#16a34a" />
            <StatRow label="Chambres occupées" value={`${stats?.occupes} (${stats?.total?Math.round(stats.occupes/stats.total*100):0}%)`} color="#2563eb" />
            <StatRow label="Chambres réservées" value={stats?.reserves} color="#f97316" />
            <StatRow label="En maintenance" value={stats?.maintenance} color="#dc2626" />
            <StatRow label="Taux d'occupation" value={`${Math.round(stats?.taux||0)}%`} color="#7c3aed" />
          </Section>

          <Section title="Maintenance & Incidents" icon="🔧">
            <StatRow label="Total incidents période" value={inc?.total} />
            <StatRow label="Incidents ouverts" value={inc?.ouverts} color="#dc2626" />
            <StatRow label="En cours de traitement" value={inc?.en_cours} color="#f97316" />
            <StatRow label="Résolus" value={inc?.resolus} color="#16a34a" />
          </Section>

          <Section title="Voyages & Absences" icon="✈️">
            <StatRow label="Total voyages période" value={voy?.total} />
            <StatRow label="Planifiés" value={voy?.planifies} color="#2563eb" />
            <StatRow label="Actuellement en voyage" value={voy?.en_voyage} color="#f97316" />
            <StatRow label="Retours effectués" value={voy?.retours} color="#16a34a" />
            <StatRow label="Voyages annulés" value={voy?.annules} color="#dc2626" />
          </Section>

          <Section title="Personnel" icon="👤">
            <StatRow label="Effectif total" value={pers} />
          </Section>

          {/* Pied de rapport */}
          <div style={{ marginTop:24, paddingTop:16, borderTop:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', fontSize:11, color:'#94a3b8' }}>
            <span>Résidence Roxgold Sango · ERP GIS</span>
            <span>Document généré automatiquement — {dateStr}</span>
          </div>
        </div>
      )}

      {/* CSS Print */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          #rapport { box-shadow: none !important; border: none !important; padding: 20px !important; }
        }
      `}</style>
    </div>
  )
}
