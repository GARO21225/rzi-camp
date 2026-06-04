import { useState, useEffect, useCallback } from 'react'

const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({ Authorization:`Bearer ${localStorage.getItem('access_token')||''}`, 'Content-Type':'application/json' })

// ── Config statuts ──
const ST = {
  planifie:   { l:'Planifié',    c:'#3b82f6', bg:'#dbeafe', dot:'#3b82f6' },
  embarque:   { l:'Embarqué',    c:'#7c3aed', bg:'#ede9fe', dot:'#7c3aed' },
  en_voyage:  { l:'En voyage',   c:'#f59e0b', bg:'#fef3c7', dot:'#f59e0b' },
  retour:     { l:'Retour',      c:'#059669', bg:'#d1fae5', dot:'#059669' },
  annule:     { l:'Annulé',      c:'#dc2626', bg:'#fee2e2', dot:'#dc2626' },
}
const DESTINATIONS = ['Abidjan','Yamoussoukro','San Pédro','Bouaké','Mine Agbaou','Aéroport FHB','Autre']

function fmt(iso){ return iso ? new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '—' }
function fmtW(d){ return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}) }
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r }
function toISO(d){ return d.toISOString().slice(0,10) }

// Générer les 14 prochains jours
function getTimeline(offset=0){
  const base = addDays(new Date(), offset*14)
  base.setDate(base.getDate() - base.getDay() + 1) // lundi
  return Array.from({length:14},(_,i)=>addDays(base,i))
}

// ── Composant Siège ──
function SeatMap({ total=15, reserved=0, onBook }) {
  const seats = Array.from({length: total}, (_, i) => i < reserved ? 'reserved' : 'free')
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:4,justifyContent:'center'}}>
      {seats.map((s,i) => (
        <div key={i}
          onClick={() => s==='free' && onBook && onBook(i)}
          title={s==='free' ? 'Réserver' : 'Occupé'}
          style={{
            width:22, height:22, borderRadius:4,
            background: s==='reserved' ? '#1e3a8a' : '#f0fdf4',
            border: `1.5px solid ${s==='reserved'?'#1e3a8a':'#16a34a'}`,
            cursor: s==='free' ? 'pointer' : 'default',
            transition:'transform .1s',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,
            color: s==='reserved'?'#fff':'#16a34a',fontWeight:700
          }}
          onMouseEnter={e=>s==='free'&&(e.currentTarget.style.transform='scale(1.15)')}
          onMouseLeave={e=>(e.currentTarget.style.transform='')}>
          {s==='reserved' ? '●' : '○'}
        </div>
      ))}
    </div>
  )
}

export default function RotationsPage() {
  const [voyages,    setVoyages]   = useState([])
  const [personnel,  setPersonnel] = useState([])
  const [stats,      setStats]     = useState({})
  const [loading,    setLoading]   = useState(true)
  const [view,       setView]      = useState('gantt')  // 'gantt' | 'board' | 'reserver'
  const [weekOffset, setWeekOffset]= useState(0)
  const [modal,      setModal]     = useState(null)     // null | 'new' | voyage
  const [selected,   setSelected]  = useState(null)
  const [formV, setFormV]          = useState({destination:'Abidjan',date_depart:'',date_retour_prevue:'',capacite:15,motif:'',statut:'planifie'})
  const [formRes, setFormRes]      = useState({personnel:'',voyage:'',notes:''})
  const [saving,     setSaving]    = useState(false)
  const [msg,        setMsg]       = useState(null)

  const load = useCallback(async()=>{
    setLoading(true)
    try {
      const [rv,rp,rs] = await Promise.allSettled([
        fetch(`${BASE}/api/voyages/?page_size=200`,{headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/personnel/?page_size=500&actif=true`,{headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/voyages/stats/`,{headers:hdrs()}).then(r=>r.json()),
      ])
      if(rv.status==='fulfilled') setVoyages(rv.value?.results||rv.value||[])
      if(rp.status==='fulfilled') setPersonnel(rp.value?.results||rp.value||[])
      if(rs.status==='fulfilled') setStats(rs.value||{})
    }catch(e){}
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])

  const days = getTimeline(weekOffset)
  const today = toISO(new Date())

  // Voyages qui ont une capacité définie (groupe)
  const groupVoyages = voyages.filter(v=>v.capacite||v.nb_places)
  
  // Voyages individuels
  const indivVoyages = voyages.filter(v=>!(v.capacite||v.nb_places))

  // Créer un voyage groupe
  const creerVoyage = async() => {
    if(!formV.date_depart||!formV.date_retour_prevue) return
    setSaving(true)
    try {
      await fetch(`${BASE}/api/voyages/`,{
        method:'POST', headers:hdrs(),
        body:JSON.stringify({
          ...formV,
          nb_places: parseInt(formV.capacite)||15,
          personnel: personnel[0]?.id  // obligatoire pour le modèle
        })
      })
      setModal(null)
      setMsg({type:'ok',text:'Voyage créé ✓'})
      setTimeout(()=>setMsg(null),3000)
      load()
    }catch(e){setMsg({type:'err',text:'Erreur création'})}
    setSaving(false)
  }

  // Réserver un siège
  const reserver = async(voyageId, personnelId) => {
    if(!personnelId||!voyageId) return
    setSaving(true)
    try {
      await fetch(`${BASE}/api/voyages/`,{
        method:'POST', headers:hdrs(),
        body:JSON.stringify({
          personnel: personnelId,
          destination: voyages.find(v=>v.id===voyageId)?.destination||'',
          date_depart: voyages.find(v=>v.id===voyageId)?.date_depart||'',
          date_retour_prevue: voyages.find(v=>v.id===voyageId)?.date_retour_prevue||'',
          statut:'planifie', motif:'Réservation siège',
        })
      })
      setMsg({type:'ok',text:'Siège réservé ✓'})
      setTimeout(()=>setMsg(null),3000)
      load()
    }catch(e){setMsg({type:'err',text:'Erreur réservation'})}
    setSaving(false)
  }

  // Changer statut
  const changerStatut = async(id, statut) => {
    try {
      await fetch(`${BASE}/api/voyages/${id}/`,{method:'PATCH',headers:hdrs(),body:JSON.stringify({statut})})
      load()
    }catch(e){}
  }

  // ── GANTT row ──
  const GanttRow = ({ v }) => {
    const cfg = ST[v.statut]||ST.planifie
    const depISO = v.date_depart
    const retISO = v.date_retour_prevue||v.date_depart
    
    return (
      <tr style={{borderBottom:'1px solid #f1f5f9'}}
        onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
        onMouseLeave={e=>e.currentTarget.style.background=''}>
        {/* Label */}
        <td style={{padding:'8px 12px',minWidth:160,maxWidth:180}}>
          <div style={{fontWeight:600,fontSize:12,color:'#0f172a',whiteSpace:'nowrap',
            overflow:'hidden',textOverflow:'ellipsis'}}>
            {v.personnel_nom||'Personnel —'}
          </div>
          <div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>
            {v.destination||'—'}
          </div>
        </td>
        {/* Jours */}
        {days.map((day,i)=>{
          const iso  = toISO(day)
          const isOn = iso >= depISO && iso <= retISO
          const isDep= iso === depISO
          const isRet= iso === retISO
          const isToday = iso === today
          
          return (
            <td key={i} style={{
              padding:0,width:36,
              background: isToday ? '#eff6ff' : 'transparent',
              borderLeft: isToday ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
            }}>
              {isOn ? (
                <div style={{
                  height:28,margin:'2px 1px',
                  background: isDep||isRet ? cfg.c : cfg.bg,
                  borderRadius: isDep ? '6px 0 0 6px' : isRet ? '0 6px 6px 0' : 0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  cursor:'pointer',
                  fontSize:10,fontWeight:700,
                  color: isDep||isRet ? '#fff' : cfg.c,
                }} onClick={()=>setSelected(v)}
                title={`${v.personnel_nom} · ${isDep?'Départ':isRet?'Retour':'En voyage'}`}>
                  {isDep ? '↗' : isRet ? '↙' : ''}
                </div>
              ) : (
                <div style={{height:28,margin:'2px 1px'}}/>
              )}
            </td>
          )
        })}
        {/* Statut + actions */}
        <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>
          <span style={{background:cfg.bg,color:cfg.c,padding:'2px 8px',borderRadius:99,
            fontSize:10,fontWeight:700,display:'inline-block',marginBottom:3}}>
            {cfg.l}
          </span>
          <div style={{display:'flex',gap:4,marginTop:3}}>
            {v.statut==='planifie'&&<button onClick={()=>changerStatut(v.id,'en_voyage')}
              style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:5,
                padding:'2px 7px',fontSize:10,cursor:'pointer',fontWeight:600}}>↑ Partir</button>}
            {v.statut==='en_voyage'&&<button onClick={()=>changerStatut(v.id,'retour')}
              style={{background:'#059669',color:'#fff',border:'none',borderRadius:5,
                padding:'2px 7px',fontSize:10,cursor:'pointer',fontWeight:600}}>↓ Retour</button>}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div style={{padding:20,background:'#f8fafc',minHeight:'100vh'}}>

      {/* MSG */}
      {msg && (
        <div style={{position:'fixed',top:20,right:20,zIndex:9999,padding:'10px 20px',
          borderRadius:10,fontWeight:700,fontSize:13,
          background:msg.type==='ok'?'#d1fae5':'#fee2e2',
          color:msg.type==='ok'?'#065f46':'#991b1b',
          border:`1px solid ${msg.type==='ok'?'#6ee7b7':'#fca5a5'}`,
          boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
          {msg.text}
        </div>
      )}

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:900,color:'#0f172a',margin:0}}>✈️ Rotations & Voyages</h1>
          <p style={{fontSize:12,color:'#64748b',margin:'4px 0 0'}}>
            Planning · Réservation · Suivi · {voyages.length} voyage(s)
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setModal('new')}
            style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
              padding:'10px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            + Planifier un voyage
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:18}}>
        {[
          {ic:'📋',l:'Planifiés',   v:stats.planifies||0, c:'#3b82f6',bg:'#dbeafe'},
          {ic:'✈️',l:'En voyage',   v:stats.en_voyage||0, c:'#f59e0b',bg:'#fef3c7'},
          {ic:'🏠',l:'Retours',     v:stats.retours||0,   c:'#059669',bg:'#d1fae5'},
          {ic:'📅',l:'Total mois',  v:stats.total||0,     c:'#0891b2',bg:'#cffafe'},
          {ic:'❌',l:'Annulés',     v:stats.annules||0,   c:'#dc2626',bg:'#fee2e2'},
        ].map(k=>(
          <div key={k.l} style={{background:k.bg,borderRadius:12,padding:'12px 14px',
            borderLeft:`3px solid ${k.c}`}}>
            <div style={{fontSize:20,marginBottom:4}}>{k.ic}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.c,lineHeight:1}}>{k.v}</div>
            <div style={{fontSize:10,color:'#64748b',fontWeight:600,marginTop:3}}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:4,background:'#e2e8f0',borderRadius:10,
        padding:4,marginBottom:16,width:'fit-content'}}>
        {[
          ['gantt','📅 Gantt Planning'],
          ['board','📋 Tableau'],
          ['reserver','💺 Réserver un siège'],
        ].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)}
            style={{padding:'7px 16px',borderRadius:7,border:'none',cursor:'pointer',
              fontSize:12,fontWeight:600,
              background:view===v?'#fff':'transparent',
              color:view===v?'#0f172a':'#64748b',
              boxShadow:view===v?'0 1px 4px rgba(0,0,0,.1)':'none',
              whiteSpace:'nowrap'}}>
            {l}
          </button>
        ))}
      </div>

      {/* ── VUE GANTT ── */}
      {view==='gantt' && (
        <div style={{background:'#fff',borderRadius:14,border:'1px solid #e2e8f0',
          overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>

          {/* Nav semaine */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
            padding:'12px 16px',background:'#fafafa',borderBottom:'1px solid #f1f5f9'}}>
            <button onClick={()=>setWeekOffset(w=>w-1)}
              style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,
                padding:'6px 14px',cursor:'pointer',fontSize:13,fontWeight:500}}>
              ← 2 sem. préc.
            </button>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:13,fontWeight:700,color:'#0f172a',margin:0}}>
                {fmtW(days[0])} — {fmtW(days[13])}
              </p>
              {weekOffset===0&&<p style={{fontSize:10,color:'#059669',margin:'2px 0 0',fontWeight:600}}>
                ● Période courante
              </p>}
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)}
              style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,
                padding:'6px 14px',cursor:'pointer',fontSize:13,fontWeight:500}}>
              2 sem. suiv. →
            </button>
          </div>

          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:800}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  <th style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,
                    color:'#64748b',textTransform:'uppercase',letterSpacing:.5,
                    borderBottom:'2px solid #e5e7eb',minWidth:160,position:'sticky',left:0,
                    background:'#f8fafc',zIndex:1}}>
                    Personnel
                  </th>
                  {days.map((d,i)=>{
                    const isToday = toISO(d)===today
                    const isWE   = d.getDay()===0||d.getDay()===6
                    return (
                      <th key={i} style={{
                        padding:'4px 2px',textAlign:'center',fontSize:10,fontWeight:700,
                        borderBottom:'2px solid #e5e7eb',width:36,minWidth:36,
                        background:isToday?'#eff6ff':isWE?'#f9fafb':'#f8fafc',
                        color:isToday?'#1e3a8a':isWE?'#cbd5e1':'#64748b',
                        borderLeft: isToday?'2px solid #1e3a8a':'1px solid #f1f5f9',
                      }}>
                        <div style={{fontSize:9,fontWeight:500}}>{['D','L','M','M','J','V','S'][d.getDay()]}</div>
                        <div style={{fontSize:12,fontWeight:900,color:isToday?'#1e3a8a':'#374151'}}>
                          {d.getDate()}
                        </div>
                      </th>
                    )
                  })}
                  <th style={{padding:'8px 10px',textAlign:'left',fontSize:11,fontWeight:700,
                    color:'#64748b',textTransform:'uppercase',letterSpacing:.5,
                    borderBottom:'2px solid #e5e7eb',minWidth:120}}>
                    Statut / Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={17} style={{padding:30,textAlign:'center',color:'#94a3b8',fontSize:13}}>
                    ⏳ Chargement...
                  </td></tr>
                ) : voyages.filter(v=>{
                  // Afficher si chevauchement avec la fenêtre visible
                  const dep = v.date_depart||''
                  const ret = v.date_retour_prevue||dep
                  const winStart = toISO(days[0])
                  const winEnd   = toISO(days[13])
                  return dep <= winEnd && ret >= winStart
                }).length === 0 ? (
                  <tr><td colSpan={17} style={{padding:30,textAlign:'center',color:'#94a3b8',fontSize:13}}>
                    Aucun voyage sur cette période
                  </td></tr>
                ) : voyages.filter(v=>{
                  const dep = v.date_depart||''
                  const ret = v.date_retour_prevue||dep
                  const winStart = toISO(days[0])
                  const winEnd   = toISO(days[13])
                  return dep <= winEnd && ret >= winStart
                }).map(v=><GanttRow key={v.id} v={v}/>)}
              </tbody>
            </table>
          </div>

          {/* Légende */}
          <div style={{display:'flex',gap:16,padding:'10px 16px',background:'#fafafa',
            borderTop:'1px solid #f1f5f9',flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:11,color:'#64748b',fontWeight:600}}>Légende:</span>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748b'}}>
              <span style={{display:'inline-block',width:14,height:14,borderRadius:3,background:'#3b82f6'}}/> Départ/Retour
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748b'}}>
              <span style={{display:'inline-block',width:14,height:14,borderRadius:3,background:'#dbeafe'}}/> En voyage
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#64748b'}}>
              <span style={{display:'inline-block',width:14,height:14,background:'#eff6ff',border:'2px solid #bfdbfe'}}/> Aujourd'hui
            </div>
          </div>
        </div>
      )}

      {/* ── VUE BOARD ── */}
      {view==='board' && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {voyages.map(v=>{
            const cfg=ST[v.statut]||ST.planifie
            return (
              <div key={v.id} style={{background:'#fff',borderRadius:12,padding:'14px 18px',
                border:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:14,
                boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:cfg.bg,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                  {v.statut==='en_voyage'?'✈️':v.statut==='retour'?'🏠':'📋'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#0f172a'}}>{v.personnel_nom||'—'}</div>
                  <div style={{fontSize:12,color:'#64748b',marginTop:2}}>
                    📍 {v.destination||'—'} · 📅 {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
                    {v.motif&&` · ${v.motif}`}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
                  <span style={{background:cfg.bg,color:cfg.c,padding:'4px 10px',borderRadius:99,
                    fontSize:11,fontWeight:700}}>{cfg.l}</span>
                  {v.statut==='planifie'&&<button onClick={()=>changerStatut(v.id,'en_voyage')}
                    style={{background:'#7c3aed',color:'#fff',border:'none',borderRadius:7,
                      padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>✈️ Départ</button>}
                  {v.statut==='en_voyage'&&<button onClick={()=>changerStatut(v.id,'retour')}
                    style={{background:'#059669',color:'#fff',border:'none',borderRadius:7,
                      padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>🏠 Retour</button>}
                </div>
              </div>
            )
          })}
          {voyages.length===0&&(
            <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>
              Aucun voyage enregistré
            </div>
          )}
        </div>
      )}

      {/* ── VUE RÉSERVER UN SIÈGE ── */}
      {view==='reserver' && (
        <div>
          <p style={{fontSize:13,color:'#64748b',marginBottom:16}}>
            Sélectionnez un voyage planifié et choisissez votre siège.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
            {voyages.filter(v=>v.statut==='planifie').map(v=>{
              // Compter les réservations sur ce voyage (même destination + dates)
              const reserved = voyages.filter(vv =>
                vv.destination===v.destination &&
                vv.date_depart===v.date_depart &&
                vv.id !== v.id
              ).length
              const capacity = v.nb_places||v.capacite||15
              const free = Math.max(0, capacity - reserved)
              
              return (
                <div key={v.id} style={{background:'#fff',borderRadius:14,border:'1px solid #e2e8f0',
                  overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
                  {/* Header */}
                  <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',padding:'14px 16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <div>
                        <div style={{color:'#fff',fontWeight:800,fontSize:15}}>
                          ✈️ {v.destination}
                        </div>
                        <div style={{color:'rgba(255,255,255,.7)',fontSize:11,marginTop:2}}>
                          {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{color:'#fff',fontWeight:900,fontSize:22}}>{free}</div>
                        <div style={{color:'rgba(255,255,255,.6)',fontSize:10}}>sièges libres</div>
                      </div>
                    </div>
                    {/* Barre de remplissage */}
                    <div style={{marginTop:10,height:4,background:'rgba(255,255,255,.2)',borderRadius:99}}>
                      <div style={{height:'100%',width:`${Math.round(reserved/capacity*100)}%`,
                        background: reserved/capacity>0.8?'#f87171':'#34d399',
                        borderRadius:99,transition:'width .5s'}}/>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:4,
                      fontSize:10,color:'rgba(255,255,255,.6)'}}>
                      <span>{reserved}/{capacity} places occupées</span>
                      <span>{Math.round(reserved/capacity*100)}% rempli</span>
                    </div>
                  </div>

                  {/* Plan de cabine */}
                  <div style={{padding:'14px 16px'}}>
                    <p style={{fontSize:11,fontWeight:700,color:'#64748b',
                      textTransform:'uppercase',letterSpacing:.5,marginBottom:10}}>
                      Plan de cabine
                    </p>
                    <SeatMap total={capacity} reserved={reserved}
                      onBook={()=>{
                        if(free===0) return
                        setSelected(v)
                        setFormRes({personnel:'',voyage:v.id,notes:''})
                      }}
                    />
                    {selected?.id===v.id && (
                      <div style={{marginTop:12,padding:12,background:'#eff6ff',borderRadius:9,
                        border:'1px solid #bfdbfe'}}>
                        <p style={{fontSize:12,fontWeight:700,color:'#1e3a8a',marginBottom:8}}>
                          Réserver un siège — {v.destination}
                        </p>
                        <select value={formRes.personnel}
                          onChange={e=>setFormRes(p=>({...p,personnel:e.target.value}))}
                          style={{width:'100%',height:36,border:'1.5px solid #bfdbfe',borderRadius:8,
                            padding:'0 10px',fontSize:12,outline:'none',marginBottom:8,color:'#0f172a'}}>
                          <option value="">Sélectionner le bénéficiaire...</option>
                          {personnel.map(p=>(
                            <option key={p.id} value={p.id}>{p.nom} {p.prenom} · {p.societe||'—'}</option>
                          ))}
                        </select>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>reserver(v.id, parseInt(formRes.personnel))}
                            disabled={!formRes.personnel||saving}
                            style={{flex:1,background:formRes.personnel?'#1e3a8a':'#e2e8f0',
                              color:formRes.personnel?'#fff':'#94a3b8',border:'none',
                              borderRadius:8,padding:'8px',fontSize:12,fontWeight:700,
                              cursor:formRes.personnel?'pointer':'not-allowed'}}>
                            {saving?'⏳ Réservation...':'✓ Confirmer'}
                          </button>
                          <button onClick={()=>setSelected(null)}
                            style={{background:'#f1f5f9',border:'none',borderRadius:8,
                              padding:'8px 12px',cursor:'pointer',fontSize:12}}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                    {free===0&&(
                      <div style={{marginTop:10,padding:'8px 12px',background:'#fee2e2',
                        borderRadius:8,fontSize:12,color:'#991b1b',fontWeight:600,textAlign:'center'}}>
                        🚫 Complet — Aucun siège disponible
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {voyages.filter(v=>v.statut==='planifie').length===0&&(
              <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13,
                gridColumn:'1/-1'}}>
                Aucun voyage planifié disponible.{' '}
                <button onClick={()=>setModal('new')} style={{color:'#1e3a8a',background:'none',
                  border:'none',cursor:'pointer',fontWeight:700,textDecoration:'underline'}}>
                  Planifier un voyage →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL Nouveau Voyage ── */}
      {modal==='new' && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',zIndex:2000,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div style={{background:'#fff',borderRadius:16,padding:24,width:'100%',maxWidth:480}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <h3 style={{fontSize:16,fontWeight:800,color:'#0f172a',margin:0}}>
                ✈️ Planifier un voyage
              </h3>
              <button onClick={()=>setModal(null)}
                style={{background:'transparent',border:'none',fontSize:22,cursor:'pointer',
                  color:'#94a3b8',lineHeight:1}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {/* Destination */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                  DESTINATION *
                </label>
                <select value={formV.destination}
                  onChange={e=>setFormV(p=>({...p,destination:e.target.value}))}
                  style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                    padding:'0 12px',fontSize:13,outline:'none',color:'#0f172a'}}>
                  {DESTINATIONS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {/* Dates */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[['DATE DE DÉPART *','date_depart'],['DATE DE RETOUR *','date_retour_prevue']].map(([l,k])=>(
                  <div key={k}>
                    <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>{l}</label>
                    <input type="date" value={formV[k]}
                      onChange={e=>setFormV(p=>({...p,[k]:e.target.value}))}
                      style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                        padding:'0 10px',fontSize:13,outline:'none',color:'#0f172a'}}/>
                  </div>
                ))}
              </div>
              {/* Capacité */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                  CAPACITÉ (nombre de sièges)
                </label>
                <input type="number" min="1" max="60" value={formV.capacite}
                  onChange={e=>setFormV(p=>({...p,capacite:parseInt(e.target.value)||15}))}
                  style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                    padding:'0 12px',fontSize:13,outline:'none',color:'#0f172a'}}/>
              </div>
              {/* Motif */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:'#64748b',display:'block',marginBottom:4}}>
                  MOTIF / DESCRIPTION
                </label>
                <input type="text" value={formV.motif} placeholder="Mission, rotation, congé..."
                  onChange={e=>setFormV(p=>({...p,motif:e.target.value}))}
                  style={{width:'100%',height:38,border:'1.5px solid #e2e8f0',borderRadius:8,
                    padding:'0 12px',fontSize:13,outline:'none',color:'#0f172a'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:20}}>
              <button onClick={creerVoyage} disabled={saving||!formV.date_depart||!formV.date_retour_prevue}
                style={{flex:1,background:formV.date_depart&&formV.date_retour_prevue?'#1e3a8a':'#e2e8f0',
                  color:formV.date_depart&&formV.date_retour_prevue?'#fff':'#94a3b8',
                  border:'none',borderRadius:10,padding:'12px',fontSize:13,fontWeight:700,
                  cursor:formV.date_depart&&formV.date_retour_prevue?'pointer':'not-allowed'}}>
                {saving?'⏳ Création...':'✓ Créer le voyage'}
              </button>
              <button onClick={()=>setModal(null)}
                style={{background:'#f1f5f9',color:'#374151',border:'none',borderRadius:10,
                  padding:'12px 20px',cursor:'pointer',fontSize:13}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DÉTAIL VOYAGE sélectionné */}
      {selected && (
        <div style={{position:'fixed',right:20,bottom:20,zIndex:1500,
          background:'#fff',borderRadius:14,padding:18,width:300,
          boxShadow:'0 10px 40px rgba(0,0,0,.15)',border:'1px solid #e2e8f0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <h4 style={{margin:0,fontSize:14,fontWeight:800,color:'#0f172a'}}>Détail voyage</h4>
            <button onClick={()=>setSelected(null)}
              style={{background:'transparent',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:18}}>×</button>
          </div>
          {[
            ['Personnel', selected.personnel_nom||'—'],
            ['Destination', selected.destination||'—'],
            ['Départ', fmt(selected.date_depart)],
            ['Retour prévu', fmt(selected.date_retour_prevue)],
            ['Motif', selected.motif||'—'],
          ].map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',
              padding:'5px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}>
              <span style={{color:'#64748b'}}>{l}</span>
              <span style={{fontWeight:600,color:'#0f172a'}}>{v}</span>
            </div>
          ))}
          <div style={{marginTop:10,display:'flex',gap:6}}>
            {selected.statut==='planifie'&&<button onClick={()=>{changerStatut(selected.id,'en_voyage');setSelected(null)}}
              style={{flex:1,background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,
                padding:'8px',fontSize:12,fontWeight:700,cursor:'pointer'}}>✈️ Départ</button>}
            {selected.statut==='en_voyage'&&<button onClick={()=>{changerStatut(selected.id,'retour');setSelected(null)}}
              style={{flex:1,background:'#059669',color:'#fff',border:'none',borderRadius:8,
                padding:'8px',fontSize:12,fontWeight:700,cursor:'pointer'}}>🏠 Retour</button>}
            <button onClick={()=>{changerStatut(selected.id,'annule');setSelected(null)}}
              style={{background:'#fee2e2',color:'#dc2626',border:'none',borderRadius:8,
                padding:'8px 12px',fontSize:12,cursor:'pointer'}}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  )
}
