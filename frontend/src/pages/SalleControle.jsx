import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
const hdrs = () => ({ Authorization: `Bearer ${localStorage.getItem('access_token')||''}` })

export default function SalleControle() {
  const navigate = useNavigate()
  const [d, setD] = useState({})
  const [horloge, setHorloge] = useState(new Date())
  const [sync, setSync] = useState(null)

  const load = useCallback(async () => {
    try {
      const [rB, rI, rV, rEpi] = await Promise.allSettled([
        fetch(`${BASE}/api/batiments/stats/`,      { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/incidents/stats-sql/`,  { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/voyages/stats/`,        { headers: hdrs() }).then(r => r.json()),
        fetch(`${BASE}/api/epi/alertes/`,          { headers: hdrs() }).then(r => r.json()),
      ])
      setD({
        bat: rB.status === 'fulfilled' ? rB.value : {},
        inc: rI.status === 'fulfilled' ? rI.value : {},
        voy: rV.status === 'fulfilled' ? rV.value : {},
        epi: rEpi.status === 'fulfilled' ? rEpi.value : {},
      })
      setSync(new Date())
    } catch {}
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv) }, [load])
  useEffect(() => { const iv = setInterval(() => setHorloge(new Date()), 1000); return () => clearInterval(iv) }, [])

  const ouverts   = (d.inc?.declare||0) + (d.inc?.assigne||0) + (d.inc?.en_cours||0)
  const critiques = d.inc?.critique || 0
  const sla       = d.inc?.sla_depasse || 0
  const enVoyage  = d.voy?.en_voyage || 0

  const alertes = []
  if (critiques > 0) alertes.push({ icone:'🚨', titre:`${critiques} incident(s) critique(s)`, urgent:true })
  if (sla > 0)       alertes.push({ icone:'⏰', titre:`${sla} SLA dépassé(s)`, urgent:true })
  if (d.epi?.expires > 0) alertes.push({ icone:'🦺', titre:`${d.epi.expires} EPI expiré(s)`, urgent:true })
  if (d.epi?.bientot > 0) alertes.push({ icone:'🦺', titre:`${d.epi.bientot} EPI à renouveler (30j)`, urgent:false })
  if (d.bat?.departs_s1 > 0) alertes.push({ icone:'✈️', titre:`${d.bat.departs_s1} départ(s) cette semaine`, urgent:false })

  const KPI = [
    { label:'Occupation', valeur:`${d.bat?.taux_occupation ?? '—'}%`, couleur:'#38bdf8', icone:'🏠' },
    { label:'Résidences libres', valeur:d.bat?.par_statut?.['Libre'] ?? '—', couleur:'#4ade80', icone:'🔓' },
    { label:'Incidents ouverts', valeur:ouverts, couleur: ouverts>0 ? '#f87171' : '#4ade80', icone:'🛠️' },
    { label:'En déplacement', valeur:enVoyage, couleur:'#facc15', icone:'✈️' },
  ]

  return (
    <div style={{
      minHeight:'100dvh', background:'#050b1a', color:'#e2e8f0',
      fontFamily:'var(--rzc-font, sans-serif)', padding:'28px 36px',
      display:'flex', flexDirection:'column', gap:24,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:26, fontWeight:900, letterSpacing:.5 }}>🛡️ RZI CAMP — SALLE DE CONTRÔLE</div>
          <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>
            Roxgold Sango · {sync ? `Synchronisé ${sync.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : 'Chargement...'}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:34, fontWeight:900, fontFamily:'monospace', color:'#38bdf8' }}>
            {horloge.toLocaleTimeString('fr-FR')}
          </div>
          <div style={{ fontSize:13, color:'#64748b' }}>
            {horloge.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
          </div>
        </div>
        <button onClick={()=>navigate('/')}
          style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', color:'#94a3b8',
            padding:'8px 16px', borderRadius:9, cursor:'pointer', fontSize:12, fontWeight:700 }}>
          ✕ Quitter
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20 }}>
        {KPI.map((k,i) => (
          <div key={i} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
            borderRadius:18, padding:'24px 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:6 }}>{k.icone}</div>
            <div style={{ fontSize:44, fontWeight:900, color:k.couleur, fontFamily:'monospace', lineHeight:1 }}>{k.valeur}</div>
            <div style={{ fontSize:13, color:'#94a3b8', marginTop:8, textTransform:'uppercase', letterSpacing:1 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex:1, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:18, padding:24 }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:16, letterSpacing:.5 }}>🚨 ALERTES ACTIVES</div>
        {alertes.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#4ade80', fontSize:20, fontWeight:700 }}>
            ✅ Aucune alerte active — situation nominale
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:14 }}>
            {alertes.map((a,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:16, padding:'18px 20px', borderRadius:14,
                background: a.urgent ? 'rgba(248,113,113,.12)' : 'rgba(250,204,21,.08)',
                border: `1.5px solid ${a.urgent ? 'rgba(248,113,113,.35)' : 'rgba(250,204,21,.25)'}` }}>
                <span style={{ fontSize:32 }}>{a.icone}</span>
                <span style={{ fontSize:18, fontWeight:700, color: a.urgent ? '#f87171' : '#facc15' }}>{a.titre}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
