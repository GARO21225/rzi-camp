/**
 * RAPPORTS DE GESTION — Rapport complet du camp
 * Données réelles : résidences, personnel, maintenance, boutique
 */
import React, { useState } from 'react'
import { batiments, personnel as personnelAPI, boutique as boutiqueAPI } from '../api'
import { useStore } from '../store'

export default function RapportPage() {
  const { user } = useStore()
  const [data,      setData]      = useState(null)
  const [period,    setPeriod]    = useState('semaine')
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState(null)

  const generate = async () => {
    setLoading(true); setErr(null); setData(null)
    try {
      const [rBat, rPerso, rConso, rStats] = await Promise.allSettled([
        batiments.stats(),
        personnelAPI.list({ page_size:1 }),
        boutiqueAPI.consommations({ page_size:500 }),
        boutiqueAPI.statsJour(),
      ])

      const batStats  = rBat.status   === 'fulfilled' ? rBat.value.data   : {}
      const personnel = rPerso.status === 'fulfilled' ? rPerso.value.data : {}
      const consos    = rConso.status === 'fulfilled'
        ? (rConso.value.data.results || rConso.value.data || []) : []
      const statsJ    = rStats.status === 'fulfilled' ? rStats.value.data : {}

      // Analyser les consommations
      const totalCA = consos.reduce((s,c)=>s+parseInt(c.montant||0),0)
      const parArt  = {}
      consos.forEach(c => {
        if (!parArt[c.article_nom]) parArt[c.article_nom] = {nom:c.article_nom,qte:0,ca:0}
        parArt[c.article_nom].qte += c.quantite
        parArt[c.article_nom].ca  += parseInt(c.montant||0)
      })
      const topArticles = Object.values(parArt).sort((a,b)=>b.ca-a.ca).slice(0,10)

      const parAgent = {}
      consos.forEach(c => {
        const k = c.personnel_nom || 'Anonyme'
        if (!parAgent[k]) parAgent[k] = {nom:k,qte:0,ca:0}
        parAgent[k].qte += c.quantite
        parAgent[k].ca  += parseInt(c.montant||0)
      })
      const topAgents = Object.values(parAgent).sort((a,b)=>b.ca-a.ca).slice(0,10)

      setData({
        generated_at: new Date().toLocaleString('fr-FR'),
        batiments:    batStats,
        personnel:    personnel.count || 0,
        consos:       { total: consos.length, ca: totalCA, topArticles, topAgents },
        statsJour:    statsJ,
      })
    } catch(e) {
      setErr(e.message || 'Erreur lors de la génération')
    } finally {
      setLoading(false)
    }
  }

  const printReport = () => window.print()

  const C = '#1e3a8a'
  const titre = { fontSize:15, fontWeight:800, color:C, marginBottom:12, borderBottom:'2px solid #e2e8f0', paddingBottom:8 }

  return (
    <div style={{ padding:24, maxWidth:1000, margin:'0 auto' }}>
      {/* Entête */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:C, margin:0 }}>📋 Rapports de Gestion</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>
            Rapport instantané avec les données actuelles du camp
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select value={period} onChange={e=>setPeriod(e.target.value)}
            style={{ border:'2px solid #e2e8f0', borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
            <option value="jour">Aujourd\'hui</option>
            <option value="semaine">Cette semaine</option>
            <option value="mois">Ce mois</option>
          </select>
          <button onClick={generate} disabled={loading}
            style={{ background:loading?'#94a3b8':C, color:'#fff', border:'none', padding:'10px 20px',
              borderRadius:10, cursor:loading?'wait':'pointer', fontSize:13, fontWeight:700 }}>
            {loading ? '⏳ Génération...' : '🔄 Générer le rapport'}
          </button>
          {data && (
            <button onClick={printReport}
              style={{ background:'#16a34a', color:'#fff', border:'none', padding:'10px 20px',
                borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
              🖨️ Imprimer
            </button>
          )}
        </div>
      </div>

      {err && (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12, padding:'12px 16px', color:'#dc2626', marginBottom:16 }}>
          ❌ {err}
        </div>
      )}

      {!data && !loading && !err && (
        <div style={{ background:'#f8fafc', border:'2px dashed #e2e8f0', borderRadius:16, padding:'60px 20px', textAlign:'center' }}>
          <div style={{ fontSize:56, marginBottom:12 }}>📋</div>
          <div style={{ fontWeight:700, color:'#64748b', fontSize:15 }}>Cliquez sur "Générer le rapport"</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:6 }}>Rapport instantané avec les données actuelles du camp</div>
        </div>
      )}

      {data && (
        <div id="rapport-content">
          {/* En-tête rapport */}
          <div style={{ background:`linear-gradient(135deg,#0f2447,${C})`, color:'#fff', borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:20, fontWeight:900 }}>🏗️ Résidence Roxgold Sango</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginTop:4 }}>
                  Rapport ERP GIS · Généré le {data.generated_at}
                </div>
              </div>
              <div style={{ textAlign:'right', fontSize:12, color:'rgba(255,255,255,.7)' }}>
                Admin : {user?.first_name} {user?.last_name}
              </div>
            </div>
          </div>

          {/* KPIs résidences */}
          <div style={{ marginBottom:20 }}>
            <div style={titre}>🏠 État des Résidences</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
              {[
                ['Total','🏗️', data.batiments.total||0, C],
                ['Occupés','🔴', data.batiments.par_statut?.Occupé||0, '#dc2626'],
                ['Libres','🟢', data.batiments.par_statut?.Libre||0, '#16a34a'],
                ['Réservés','🔵', data.batiments.par_statut?.Réservé||0, '#2563eb'],
                ['Maintenance','🟠', data.batiments.par_statut?.Maintenance||0, '#f59e0b'],
                ['Taux occ.','📊', `${data.batiments.taux_occupation||0}%`, '#7c3aed'],
              ].map(([l,i,v,c])=>(
                <div key={l} style={{ background:'#fff', borderRadius:12, padding:'14px 16px', borderTop:`3px solid ${c}`, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                  <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>{i} {l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Personnel */}
          <div style={{ marginBottom:20 }}>
            <div style={titre}>👤 Personnel</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
              <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px', borderTop:`3px solid ${C}`, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ fontFamily:'monospace', fontSize:26, fontWeight:900, color:C }}>{data.personnel}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>👤 Membres enregistrés</div>
              </div>
            </div>
          </div>

          {/* Bar & Boutique */}
          <div style={{ marginBottom:20 }}>
            <div style={titre}>🛒 Bar & Boutique — Consommations</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
              {[
                ['Transactions',data.consos.total,'#1e3a8a'],
                ['CA FCFA',`${data.consos.ca.toLocaleString()} FCFA`,'#16a34a'],
                ['Aujourd\'hui',`${(data.statsJour?.montant||0).toLocaleString()} FCFA`,'#7c3aed'],
              ].map(([l,v,c])=>(
                <div key={l} style={{ background:'#fff', borderRadius:12, padding:'14px 16px', borderTop:`3px solid ${c}`, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                  <div style={{ fontFamily:'monospace', fontSize:20, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>🛒 {l}</div>
                </div>
              ))}
            </div>

            {/* Top articles */}
            {data.consos.topArticles.length > 0 && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'#475569', marginBottom:8 }}>🏆 Top Articles</div>
                  {data.consos.topArticles.slice(0,6).map((a,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px',
                      background:i%2?'#f8fafc':'#fff', borderRadius:7, marginBottom:4 }}>
                      <span style={{ fontSize:12 }}>{i+1}. {a.nom}</span>
                      <span style={{ fontWeight:700, fontSize:12, color:C }}>{a.ca.toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:'#475569', marginBottom:8 }}>👤 Top Consommateurs</div>
                  {data.consos.topAgents.slice(0,6).map((a,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px',
                      background:i%2?'#f8fafc':'#fff', borderRadius:7, marginBottom:4 }}>
                      <span style={{ fontSize:12 }}>{i+1}. {a.nom}</span>
                      <span style={{ fontWeight:700, fontSize:12, color:'#16a34a' }}>{a.ca.toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.consos.total === 0 && (
              <div style={{ textAlign:'center', padding:'20px', color:'#94a3b8', fontSize:13 }}>
                Aucune consommation enregistrée
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ textAlign:'center', color:'#94a3b8', fontSize:11, borderTop:'1px solid #e2e8f0', paddingTop:12, marginTop:20 }}>
            RZI Camp ERP GIS v7 · Résidence Roxgold Sango · {new Date().getFullYear()}
          </div>
        </div>
      )}
    </div>
  )
}
