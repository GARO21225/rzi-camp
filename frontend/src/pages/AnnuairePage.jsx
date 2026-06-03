import React, { useState, useEffect } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({ 'Authorization': `Bearer ${localStorage.getItem('access_token')||''}` })

export default function AnnuairePage() {
  const [search,    setSearch]    = useState('')
  const [results,   setResults]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [selected,  setSelected]  = useState(null)
  const [all,       setAll]       = useState([])

  useEffect(() => {
    fetch(`${BASE}/api/personnel/?page_size=500`, {headers:hdrs()})
      .then(r=>r.json()).then(d=>setAll(d.results||d||[])).catch(()=>{})
  }, [])

  useEffect(() => {
    if (!search.trim()) { setResults([]); return }
    const q = search.toLowerCase()
    const found = all.filter(p =>
      [p.nom,p.prenom,p.societe,p.email,p.numero,p.matricule].some(v=>(v||'').toLowerCase().includes(q))
    )
    setResults(found.slice(0,20))
  }, [search, all])

  const getStatus = (p) => {
    if (!p.actif) return { label:'Inactif', color:'#94a3b8', bg:'#f8fafc' }
    return { label:'Présent', color:'#16a34a', bg:'#f0fdf4' }
  }

  const inp = {
    width:'100%', border:'2px solid #e2e8f0', borderRadius:12,
    padding:'14px 18px', fontSize:15, outline:'none', boxSizing:'border-box'
  }

  return (
    <div style={{padding:16, maxWidth:900, margin:'0 auto'}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:24,fontWeight:800,color:'#1e3a8a',margin:0}}>📋 Annuaire du Site</h1>
        <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
          Recherche instantanée · {all.length} personnes enregistrées
        </div>
      </div>

      {/* Barre de recherche */}
      <div style={{position:'relative',marginBottom:24}}>
        <span style={{position:'absolute',left:16,top:'50%',transform:'translateY(-50%)',fontSize:20}}>🔍</span>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Rechercher par nom, société, badge, matricule..."
          style={{...inp, paddingLeft:50, fontSize:16, boxShadow:'0 4px 16px rgba(30,58,138,.1)'}}
          autoFocus
        />
        {search && (
          <button onClick={()=>{setSearch('');setResults([]);setSelected(null)}}
            style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',
              background:'#f1f5f9',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:18}}>
            ✕
          </button>
        )}
      </div>

      {/* Résultats */}
      {search && results.length === 0 && (
        <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:15}}>
          Aucun résultat pour "<b>{search}</b>"
        </div>
      )}

      {!search && (
        <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>
          <div style={{fontSize:48,marginBottom:12}}>🔍</div>
          <div style={{fontSize:16,fontWeight:600}}>Tapez un nom, une société, un matricule...</div>
        </div>
      )}

      <div style={{display:'flex',gap:16}}>
        {/* Liste résultats */}
        {results.length > 0 && (
          <div style={{flex:1, display:'flex', flexDirection:'column', gap:8}}>
            {results.map(p => {
              const st = getStatus(p)
              return (
                <div key={p.id} onClick={()=>setSelected(p)}
                  style={{background: selected?.id===p.id ? '#eff6ff' : '#fff',
                    border: selected?.id===p.id ? '2px solid #1e3a8a' : '2px solid #f1f5f9',
                    borderRadius:12, padding:'14px 16px', cursor:'pointer',
                    display:'flex', alignItems:'center', gap:14,
                    transition:'all .15s', boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                  {/* Avatar */}
                  <div style={{width:44,height:44,borderRadius:12,
                    background:`linear-gradient(135deg,#1e3a8a,#2563eb)`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    color:'#fff',fontWeight:800,fontSize:18,flexShrink:0}}>
                    {(p.nom||'?')[0]}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#1e293b'}}>
                      {p.nom} {p.prenom}
                    </div>
                    <div style={{fontSize:12,color:'#64748b'}}>
                      {p.societe||'—'} · {p.type_personnel||'—'}
                    </div>
                  </div>
                  <span style={{background:st.bg,color:st.color,padding:'3px 10px',
                    borderRadius:99,fontSize:11,fontWeight:700,flexShrink:0}}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Fiche détaillée */}
        {selected && (
          <div style={{width:340, flexShrink:0, background:'#fff', borderRadius:16,
            boxShadow:'0 4px 20px rgba(0,0,0,.08)', padding:24, alignSelf:'flex-start',
            position:'sticky', top:16}}>
            {/* En-tête */}
            <div style={{textAlign:'center',marginBottom:20}}>
              <div style={{width:72,height:72,borderRadius:20,
                background:'linear-gradient(135deg,#1e3a8a,#2563eb)',
                display:'flex',alignItems:'center',justifyContent:'center',
                color:'#fff',fontWeight:900,fontSize:28,margin:'0 auto 12px'}}>
                {(selected.nom||'?')[0]}
              </div>
              <div style={{fontWeight:800,fontSize:18,color:'#1e293b'}}>
                {selected.nom} {selected.prenom}
              </div>
              <div style={{fontSize:13,color:'#64748b'}}>{selected.societe||'—'}</div>
              <span style={{background: selected.actif?'#dcfce7':'#fee2e2',
                color: selected.actif?'#16a34a':'#dc2626',
                padding:'4px 14px',borderRadius:99,fontSize:12,fontWeight:700,
                display:'inline-block',marginTop:8}}>
                {selected.actif ? '🟢 Présent au camp' : '🔴 Absent / Inactif'}
              </span>
            </div>

            {/* Infos */}
            {[
              ['🏠 Résidence', selected.batiment_nom || selected.residence || '—'],
              ['🏢 Société', selected.societe || '—'],
              ['👤 Type', selected.type_personnel || '—'],
              ['🎓 Induction', selected.inductionrecord ?
                (selected.inductionrecord.statut==='valide'?'✅ Induit':'⏳ En cours') :
                '❌ Non commencé'],
              ['📞 Téléphone', selected.numero || '—'],
              ['📧 Email', selected.email || '—'],
              ['🪪 Matricule', selected.matricule || '—'],
              ['📅 Arrivée', selected.date_creation?.slice(0,10) || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{display:'flex',justifyContent:'space-between',
                padding:'8px 0',borderBottom:'1px solid #f1f5f9',alignItems:'center'}}>
                <span style={{fontSize:12,color:'#64748b',fontWeight:600}}>{label}</span>
                <span style={{fontSize:12,color:'#1e293b',fontWeight:700,textAlign:'right',maxWidth:'55%'}}>{value}</span>
              </div>
            ))}

            {/* Boutons d'action rapide */}
            {(selected.numero || selected.email) && (
              <div style={{display:'flex',gap:10,marginTop:16,marginBottom:4}}>
                {selected.numero && (
                  <a href={`tel:${selected.numero}`}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
                      gap:8,padding:'12px',borderRadius:12,textDecoration:'none',fontWeight:700,
                      fontSize:14,background:'#059669',color:'#fff',
                      boxShadow:'0 2px 8px rgba(5,150,105,.3)'}}>
                    📞 Appeler
                  </a>
                )}
                {selected.numero && (
                  <a href={`sms:${selected.numero}`}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
                      gap:8,padding:'12px',borderRadius:12,textDecoration:'none',fontWeight:700,
                      fontSize:14,background:'#1d4ed8',color:'#fff',
                      boxShadow:'0 2px 8px rgba(29,78,216,.3)'}}>
                    💬 Message
                  </a>
                )}
                {!selected.numero && selected.email && (
                  <a href={`mailto:${selected.email}`}
                    style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
                      gap:8,padding:'12px',borderRadius:12,textDecoration:'none',fontWeight:700,
                      fontSize:14,background:'#7c3aed',color:'#fff'}}>
                    📧 Email
                  </a>
                )}
              </div>
            )}

            {/* Voyage actif */}
            <div style={{marginTop:12,background:'#f0fdf4',borderRadius:10,padding:'10px 14px'}}>
              <div style={{fontSize:11,fontWeight:700,color:'#16a34a',marginBottom:4}}>✈️ VOYAGE ACTIF</div>
              <div style={{fontSize:12,color:'#166534'}}>
                {selected.voyage_actif ? selected.voyage_actif : 'Aucun déplacement en cours'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
