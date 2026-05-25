/**
 * InductionPage — Gestion des inductions QHSE
 * Intégrée avec le module Personnel existant
 */
import React, { useState, useEffect, useCallback } from 'react'
import { personnel as personnelAPI } from '../api'
import api from '../api'

// ── Error Boundary ─────────────────────────────────────
class InductionBoundary extends React.Component {
  constructor(p) { super(p); this.state = {err:null} }
  static getDerivedStateFromError(e) { return {err:e.message||'Erreur'} }
  render() {
    if (this.state.err) return (
      <div style={{padding:40,textAlign:'center'}}>
        <div style={{fontSize:48}}>⚠️</div>
        <div style={{fontWeight:700,color:'#dc2626',marginBottom:8}}>{this.state.err}</div>
        <button onClick={()=>this.setState({err:null})}
          style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 24px',borderRadius:10,cursor:'pointer'}}>
          🔄 Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

// ── Statuts induction ──────────────────────────────────
const STATUTS = {
  non_induit:    {l:'Non induit',       c:'#94a3b8', bg:'#f8fafc'},
  en_cours:      {l:'En cours',         c:'#f59e0b', bg:'#fef3c7'},
  induit:        {l:'Induit ✅',         c:'#16a34a', bg:'#f0fdf4'},
  expire:        {l:'Expiré ❌',         c:'#dc2626', bg:'#fef2f2'},
  suspendu:      {l:'Suspendu ⚠️',      c:'#7c3aed', bg:'#f5f3ff'},
}

const ETAPES = [
  {key:'docs',      icon:'📄', label:'Documents'},
  {key:'formation', icon:'🎓', label:'Formation QHSE'},
  {key:'quiz',      icon:'📋', label:'Quiz'},
  {key:'medical',   icon:'🏥', label:'Médical FIT'},
  {key:'badge',     icon:'🎫', label:'Badge QR'},
]

// Clé localStorage pour inductions
const LS_KEY = 'rzi_inductions'

function getInductions() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}') } catch { return {} }
}
function saveInduction(id, data) {
  const all = getInductions()
  all[id] = {...(all[id]||{}), ...data, updated:Date.now()}
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

export default function InductionPage() {
  const [personnel,   setPersonnel]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [typeFilter,  setTypeFilter]  = useState('')
  const [selected,    setSelected]    = useState(null)   // personnage sélectionné
  const [inductions,  setInductions]  = useState(getInductions())
  const [saving,      setSaving]      = useState(false)
  const [tab,         setTab]         = useState('liste')  // 'liste'|'dashboard'

  const load = useCallback(() => {
    setLoading(true)
    personnelAPI.list({page_size:500})
      .then(r => setPersonnel(r.data.results||r.data||[]))
      .catch(()=>setPersonnel([]))
      .finally(()=>setLoading(false))
  },[])

  useEffect(()=>{ load() },[load])

  const ind = (p) => inductions[p.id] || {statut:'non_induit', etapes:{}}
  
  const marquerEtape = (pid, etape, val) => {
    const curr = ind({id:pid})
    const etapes = {...(curr.etapes||{}), [etape]:val}
    const allDone = ETAPES.slice(0,-1).every(e => etapes[e.key])
    const statut = allDone ? 'induit' : Object.values(etapes).some(Boolean) ? 'en_cours' : 'non_induit'
    const newData = {...curr, etapes, statut}
    saveInduction(pid, newData)
    setInductions(getInductions())
  }

  const filtered = personnel.filter(p => {
    const q = search.toLowerCase()
    const ms = !q || [p.nom,p.prenom,p.societe].some(v=>(v||'').toLowerCase().includes(q))
    const mt = !typeFilter || p.type_personnel===typeFilter
    return ms && mt
  })

  const stats = {
    total:    personnel.length,
    induit:   personnel.filter(p=>ind(p).statut==='induit').length,
    en_cours: personnel.filter(p=>ind(p).statut==='en_cours').length,
    non:      personnel.filter(p=>!ind(p).statut||ind(p).statut==='non_induit').length,
  }

  const conformite = stats.total ? Math.round(stats.induit/stats.total*100) : 0

  const TYPES = [
    {v:'roxgold',l:'Roxgold'},{v:'soustraitant',l:'Sous-traitant'},
    {v:'visiteur',l:'Visiteur'},{v:'consultant',l:'Consultant'},
  ]

  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}

  return (
    <InductionBoundary>
    <div style={{maxWidth:1100,margin:'0 auto',padding:20}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
        borderRadius:16,padding:'18px 24px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,margin:0}}>🎓 Induction QHSE</h1>
            <p style={{fontSize:12,color:'rgba(255,255,255,.7)',margin:'4px 0 0'}}>
              Gestion des inductions — Résidence Roxgold Sango
            </p>
          </div>
          <div style={{display:'flex',gap:16,textAlign:'center'}}>
            <div>
              <div style={{fontFamily:'monospace',fontSize:28,fontWeight:900,color:'#f0a500'}}>{conformite}%</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>Conformité</div>
            </div>
            <div style={{width:1,background:'rgba(255,255,255,.2)'}}/>
            <div>
              <div style={{fontFamily:'monospace',fontSize:28,fontWeight:900,color:'#4ade80'}}>{stats.induit}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>Induits</div>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['liste','📋 Liste Personnel'],['dashboard','📊 Tableau de bord']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:'8px 18px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
              fontSize:13,fontWeight:700,border:'none',
              background:tab===k?'#1e3a8a':'#f8fafc',
              color:tab===k?'#fff':'#64748b'}}>
            {l}
          </button>
        ))}
      </div>

      {/* === ONGLET LISTE === */}
      {tab==='liste' && (
        <>
          {/* Filtres */}
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Rechercher..." style={{...inp,maxWidth:260}}/>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
              style={{...inp,maxWidth:160}}>
              <option value="">Tous les types</option>
              {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:60,fontSize:32}}>⏳</div>
          ) : (
            <div style={{background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.08)'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:'#f8fafc',borderBottom:'2px solid #e2e8f0'}}>
                    {['Personnel','Type','Société','Statut Induction','Progression','Actions'].map(h=>(
                      <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,
                        fontWeight:700,color:'#64748b',textTransform:'uppercase'}}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p,i)=>{
                    const idata = ind(p)
                    const s = STATUTS[idata.statut]||STATUTS.non_induit
                    const etapesDone = ETAPES.filter(e=>idata.etapes?.[e.key]).length
                    const progress = Math.round(etapesDone/ETAPES.length*100)
                    return (
                      <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9',
                        background:i%2?'#fafbfc':'#fff'}}>
                        <td style={{padding:'10px 14px'}}>
                          <div style={{fontWeight:600,fontSize:13}}>{p.nom} {p.prenom}</div>
                          <div style={{fontSize:11,color:'#94a3b8'}}>{p.email||''}</div>
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <span style={{background:'#eff6ff',color:'#2563eb',padding:'2px 8px',
                            borderRadius:99,fontSize:11,fontWeight:700}}>
                            {TYPES.find(t=>t.v===p.type_personnel)?.l||p.type_personnel}
                          </span>
                        </td>
                        <td style={{padding:'10px 14px',fontSize:12,color:'#475569'}}>
                          {p.societe||'—'}
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <span style={{background:s.bg,color:s.c,padding:'3px 10px',
                            borderRadius:99,fontSize:11,fontWeight:700}}>
                            {s.l}
                          </span>
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{flex:1,height:6,background:'#e2e8f0',borderRadius:99}}>
                              <div style={{width:progress+'%',height:'100%',
                                background:progress===100?'#16a34a':'#1e3a8a',
                                borderRadius:99,transition:'width .3s'}}/>
                            </div>
                            <span style={{fontSize:10,fontWeight:700,color:'#64748b',minWidth:28}}>
                              {progress}%
                            </span>
                          </div>
                        </td>
                        <td style={{padding:'10px 14px'}}>
                          <button onClick={()=>setSelected(p)}
                            style={{background:'#1e3a8a',color:'#fff',border:'none',
                              padding:'5px 12px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700}}>
                            Gérer →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* === ONGLET DASHBOARD === */}
      {tab==='dashboard' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12,marginBottom:24}}>
            {[
              ['👥 Total personnel',stats.total,'#1e3a8a'],
              ['✅ Induits',stats.induit,'#16a34a'],
              ['⏳ En cours',stats.en_cours,'#f59e0b'],
              ['❌ Non induits',stats.non,'#dc2626'],
              ['📊 Conformité',conformite+'%','#7c3aed'],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:'#fff',borderRadius:12,padding:'14px 16px',
                borderTop:'3px solid '+c,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontFamily:'monospace',fontSize:24,fontWeight:900,color:c}}>{v}</div>
                <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Workflow visuel */}
          <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 1px 6px rgba(0,0,0,.08)'}}>
            <h3 style={{fontSize:14,fontWeight:700,color:'#1e3a8a',marginBottom:16}}>
              🔄 Processus d'induction
            </h3>
            <div style={{display:'flex',alignItems:'center',overflowX:'auto',paddingBottom:8}}>
              {ETAPES.map((e,i,arr)=>(
                <React.Fragment key={e.key}>
                  <div style={{textAlign:'center',minWidth:80}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:'#1e3a8a',
                      color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:20,margin:'0 auto 6px'}}>
                      {e.icon}
                    </div>
                    <div style={{fontSize:10,color:'#64748b'}}>{e.label}</div>
                  </div>
                  {i<arr.length-1 && <div style={{flex:1,height:2,background:'#e2e8f0',minWidth:20,marginBottom:20}}/>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === PANEL DETAIL INDUCTION === */}
      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:560,
            maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            
            {/* Header */}
            <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',
              padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',
              position:'sticky',top:0}}>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>{selected.nom} {selected.prenom}</div>
                <div style={{fontSize:11,opacity:.8}}>{selected.societe} · {TYPES.find(t=>t.v===selected.type_personnel)?.l}</div>
              </div>
              <button onClick={()=>setSelected(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18}}>✕</button>
            </div>

            <div style={{padding:20}}>
              {/* Statut global */}
              {(() => {
                const idata = ind(selected)
                const s = STATUTS[idata.statut]||STATUTS.non_induit
                return (
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    background:s.bg,borderRadius:12,padding:'12px 16px',marginBottom:20}}>
                    <div style={{fontWeight:700,color:s.c,fontSize:15}}>{s.l}</div>
                    {idata.statut==='induit' && (
                      <div style={{fontSize:10,color:'#16a34a'}}>
                        ✅ Badge actif — QR généré
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Étapes */}
              <h3 style={{fontSize:13,fontWeight:700,color:'#1e3a8a',marginBottom:12}}>
                Étapes d'induction
              </h3>
              {ETAPES.map(e=>{
                const done = !!(ind(selected).etapes||{})[e.key]
                return (
                  <div key={e.key} style={{display:'flex',alignItems:'center',gap:12,
                    padding:'12px 14px',marginBottom:8,borderRadius:12,
                    background:done?'#f0fdf4':'#f8fafc',
                    border:'1.5px solid '+(done?'#86efac':'#e2e8f0')}}>
                    <div style={{fontSize:24}}>{e.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:13,color:done?'#16a34a':'#1e293b'}}>
                        {e.label}
                      </div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>
                        {done ? '✅ Complété' : 'En attente'}
                      </div>
                    </div>
                    <button onClick={()=>marquerEtape(selected.id, e.key, !done)}
                      style={{background:done?'#fef2f2':'#f0fdf4',
                        color:done?'#dc2626':'#16a34a',
                        border:'1.5px solid '+(done?'#fca5a5':'#86efac'),
                        padding:'5px 12px',borderRadius:8,cursor:'pointer',
                        fontSize:11,fontWeight:700}}>
                      {done ? '✗ Annuler' : '✓ Valider'}
                    </button>
                  </div>
                )
              })}

              {/* Actions */}
              <div style={{display:'flex',gap:10,marginTop:16}}>
                <button onClick={()=>{
                  ETAPES.forEach(e=>marquerEtape(selected.id,e.key,true))
                }} style={{flex:1,background:'#1e3a8a',color:'#fff',border:'none',
                  padding:11,borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                  fontSize:13,fontWeight:700}}>
                  ✅ Valider tout
                </button>
                <button onClick={()=>{
                  ETAPES.forEach(e=>marquerEtape(selected.id,e.key,false))
                }} style={{flex:1,background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',
                  padding:11,borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                  🔄 Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </InductionBoundary>
  )
}
