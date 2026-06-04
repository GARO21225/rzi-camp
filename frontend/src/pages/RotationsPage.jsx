import { useState, useEffect, useCallback } from 'react'
import { voyages as voyAPI } from '../api'

const STATUT_CFG = {
  planifie:   { l:'Planifié',    ic:'📋', c:'#1e3a8a', bg:'#eff6ff' },
  en_voyage:  { l:'En déplacement', ic:'✈️', c:'#7c3aed', bg:'#f5f3ff' },
  retour:     { l:'Retour camp', ic:'🏠', c:'#059669', bg:'#f0fdf4' },
  annule:     { l:'Annulé',      ic:'❌', c:'#dc2626', bg:'#fee2e2' },
}

const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function getWeekDates(offset=0) {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 + offset * 7)
  return Array.from({length:7}, (_,i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function fmt(iso) {
  if(!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
}

function fmtFull(d) {
  return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})
}

function isOnDay(voyage, date) {
  const dep  = new Date(voyage.date_depart)
  const ret  = new Date(voyage.date_retour_prevue || voyage.date_retour_effective || voyage.date_depart)
  const d    = new Date(date); d.setHours(0,0,0,0)
  dep.setHours(0,0,0,0); ret.setHours(0,0,0,0)
  return d >= dep && d <= ret
}

export default function RotationsPage() {
  const [voyages,    setVoyages]    = useState([])
  const [personnel,  setPersonnel]  = useState([])
  const [stats,      setStats]      = useState({})
  const [loading,    setLoading]    = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [view,       setView]       = useState('board')  // 'board' | 'list' | 'manifest'
  const [modal,      setModal]      = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [search,     setSearch]     = useState('')
  const [statFilter, setStatFilter] = useState('')
  const [form, setForm] = useState({
    personnel:'',destination:'Abidjan',motif:'',
    date_depart:'',date_retour_prevue:'',statut:'planifie'
  })
  const [saving, setSaving] = useState(false)

  const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
  const tok  = () => localStorage.getItem('access_token')||''
  const hdrs = () => ({Authorization:`Bearer ${tok()}`,'Content-Type':'application/json'})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rv, rp, rs] = await Promise.allSettled([
        fetch(`${BASE}/api/voyages/?page_size=200`, {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/personnel/?page_size=200&actif=true`, {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/voyages/stats/`, {headers:hdrs()}).then(r=>r.json()),
      ])
      if(rv.status==='fulfilled') setVoyages(rv.value?.results||rv.value||[])
      if(rp.status==='fulfilled') setPersonnel(rp.value?.results||rp.value||[])
      if(rs.status==='fulfilled') setStats(rs.value||{})
    } catch(e){}
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])

  const weekDates = getWeekDates(weekOffset)
  const today = new Date(); today.setHours(0,0,0,0)

  const filtered = voyages.filter(v=>{
    if(search && !(`${v.personnel_nom||''} ${v.destination||''}`).toLowerCase().includes(search.toLowerCase())) return false
    if(statFilter && v.statut!==statFilter) return false
    return true
  })

  // Personnes actuellement absentes du camp
  const absents = voyages.filter(v=>v.statut==='en_voyage')

  // Sauvegarder un voyage
  const saveVoyage = async () => {
    if(!form.personnel||!form.date_depart||!form.date_retour_prevue) return
    setSaving(true)
    try {
      const method = selected ? 'PUT' : 'POST'
      const url    = selected ? `${BASE}/api/voyages/${selected.id}/` : `${BASE}/api/voyages/`
      await fetch(url,{method,headers:hdrs(),body:JSON.stringify(form)})
      setModal(false); setSelected(null)
      setForm({personnel:'',destination:'Abidjan',motif:'',date_depart:'',date_retour_prevue:'',statut:'planifie'})
      load()
    }catch(e){}
    setSaving(false)
  }

  const changerStatut = async (id, statut) => {
    try {
      await fetch(`${BASE}/api/voyages/${id}/`,{method:'PATCH',headers:hdrs(),body:JSON.stringify({statut})})
      load()
    }catch(e){}
  }

  const openEdit = (v) => {
    setSelected(v)
    setForm({personnel:v.personnel||'',destination:v.destination||'',motif:v.motif||'',
      date_depart:v.date_depart||'',date_retour_prevue:v.date_retour_prevue||'',statut:v.statut||'planifie'})
    setModal(true)
  }

  return (
    <div style={{padding:20,background:'#f8fafc',minHeight:'100vh'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:900,color:'#0f172a',margin:0}}>✈️ Planning des Rotations</h1>
          <p style={{fontSize:12,color:'#64748b',margin:'4px 0 0'}}>
            Gestion des déplacements · {voyages.length} voyage(s) enregistré(s)
          </p>
        </div>
        <button onClick={()=>{setSelected(null);setForm({personnel:'',destination:'Abidjan',motif:'',date_depart:'',date_retour_prevue:'',statut:'planifie'});setModal(true)}}
          style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
            padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
          + Nouveau voyage
        </button>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10,marginBottom:18}}>
        {[
          {ic:'📋',l:'Planifiés',    v:stats.planifies||0, c:'#1e3a8a',bg:'#eff6ff'},
          {ic:'✈️',l:'En déplacement',v:stats.en_voyage||0,c:'#7c3aed',bg:'#f5f3ff'},
          {ic:'🏠',l:'Retours',      v:stats.retours||0,   c:'#059669',bg:'#f0fdf4'},
          {ic:'📅',l:'Total (mois)', v:stats.total||0,     c:'#0891b2',bg:'#ecfeff'},
          {ic:'❌',l:'Annulés',      v:stats.annules||0,   c:'#dc2626',bg:'#fee2e2'},
        ].map(k=>(
          <div key={k.l} style={{background:k.bg,borderRadius:12,padding:'12px 14px',
            borderLeft:`3px solid ${k.c}`}}>
            <div style={{fontSize:20,marginBottom:4}}>{k.ic}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.c,lineHeight:1}}>{k.v}</div>
            <div style={{fontSize:10,color:'#64748b',fontWeight:600,marginTop:3}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Onglets vue */}
      <div style={{display:'flex',gap:4,marginBottom:16,background:'#f1f5f9',
        borderRadius:10,padding:4,width:'fit-content'}}>
        {[['board','📅 Planning'],['list','📋 Liste'],['manifest','📄 Manifest']].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{padding:'6px 16px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
              background:view===v?'#fff':'transparent',
              color:view===v?'#0f172a':'#64748b',
              boxShadow:view===v?'0 1px 4px rgba(0,0,0,.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── VUE PLANNING BOARD ── */}
      {view==='board'&&(
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          {/* Navigation semaine */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'12px 16px',borderBottom:'1px solid #f1f5f9',background:'#fafafa'}}>
            <button onClick={()=>setWeekOffset(w=>w-1)}
              style={{background:'transparent',border:'1px solid #e2e8f0',borderRadius:8,
                padding:'5px 12px',cursor:'pointer',fontSize:13}}>← Sem. préc.</button>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:13,fontWeight:700,color:'#0f172a',margin:0}}>
                {fmtFull(weekDates[0])} — {fmtFull(weekDates[6])}
              </p>
              {weekOffset===0&&<p style={{fontSize:11,color:'#059669',margin:'2px 0 0',fontWeight:600}}>Semaine courante</p>}
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)}
              style={{background:'transparent',border:'1px solid #e2e8f0',borderRadius:8,
                padding:'5px 12px',cursor:'pointer',fontSize:13}}>Sem. suiv. →</button>
          </div>

          {/* Grille jours */}
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
              <thead>
                <tr>
                  <th style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,
                    color:'#64748b',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',
                    minWidth:150,textTransform:'uppercase'}}>
                    Personnel
                  </th>
                  {weekDates.map((d,i)=>{
                    const isToday = d.getTime()===today.getTime()
                    return (
                      <th key={i} style={{padding:'8px 6px',textAlign:'center',fontSize:11,fontWeight:700,
                        borderBottom:'1px solid #e2e8f0',minWidth:90,
                        background:isToday?'#eff6ff':'#f8fafc',
                        color:isToday?'#1e3a8a':'#64748b'}}>
                        <div>{JOURS[i]}</div>
                        <div style={{fontSize:14,fontWeight:900,color:isToday?'#1e3a8a':'#0f172a'}}>
                          {d.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {absents.length===0&&voyages.filter(v=>weekDates.some(d=>isOnDay(v,d))).length===0?(
                  <tr><td colSpan={8} style={{padding:30,textAlign:'center',color:'#94a3b8',fontSize:13}}>
                    Aucun déplacement cette semaine
                  </td></tr>
                ):(
                  // Grouper par personne
                  [...new Set(voyages.filter(v=>weekDates.some(d=>isOnDay(v,d))).map(v=>v.personnel_nom||v.personnel))].map(nom=>{
                    const vPerso = voyages.filter(v=>(v.personnel_nom||v.personnel)===nom)
                    return (
                      <tr key={nom} style={{borderBottom:'1px solid #f1f5f9'}}>
                        <td style={{padding:'10px 14px',fontSize:13,fontWeight:600,color:'#0f172a'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:30,height:30,borderRadius:'50%',background:'#eff6ff',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:11,fontWeight:700,color:'#1e3a8a',flexShrink:0}}>
                              {(nom||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:'#0f172a'}}>{nom}</div>
                              <div style={{fontSize:10,color:'#94a3b8'}}>
                                {vPerso[0]?.destination||''}
                              </div>
                            </div>
                          </div>
                        </td>
                        {weekDates.map((date,i)=>{
                          const v = vPerso.find(vv=>isOnDay(vv,date))
                          const isToday = date.getTime()===today.getTime()
                          if(!v) return (
                            <td key={i} style={{padding:4,textAlign:'center',
                              background:isToday?'#f0f9ff':'transparent'}}>
                              <div style={{width:'100%',height:32,borderRadius:4,
                                background:'#f8fafc',display:'flex',alignItems:'center',
                                justifyContent:'center',fontSize:14,color:'#d1d5db'}}>
                                🏠
                              </div>
                            </td>
                          )
                          const cfg = STATUT_CFG[v.statut]||STATUT_CFG.planifie
                          return (
                            <td key={i} style={{padding:4}}>
                              <div onClick={()=>openEdit(v)}
                                title={`${v.destination} · ${cfg.l}`}
                                style={{background:cfg.bg,borderRadius:4,height:32,cursor:'pointer',
                                  display:'flex',alignItems:'center',justifyContent:'center',
                                  fontSize:16,border:`1px solid ${cfg.c}22`,
                                  transition:'transform .1s'}}
                                onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1)'}
                                onMouseLeave={e=>e.currentTarget.style.transform=''}>
                                {cfg.ic}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Légende */}
          <div style={{display:'flex',gap:16,padding:'10px 16px',background:'#fafafa',
            borderTop:'1px solid #f1f5f9',flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>Légende:</span>
            {Object.entries(STATUT_CFG).map(([k,v])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748b'}}>
                <span>{v.ic}</span> {v.l}
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748b'}}>
              🏠 Au camp
            </div>
          </div>
        </div>
      )}

      {/* ── VUE LISTE ── */}
      {view==='list'&&(
        <div>
          <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Nom, destination..."
              style={{flex:1,minWidth:200,height:38,border:'1.5px solid #e2e8f0',borderRadius:9,
                padding:'0 12px',fontSize:13,outline:'none'}}/>
            <select value={statFilter} onChange={e=>setStatFilter(e.target.value)}
              style={{height:38,border:'1.5px solid #e2e8f0',borderRadius:9,padding:'0 12px',
                fontSize:13,outline:'none',background:'#fff'}}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUT_CFG).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
            </select>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map(v=>{
              const cfg = STATUT_CFG[v.statut]||STATUT_CFG.planifie
              return (
                <div key={v.id} style={{background:'#fff',borderRadius:12,padding:'14px 18px',
                  border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:14,
                  boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:cfg.bg,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                    {cfg.ic}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:14,color:'#0f172a'}}>{v.personnel_nom||'—'}</div>
                    <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                      📍 {v.destination||'—'} · 📅 {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
                      {v.motif&&` · ${v.motif}`}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <span style={{background:cfg.bg,color:cfg.c,padding:'4px 10px',borderRadius:99,
                      fontSize:11,fontWeight:700}}>{cfg.l}</span>
                    {v.statut==='planifie'&&<button onClick={()=>changerStatut(v.id,'en_voyage')}
                      style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:7,
                        padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                      ✈️ Embarquer
                    </button>}
                    {v.statut==='en_voyage'&&<button onClick={()=>changerStatut(v.id,'retour')}
                      style={{background:'#059669',color:'#fff',border:'none',borderRadius:7,
                        padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                      🏠 Retour
                    </button>}
                    <button onClick={()=>openEdit(v)}
                      style={{background:'#f1f5f9',color:'#374151',border:'none',borderRadius:7,
                        padding:'4px 10px',fontSize:11,cursor:'pointer'}}>✏️</button>
                  </div>
                </div>
              )
            })}
            {filtered.length===0&&(
              <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>
                Aucun voyage trouvé
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VUE MANIFEST ── */}
      {view==='manifest'&&(
        <div>
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'18px 20px',marginBottom:16}}>
            <h3 style={{fontSize:15,fontWeight:800,color:'#0f172a',margin:'0 0 14px'}}>
              ✈️ Manifest du jour — {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
            </h3>
            {/* Départs aujourd'hui */}
            {(()=>{
              const todayStr = new Date().toISOString().slice(0,10)
              const departs  = voyages.filter(v=>v.date_depart===todayStr)
              const retours  = voyages.filter(v=>v.date_retour_prevue===todayStr&&v.statut==='en_voyage')
              const absents2 = voyages.filter(v=>v.statut==='en_voyage')
              return (
                <div style={{display:'flex',flexDirection:'column',gap:16}}>
                  {[
                    {titre:`🛫 Départs aujourd'hui (${departs.length})`,list:departs,c:'#7c3aed'},
                    {titre:`🛬 Retours prévus (${retours.length})`,list:retours,c:'#059669'},
                    {titre:`🌍 Absents du camp (${absents2.length})`,list:absents2,c:'#ea580c'},
                  ].map(({titre,list,c})=>(
                    <div key={titre}>
                      <p style={{fontSize:13,fontWeight:700,color:c,marginBottom:8}}>{titre}</p>
                      {list.length===0
                        ?<p style={{fontSize:12,color:'#94a3b8',padding:'8px 12px',background:'#f8fafc',borderRadius:8}}>Aucun</p>
                        :list.map(v=>(
                          <div key={v.id} style={{display:'flex',gap:10,padding:'8px 12px',
                            background:'#f8fafc',borderRadius:8,marginBottom:6,alignItems:'center'}}>
                            <div style={{width:28,height:28,borderRadius:'50%',background:'#eff6ff',
                              display:'flex',alignItems:'center',justifyContent:'center',
                              fontSize:10,fontWeight:700,color:'#1e3a8a',flexShrink:0}}>
                              {(v.personnel_nom||'?').split(' ').map(n=>n[0]).join('').slice(0,2)}
                            </div>
                            <div style={{flex:1}}>
                              <span style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{v.personnel_nom||'—'}</span>
                              <span style={{fontSize:11,color:'#64748b',marginLeft:8}}>{v.destination||'—'}</span>
                            </div>
                            <span style={{fontSize:11,color:'#94a3b8'}}>{fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}</span>
                          </div>
                        ))
                      }
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL Nouveau/Edit ── */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',zIndex:2000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:800,color:'#0f172a',margin:0}}>
                {selected ? '✏️ Modifier le voyage' : '✈️ Nouveau voyage'}
              </h3>
              <button onClick={()=>setModal(false)}
                style={{background:'transparent',border:'none',fontSize:20,cursor:'pointer',color:'#94a3b8'}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {lbl:'Personnel *', key:'personnel', type:'select_perso'},
                {lbl:'Destination *', key:'destination', ph:'Abidjan, Paris, Mine Agbaou...'},
                {lbl:'Motif du voyage', key:'motif', ph:'Mission, congé, formation...'},
                {lbl:'Date de départ *', key:'date_depart', type:'date'},
                {lbl:'Date de retour prévue *', key:'date_retour_prevue', type:'date'},
                {lbl:'Statut', key:'statut', type:'select_statut'},
              ].map(({lbl,key,type,ph})=>(
                <div key={key}>
                  <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                    {lbl}
                  </label>
                  {type==='select_perso'?(
                    <select value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                      style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                        padding:'0 10px',fontSize:13,outline:'none',color:'#0f172a'}}>
                      <option value="">Sélectionner...</option>
                      {personnel.map(p=>(
                        <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                      ))}
                    </select>
                  ):type==='select_statut'?(
                    <select value={form[key]} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                      style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                        padding:'0 10px',fontSize:13,outline:'none',color:'#0f172a'}}>
                      {Object.entries(STATUT_CFG).map(([k,v])=><option key={k} value={k}>{v.ic} {v.l}</option>)}
                    </select>
                  ):(
                    <input type={type||'text'} value={form[key]} placeholder={ph||''}
                      onChange={e=>setForm(p=>({...p,[key]:e.target.value}))}
                      style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                        padding:'0 12px',fontSize:13,outline:'none',color:'#0f172a'}}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginTop:20}}>
              <button onClick={saveVoyage} disabled={saving}
                style={{flex:1,background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
                  padding:'12px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {saving?'⏳ Enregistrement...':'✓ Enregistrer'}
              </button>
              <button onClick={()=>setModal(false)}
                style={{background:'#f1f5f9',color:'#374151',border:'none',borderRadius:10,
                  padding:'12px 20px',cursor:'pointer',fontSize:13}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
