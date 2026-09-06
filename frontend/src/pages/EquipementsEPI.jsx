import React, { useState, useEffect, useCallback } from 'react'
import { epiAPI, personnel as personnelAPI } from '../api'
import { useIsMobile } from '../hooks/useIsMobile'

const TYPES = [
  ['casque','⛑️ Casque'],['chaussures','🥾 Chaussures de sécurité'],['gilet','🦺 Gilet haute visibilité'],
  ['gants','🧤 Gants'],['lunettes','🥽 Lunettes de protection'],['auditive','🎧 Protection auditive'],
  ['harnais','🪢 Harnais'],['masque','😷 Masque'],['autre','📦 Autre'],
]

const STATUT_STYLE = {
  expire:  { bg:'#fee2e2', color:'#dc2626', label:'⛔ Expiré' },
  bientot: { bg:'#fef3c7', color:'#b45309', label:'⏰ Bientôt' },
  ok:      { bg:'#dcfce7', color:'#16a34a', label:'✅ Bon' },
}

export default function EquipementsEPI() {
  const isMobile = useIsMobile()
  const [liste, setListe] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtreStatut, setFiltreStatut] = useState('')
  const [search, setSearch] = useState('')
  const [alertes, setAlertes] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [personnelListe, setPersonnelListe] = useState([])
  const [form, setForm] = useState({ personnel:'', type_epi:'casque', date_remise:new Date().toISOString().slice(0,10), date_expiration:'', etat:'bon', notes:'' })

  const charger = useCallback(() => {
    setLoading(true)
    epiAPI.list(filtreStatut ? { statut_peremption: filtreStatut, page_size: 1000 } : { page_size: 1000 })
      .then(r => setListe(r.data.results || r.data || []))
      .catch(() => setListe([]))
      .finally(() => setLoading(false))
  }, [filtreStatut])

  useEffect(() => { charger() }, [charger])
  useEffect(() => { epiAPI.alertes().then(r => setAlertes(r.data)).catch(() => {}) }, [liste])
  useEffect(() => {
    personnelAPI.list({ page_size: 2000 }).then(r => setPersonnelListe(r.data.results || r.data || [])).catch(() => {})
  }, [])

  const filtres = liste.filter(e => {
    if (!search) return true
    const s = search.toLowerCase()
    return (e.personnel_nom||'').toLowerCase().includes(s)
  })

  const enregistrer = async () => {
    if (!form.personnel || !form.date_remise) { alert('Personnel et date de remise requis.'); return }
    try {
      await epiAPI.create(form)
      setShowForm(false)
      setForm({ personnel:'', type_epi:'casque', date_remise:new Date().toISOString().slice(0,10), date_expiration:'', etat:'bon', notes:'' })
      charger()
    } catch { alert("Erreur lors de l'enregistrement") }
  }

  const supprimer = async (id) => {
    if (!window.confirm('Supprimer cet équipement ?')) return
    try { await epiAPI.delete(id); charger() } catch { alert('Erreur suppression') }
  }

  return (
    <div style={{ padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:10, marginBottom:16 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>🦺 Équipements EPI</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>Suivi de conformité — casques, chaussures, gilets, gants...</p>
        </div>
        <button onClick={()=>setShowForm(true)}
          style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:'9px 16px',
            borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700 }}>
          ➕ Attribuer un équipement
        </button>
      </div>

      {alertes && (alertes.expires > 0 || alertes.bientot > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:10, marginBottom:16 }}>
          {alertes.expires > 0 && (
            <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:12, padding:14 }}>
              <div style={{ fontSize:22, fontWeight:900, color:'#dc2626' }}>{alertes.expires}</div>
              <div style={{ fontSize:12, color:'#991b1b', fontWeight:600 }}>⛔ Équipement(s) expiré(s)</div>
            </div>
          )}
          {alertes.bientot > 0 && (
            <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:12, padding:14 }}>
              <div style={{ fontSize:22, fontWeight:900, color:'#b45309' }}>{alertes.bientot}</div>
              <div style={{ fontSize:12, color:'#92400e', fontWeight:600 }}>⏰ À renouveler sous 30 jours</div>
            </div>
          )}
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nom..."
          style={{ border:'1px solid #e2e8f0', borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none', maxWidth:200 }}/>
        <select value={filtreStatut} onChange={e=>setFiltreStatut(e.target.value)}
          style={{ border:'1px solid #e2e8f0', borderRadius:9, padding:'8px 12px', fontSize:13, outline:'none' }}>
          <option value="">Tous statuts</option>
          <option value="expire">⛔ Expirés</option>
          <option value="bientot">⏰ Bientôt (30j)</option>
          <option value="ok">✅ Bon</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>⏳ Chargement...</div>
      ) : filtres.length === 0 ? (
        <div style={{ textAlign:'center', padding:40, color:'#94a3b8' }}>Aucun équipement enregistré.</div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr style={{ background:'#f8fafc' }}>
                {['Personnel','Équipement','Remis le','Expire le','Statut','État',''].map(h=>(
                  <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:10, color:'#64748b', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtres.map((e,idx) => {
                  const st = e.statut_peremption ? STATUT_STYLE[e.statut_peremption] : null
                  return (
                    <tr key={e.id} style={{ borderTop:'1px solid #e2e8f0', background: idx%2?'#f8fafc':'#fff' }}>
                      <td style={{ padding:'9px 12px', fontWeight:600 }}>{e.personnel_nom}</td>
                      <td style={{ padding:'9px 12px' }}>{e.type_epi_label}</td>
                      <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:11 }}>{e.date_remise ? new Date(e.date_remise).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={{ padding:'9px 12px', fontFamily:'monospace', fontSize:11 }}>{e.date_expiration ? new Date(e.date_expiration).toLocaleDateString('fr-FR') : '—'}</td>
                      <td style={{ padding:'9px 12px' }}>
                        {st ? <span style={{ background:st.bg, color:st.color, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{st.label}</span> : '—'}
                      </td>
                      <td style={{ padding:'9px 12px', fontSize:12, color:'#64748b' }}>{e.etat_label}</td>
                      <td style={{ padding:'9px 12px' }}>
                        <button onClick={()=>supprimer(e.id)}
                          style={{ background:'#fee2e2', color:'#dc2626', border:'none', padding:'4px 8px', borderRadius:6, cursor:'pointer', fontSize:11 }}>
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e=>e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:380, overflow:'hidden' }}>
            <div style={{ background:'var(--rzc-navy, #1E3A8A)', color:'#fff', padding:'12px 16px', fontWeight:700 }}>
              🦺 Attribuer un équipement
            </div>
            <div style={{ padding:14, display:'flex', flexDirection:'column', gap:9 }}>
              <select value={form.personnel} onChange={e=>setForm(f=>({...f,personnel:e.target.value}))}
                style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13 }}>
                <option value="">Sélectionner un employé...</option>
                {personnelListe.map(p => <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
              </select>
              <select value={form.type_epi} onChange={e=>setForm(f=>({...f,type_epi:e.target.value}))}
                style={{ border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13 }}>
                {TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>DATE DE REMISE</label>
                <input type="date" value={form.date_remise} onChange={e=>setForm(f=>({...f,date_remise:e.target.value}))}
                  style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'#64748b' }}>DATE D'EXPIRATION (optionnel)</label>
                <input type="date" value={form.date_expiration} onChange={e=>setForm(f=>({...f,date_expiration:e.target.value}))}
                  style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', fontSize:13, boxSizing:'border-box' }}/>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button onClick={()=>setShowForm(false)}
                  style={{ flex:1, background:'#f1f5f9', color:'#64748b', border:'none', padding:10, borderRadius:9, cursor:'pointer', fontWeight:700 }}>
                  Annuler
                </button>
                <button onClick={enregistrer}
                  style={{ flex:1, background:'var(--rzc-navy, #1E3A8A)', color:'#fff', border:'none', padding:10, borderRadius:9, cursor:'pointer', fontWeight:700 }}>
                  💾 Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
