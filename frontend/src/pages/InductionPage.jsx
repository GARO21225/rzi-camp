/**
 * InductionPage — Workflow QHSE automatique par personnel
 * Se déclenche automatiquement à la création d'un membre du personnel
 */
import React, { useState, useEffect, useCallback } from 'react'
import { personnel as personnelAPI } from '../api'

const LS_KEY = 'rzi_inductions_v2'

// Étapes du workflow induction
const ETAPES = [
  { key:'accueil',     icon:'👋', label:'Accueil & Enregistrement', desc:'Création du dossier, informations personnelles, affectation' },
  { key:'documents',   icon:'📄', label:'Documents obligatoires',   desc:'CNI/Passeport, contrat, certificats, photos' },
  { key:'formation',   icon:'🎓', label:'Formation QHSE',           desc:'Modules sécurité, vidéos, présentation site' },
  { key:'quiz',        icon:'📋', label:'Quiz QHSE',                desc:'QCM — score minimum 80%, tentatives multiples' },
  { key:'medical',     icon:'🏥', label:'Visite médicale',          desc:'Température, alcool, drogues → FIT / UNFIT' },
  { key:'badge',       icon:'🎫', label:'Badge & QR Code',          desc:'Génération automatique si toutes étapes validées' },
]

const STATUT_COLOR = {
  non_commence: { c:'#94a3b8', bg:'#f8fafc', l:'Non commencé' },
  en_cours:     { c:'#f59e0b', bg:'#fef3c7', l:'En cours' },
  valide:       { c:'#16a34a', bg:'#f0fdf4', l:'Validé ✅' },
  refuse:       { c:'#dc2626', bg:'#fef2f2', l:'Refusé ❌' },
  expire:       { c:'#7c3aed', bg:'#f5f3ff', l:'Expiré ⏰' },
}

function getAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}') } catch { return {} }
}

function getWF(id) {
  const all = getAll()
  // Auto-init si pas encore de workflow
  if (!all[id]) {
    all[id] = {
      statut: 'en_cours',
      etapes: { accueil: { done: true, date: new Date().toISOString(), note: '' } },
      created: new Date().toISOString(),
    }
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  }
  return all[id]
}

function setWF(id, data) {
  const all = getAll()
  all[id] = { ...all[id], ...data }
  localStorage.setItem(LS_KEY, JSON.stringify(all))
}

function setEtape(id, key, done, note='') {
  const wf = getWF(id)
  const etapes = { ...wf.etapes, [key]: { done, date: new Date().toISOString(), note } }
  const allDone = ETAPES.every(e => etapes[e.key]?.done)
  const statut = allDone ? 'valide' : Object.values(etapes).some(e=>e?.done) ? 'en_cours' : 'non_commence'
  setWF(id, { etapes, statut })
}

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
          Réessayer
        </button>
      </div>
    )
    return this.props.children
  }
}

export default function InductionPage() {
  const [personnel,  setPersonnel]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected,   setSelected]   = useState(null)
  const [wfData,     setWfData]     = useState({})
  const [noteModal,  setNoteModal]  = useState(null)  // {etape_key, note}
  const [etapeNote,  setEtapeNote]  = useState('')
  const [tab,        setTab]        = useState('liste')
  const [refresh,    setRefresh]    = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    personnelAPI.list({page_size:500})
      .then(r => {
        const list = r.data.results || r.data || []
        setPersonnel(list)
        // Charger/initialiser workflow pour chaque personnel
        const wf = {}
        list.forEach(p => { wf[p.id] = getWF(p.id) })
        setWfData(wf)
      })
      .catch(()=>setPersonnel([]))
      .finally(()=>setLoading(false))
  },[])

  useEffect(()=>{ load() },[load])
  useEffect(()=>{ if(refresh>0) load() },[refresh])

  const wf = (p) => wfData[p.id] || getWF(p.id)
  const progress = (p) => {
    const w = wf(p)
    const done = ETAPES.filter(e => w.etapes?.[e.key]?.done).length
    return Math.round(done / ETAPES.length * 100)
  }

  const filtered = personnel.filter(p => {
    const q = search.toLowerCase()
    if (q && ![p.nom,p.prenom,p.societe].some(v=>(v||'').toLowerCase().includes(q))) return false
    if (typeFilter && p.type_personnel !== typeFilter) return false
    return true
  })

  const stats = {
    total:   personnel.length,
    valide:  personnel.filter(p=>wf(p).statut==='valide').length,
    cours:   personnel.filter(p=>wf(p).statut==='en_cours').length,
    non:     personnel.filter(p=>!wf(p).statut||wf(p).statut==='non_commence').length,
  }

  const TYPES = [
    {v:'roxgold',l:'Roxgold'},{v:'soustraitant',l:'Sous-traitant'},{v:'visiteur',l:'Visiteur'}
  ]

  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',
    fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}

  return (
    <InductionBoundary>
    <div style={{maxWidth:1100,margin:'0 auto',padding:20}}>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
        borderRadius:16,padding:'18px 24px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:22,fontWeight:900,margin:0}}>🎓 Induction QHSE</h1>
            <p style={{fontSize:12,color:'rgba(255,255,255,.7)',margin:'4px 0 0'}}>
              Workflow automatique — déclenché à la création de chaque membre du personnel
            </p>
          </div>
          <div style={{display:'flex',gap:20,textAlign:'center'}}>
            {[['✅',stats.valide,'Validés','#4ade80'],['⏳',stats.cours,'En cours','#fbbf24'],
              ['❌',stats.non,'En attente','#f87171']].map(([ic,v,l,c])=>(
              <div key={l}>
                <div style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:c}}>{v}</div>
                <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>{ic} {l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {[['liste','📋 Workflows'],['dashboard','📊 Tableau de bord']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:'8px 16px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
              fontSize:13,fontWeight:700,border:'none',
              background:tab===k?'#1e3a8a':'#f8fafc',
              color:tab===k?'#fff':'#64748b'}}>
            {l}
          </button>
        ))}
      </div>

      {/* === LISTE WORKFLOWS === */}
      {tab==='liste' && (
        <>
          <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Rechercher personnel..."
              style={{...inp,maxWidth:260}}/>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}
              style={{...inp,maxWidth:160}}>
              <option value="">Tous les types</option>
              {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{textAlign:'center',padding:60,fontSize:32}}>⏳</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {filtered.map(p=>{
                const w = wf(p)
                const prog = progress(p)
                const s = STATUT_COLOR[w.statut] || STATUT_COLOR.en_cours
                return (
                  <div key={p.id} onClick={()=>setSelected(p)}
                    style={{background:'#fff',borderRadius:12,padding:'14px 16px',
                      boxShadow:'0 1px 4px rgba(0,0,0,.07)',cursor:'pointer',
                      borderLeft:`4px solid ${s.c}`,
                      outline: selected?.id===p.id ? `2px solid ${s.c}` : 'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14}}>{p.nom} {p.prenom}</div>
                        <div style={{fontSize:11,color:'#64748b'}}>
                          {TYPES.find(t=>t.v===p.type_personnel)?.l} · {p.societe||'—'}
                        </div>
                      </div>
                      <span style={{background:s.bg,color:s.c,padding:'3px 10px',
                        borderRadius:99,fontSize:11,fontWeight:700}}>
                        {s.l}
                      </span>
                    </div>
                    {/* Barre de progression */}
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
                      <div style={{flex:1,height:8,background:'#e2e8f0',borderRadius:99}}>
                        <div style={{width:prog+'%',height:'100%',
                          background:prog===100?'#16a34a':'#1e3a8a',
                          borderRadius:99,transition:'width .3s'}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:'#64748b',minWidth:32}}>
                        {prog}%
                      </span>
                    </div>
                    {/* Étapes mini */}
                    <div style={{display:'flex',gap:4,marginTop:8}}>
                      {ETAPES.map(e=>{
                        const done = !!(w.etapes?.[e.key]?.done)
                        return (
                          <div key={e.key}
                            title={e.label+(done?' — ✅':'')+(!done?' — En attente':'')}
                            style={{width:24,height:24,borderRadius:'50%',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:12,
                              background:done?'#1e3a8a20':'#f1f5f9',
                              border:done?'1px solid #1e3a8a':'1px solid #e2e8f0'}}>
                            {done ? '✓' : e.icon}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* === DASHBOARD === */}
      {tab==='dashboard' && (
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',
            gap:12,marginBottom:24}}>
            {[
              ['👥 Total',stats.total,'#1e3a8a'],
              ['✅ Validés',stats.valide,'#16a34a'],
              ['⏳ En cours',stats.cours,'#f59e0b'],
              ['❌ En attente',stats.non,'#dc2626'],
              ['📊 Conformité',stats.total?(stats.valide/stats.total*100).toFixed(0)+'%':'-','#7c3aed'],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:'#fff',borderRadius:12,padding:'14px 16px',
                borderTop:'3px solid '+c,boxShadow:'0 1px 4px rgba(0,0,0,.07)'}}>
                <div style={{fontFamily:'monospace',fontSize:24,fontWeight:900,color:c}}>{v}</div>
                <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
          {/* Workflow référence */}
          <div style={{background:'#fff',borderRadius:14,padding:20,boxShadow:'0 1px 6px rgba(0,0,0,.08)'}}>
            <h3 style={{fontSize:14,fontWeight:700,color:'#1e3a8a',marginBottom:16}}>
              🔄 Processus d'induction — 6 étapes obligatoires
            </h3>
            <div style={{display:'flex',alignItems:'flex-start',overflowX:'auto',paddingBottom:8,gap:0}}>
              {ETAPES.map((e,i,arr)=>(
                <React.Fragment key={e.key}>
                  <div style={{minWidth:100,textAlign:'center',flexShrink:0}}>
                    <div style={{width:48,height:48,borderRadius:'50%',background:'#1e3a8a',
                      color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:22,margin:'0 auto 8px',boxShadow:'0 2px 8px rgba(30,58,138,.3)'}}>
                      {e.icon}
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:'#1e3a8a'}}>{i+1}. {e.label}</div>
                    <div style={{fontSize:9,color:'#94a3b8',marginTop:3,maxWidth:90,margin:'3px auto 0'}}>{e.desc}</div>
                  </div>
                  {i<arr.length-1&&<div style={{flex:1,height:2,background:'#e2e8f0',
                    minWidth:20,marginTop:24,flexShrink:0}}/>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ PANEL WORKFLOW INDIVIDUEL ══ */}
      {selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
          display:'flex',alignItems:'center',justifyContent:'flex-end',zIndex:1000}}
          onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div style={{background:'#fff',width:'100%',maxWidth:480,height:'100%',
            overflow:'auto',boxShadow:'-4px 0 30px rgba(0,0,0,.2)'}}>

            {/* Header */}
            {(() => {
              const w = wf(selected)
              const s = STATUT_COLOR[w.statut] || STATUT_COLOR.en_cours
              const prog = progress(selected)
              return (
                <>
                  <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
                    padding:'16px 20px',position:'sticky',top:0,zIndex:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:16}}>{selected.nom} {selected.prenom}</div>
                        <div style={{fontSize:11,opacity:.8,marginTop:2}}>
                          {TYPES.find(t=>t.v===selected.type_personnel)?.l} · {selected.societe||'—'}
                        </div>
                      </div>
                      <button onClick={()=>setSelected(null)}
                        style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                          width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18}}>✕</button>
                    </div>
                    <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10}}>
                      <div style={{flex:1,height:8,background:'rgba(255,255,255,.2)',borderRadius:99}}>
                        <div style={{width:prog+'%',height:'100%',background:'#4ade80',
                          borderRadius:99,transition:'width .3s'}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:'#4ade80'}}>{prog}%</span>
                    </div>
                    <span style={{background:s.bg,color:s.c,padding:'3px 10px',borderRadius:99,
                      fontSize:11,fontWeight:700,display:'inline-block',marginTop:8}}>
                      {s.l}
                    </span>
                  </div>

                  {/* Étapes */}
                  <div style={{padding:20,display:'flex',flexDirection:'column',gap:10}}>
                    {ETAPES.map(e=>{
                      const done = !!(w.etapes?.[e.key]?.done)
                      const info = w.etapes?.[e.key]
                      return (
                        <div key={e.key} style={{
                          background:done?'#f0fdf4':'#f8fafc',
                          border:'1.5px solid '+(done?'#86efac':'#e2e8f0'),
                          borderRadius:12,padding:'12px 14px',
                          display:'flex',alignItems:'center',gap:12}}>
                          <div style={{fontSize:26,flexShrink:0}}>{e.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:13,
                              color:done?'#16a34a':'#1e293b'}}>
                              {e.label}
                            </div>
                            <div style={{fontSize:11,color:'#64748b',marginTop:1}}>{e.desc}</div>
                            {info?.note && (
                              <div style={{fontSize:10,color:'#7c3aed',marginTop:3,
                                background:'#f5f3ff',padding:'3px 8px',borderRadius:6,
                                display:'inline-block'}}>
                                📝 {info.note}
                              </div>
                            )}
                            {info?.date && done && (
                              <div style={{fontSize:9,color:'#94a3b8',marginTop:2}}>
                                {new Date(info.date).toLocaleDateString('fr-FR')}
                              </div>
                            )}
                          </div>
                          <div style={{display:'flex',gap:6,flexShrink:0}}>
                            <button onClick={()=>{setNoteModal({key:e.key,done});setEtapeNote(info?.note||'')}}
                              style={{background:'#f8fafc',border:'1px solid #e2e8f0',
                                padding:'4px 8px',borderRadius:7,cursor:'pointer',fontSize:11}}>
                              📝
                            </button>
                            <button onClick={()=>{
                              const newNote = w.etapes?.[e.key]?.note||''
                              setEtape(selected.id,e.key,!done,newNote)
                              setWfData(prev=>({...prev,[selected.id]:getWF(selected.id)}))
                            }} style={{
                              background:done?'#fef2f2':'#f0fdf4',
                              color:done?'#dc2626':'#16a34a',
                              border:'1.5px solid '+(done?'#fca5a5':'#86efac'),
                              padding:'4px 12px',borderRadius:8,cursor:'pointer',
                              fontSize:11,fontWeight:700}}>
                              {done?'✗ Annuler':'✓ Valider'}
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Actions globales */}
                    <div style={{display:'flex',gap:8,marginTop:8}}>
                      <button onClick={()=>{
                        ETAPES.forEach(e=>setEtape(selected.id,e.key,true,'Validé en lot'))
                        setWfData(prev=>({...prev,[selected.id]:getWF(selected.id)}))
                      }} style={{flex:1,background:'#1e3a8a',color:'#fff',border:'none',
                        padding:11,borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                        fontSize:12,fontWeight:700}}>
                        ✅ Valider tout
                      </button>
                      <button onClick={()=>{
                        ETAPES.forEach(e=>{if(e.key!=='accueil')setEtape(selected.id,e.key,false,'')})
                        setWfData(prev=>({...prev,[selected.id]:getWF(selected.id)}))
                      }} style={{flex:1,background:'#fef2f2',color:'#dc2626',
                        border:'1px solid #fca5a5',padding:11,borderRadius:10,cursor:'pointer',
                        fontFamily:'inherit',fontSize:12}}>
                        🔄 Réinitialiser
                      </button>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modal note */}
      {noteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setNoteModal(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:380,
            overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)',color:'#fff',
              padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700}}>📝 Note / Observation</span>
              <button onClick={()=>setNoteModal(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:26,height:26,borderRadius:6,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:16}}>
              <textarea value={etapeNote} onChange={e=>setEtapeNote(e.target.value)}
                placeholder="Observations, commentaire..."
                rows={4} style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,
                  padding:'9px 12px',fontSize:13,outline:'none',resize:'vertical',
                  boxSizing:'border-box'}}/>
              <button onClick={()=>{
                if(selected && noteModal) {
                  const w = getWF(selected.id)
                  const done = !!(w.etapes?.[noteModal.key]?.done)
                  setEtape(selected.id, noteModal.key, done, etapeNote)
                  setWfData(prev=>({...prev,[selected.id]:getWF(selected.id)}))
                  setNoteModal(null)
                }
              }} style={{width:'100%',background:'#7c3aed',color:'#fff',border:'none',
                padding:11,borderRadius:9,cursor:'pointer',marginTop:10,
                fontSize:13,fontWeight:700,fontFamily:'inherit'}}>
                💾 Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </InductionBoundary>
  )
}
