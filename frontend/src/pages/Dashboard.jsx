import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
const LeafletMap = lazy(() => import('../components/LeafletMap'))

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const h = () => ({ Authorization:`Bearer ${localStorage.getItem('access_token')||''}`  })

/* ── Helpers ── */
function ago(iso) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (d < 60)  return `Il y a ${d} min`
  if (d < 1440) return `Il y a ${Math.floor(d/60)}h`
  return new Date(iso).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
}

function KpiCard({ icon, label, value, sub, trend, trendUp, accent='#1e3a8a' }) {
  return (
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',
      padding:'18px 20px',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{flex:1}}>
          <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.5px',
            color:'#64748b',marginBottom:8}}>{label}</p>
          <p style={{fontSize:28,fontWeight:800,color:'#0f172a',lineHeight:1}}>{value??'—'}</p>
          {sub && <p style={{fontSize:11,color:'#94a3b8',marginTop:5}}>{sub}</p>}
          {trend && (
            <p style={{fontSize:11,marginTop:6,fontWeight:600,display:'flex',alignItems:'center',gap:3,
              color:trendUp===true?'#16a34a':trendUp===false?'#dc2626':'#64748b'}}>
              {trendUp===true?'▲':trendUp===false?'▼':'●'} {trend}
            </p>
          )}
        </div>
        <div style={{width:42,height:42,borderRadius:10,background:accent+'18',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function Card({ title, sub, action, children }) {
  return (
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',
      boxShadow:'0 1px 3px rgba(0,0,0,.06)',overflow:'hidden'}}>
      <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',
        display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <p style={{fontSize:13,fontWeight:700,color:'#0f172a'}}>{title}</p>
          {sub&&<p style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{sub}</p>}
        </div>
        {action}
      </div>
      <div style={{padding:'14px 18px'}}>{children}</div>
    </div>
  )
}

function Bar({ value, color='#1e3a8a', h=5 }) {
  const p = Math.min(100, Math.max(0, value||0))
  return (
    <div style={{height:h,background:'#f1f5f9',borderRadius:99,overflow:'hidden'}}>
      <div style={{width:`${p}%`,height:'100%',background:color,borderRadius:99,
        transition:'width .6s ease'}}/>
    </div>
  )
}

function Badge({ c, bg, children }) {
  return (
    <span style={{background:bg,color:c,padding:'3px 10px',borderRadius:99,
      fontSize:11,fontWeight:700,display:'inline-flex',alignItems:'center',gap:4}}>
      {children}
    </span>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [bat,   setBat]   = useState(null)   // batiments/stats
  const [inc,   setInc]   = useState(null)   // incidents/stats-sql
  const [voy,   setVoy]   = useState(null)   // voyages/stats
  const [perso, setPerso] = useState([])     // personnel liste
  const [notifs,setNotifs]= useState([])     // notifications
  const [geojson,setGeojson]=useState(null)  // GIS data
  const [loading,setLoading]=useState(true)
  const [sync,  setSync]  = useState(null)

  const load = useCallback(async()=>{
    setLoading(true)
    const [rBat,rInc,rVoy,rPers,rNotif] = await Promise.allSettled([
      fetch(`${BASE}/api/batiments/stats/`,         {headers:h()}).then(r=>r.json()),
      fetch(`${BASE}/api/incidents/stats-sql/`,     {headers:h()}).then(r=>r.json()),
      fetch(`${BASE}/api/voyages/stats/`,           {headers:h()}).then(r=>r.json()),
      fetch(`${BASE}/api/personnel/?page_size=500`, {headers:h()}).then(r=>r.json()),
      fetch(`${BASE}/api/notifications/compteur/`,  {headers:h()}).then(r=>r.json()),
    ])
    if(rBat.status  ==='fulfilled') setBat(rBat.value)
    if(rInc.status  ==='fulfilled') setInc(rInc.value)
    if(rVoy.status  ==='fulfilled') setVoy(rVoy.value)
    if(rPers.status ==='fulfilled') setPerso(rPers.value?.results||rPers.value||[])
    if(rNotif.status==='fulfilled') setNotifs(rNotif.value?.notifications||[])

    // Charger les bâtiments pour la carte
    fetch(`${BASE}/api/batiments/?page_size=200`,{headers:h()}).then(r=>r.json()).then(d=>{
      const items = d.results||d||[]
      if(items.length>0) {
        const features = items.filter(b=>b.latitude&&b.longitude).map(b=>({
          type:'Feature',
          properties:{...b},
          geometry:{type:'Point',coordinates:[parseFloat(b.longitude),parseFloat(b.latitude)]}
        }))
        if(features.length) setGeojson({type:'FeatureCollection',features})
      }
    }).catch(()=>{})

    setSync(new Date())
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])
  useEffect(()=>{const iv=setInterval(load,60000);return()=>clearInterval(iv)},[load])

  // ── Calculs réels ────────────────────────────────────────────
  // Résidences: par_statut = {"Occupé":N,"Libre":N,"Réservé":N,"Maintenance":N}
  const ps     = bat?.par_statut || {}
  const libres = ps['Libre']      || 0
  const occupes= ps['Occupé']     || 0
  const reserve= ps['Réservé']    || 0
  const maint  = ps['Maintenance']|| 0
  const taux   = bat?.taux_occupation ?? null

  // Incidents: declare, assigne, en_cours, resolu, critique, sla_depasse
  const ouverts  = (inc?.declare||0) + (inc?.assigne||0) + (inc?.en_cours||0)
  const critiques= inc?.critique||0
  const sla      = inc?.sla_depasse||0

  // Voyages: en_voyage, planifies
  const enVoyage = voy?.en_voyage||0
  const planifies= voy?.planifies||0

  // Induction calculée depuis liste personnel
  const total    = perso.length
  const induits  = perso.filter(p=>p.inductionrecord?.statut==='valide').length
  const enCours  = perso.filter(p=>p.inductionrecord?.statut==='en_cours').length
  const tauxInd  = total ? Math.round(induits/total*100) : 0

  // Conformité par société
  const bySoc = {}
  perso.forEach(p=>{
    const s = p.societe||'Autre'
    if(!bySoc[s]) bySoc[s]={total:0,induits:0}
    bySoc[s].total++
    if(p.inductionrecord?.statut==='valide') bySoc[s].induits++
  })
  const conf = Object.entries(bySoc)
    .map(([s,v])=>({s,pct:Math.round(v.induits/v.total*100),total:v.total,induits:v.induits}))
    .sort((a,b)=>b.pct-a.pct).slice(0,6)

  const unread = notifs.filter(n=>!n.lu).length

  // Couleurs statut résidence
  const STATUT_COLOR = {Libre:'#16a34a','Occupé':'#2563eb','Réservé':'#ca8a04',Maintenance:'#dc2626'}

  return (
    <div style={{padding:'22px',background:'#f8fafc',minHeight:'100vh',color:'#0f172a'}}>

      {/* ── Header ── */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
        <div>
          <h1 style={{fontSize:21,fontWeight:800,color:'#0f172a',margin:0}}>Tableau de bord</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>
            Résidence Roxgold Sango ·{sync ? ` Sync ${sync.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : ' Chargement...'}
          </p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,background:'#f0fdf4',
            border:'1px solid #bbf7d0',borderRadius:99,padding:'5px 12px',
            fontSize:11,fontWeight:700,color:'#16a34a'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#16a34a',
              display:'inline-block',animation:'pulse 2s infinite'}}/>
            En direct
          </div>
          <button onClick={load} disabled={loading}
            style={{background:'#0f172a',color:'#fff',border:'none',borderRadius:9,
              padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',
              display:'flex',alignItems:'center',gap:6,opacity:loading?.7:1}}>
            {loading?'⏳':'🔄'} Actualiser
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:12,marginBottom:18}}>
        <KpiCard icon="🏠" label="Occupation" accent="#2563eb"
          value={taux!==null?`${taux}%`:'—'}
          sub={`${occupes} occupés · ${libres} libres · ${maint} maintenance`}
          trend={taux>80?'Taux élevé':'Normal'} trendUp={taux>80?null:true}
        />
        <KpiCard icon="👥" label="Personnel" accent="#7c3aed"
          value={total||'—'}
          sub={`${enVoyage} en déplacement · ${planifies} rotations`}
        />
        <KpiCard icon="🚨" label="Incidents" accent="#dc2626"
          value={ouverts}
          sub={`${critiques} critique(s) · ${sla} SLA dépassé(s)`}
          trend={critiques>0?'Critique':'Normal'} trendUp={critiques>0?false:true}
        />
        <KpiCard icon="🎓" label="Induction QHSE" accent="#059669"
          value={`${tauxInd}%`}
          sub={`${induits} induits · ${enCours} en cours · ${total-induits-enCours} non commencé`}
          trend={tauxInd>=80?'Conforme':'À améliorer'} trendUp={tauxInd>=80}
        />
        <KpiCard icon="📊" label="Résidences" accent="#0891b2"
          value={bat?.total||'—'}
          sub={`${reserve} réservées · Départs: ${bat?.departs_s1||0} cette semaine`}
        />
      </div>

      {/* ── Ligne 2: Carte GIS + Alertes ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:14,marginBottom:18}}>

        {/* Carte GIS */}
        <Card title="Carte du camp — Résidences"
          sub="Positions et statuts en temps réel"
          action={
            <button onClick={()=>nav('/carte')}
              style={{background:'#eff6ff',color:'#1e3a8a',border:'1px solid #bfdbfe',
                borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
              Ouvrir la carte →
            </button>
          }>
          <div style={{borderRadius:8,overflow:'hidden',border:'1px solid #e2e8f0',height:260}}>
            <Suspense fallback={
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',
                  height:'100%',color:'#94a3b8',fontSize:13}}>
                  ⏳ Chargement de la carte...
                </div>
              }>
                <LeafletMap geojson={geojson} center={[8.111,-6.822]} zoom={16}/>
              </Suspense>
          </div>
          {/* Légende statuts */}
          <div style={{display:'flex',gap:12,marginTop:10,flexWrap:'wrap'}}>
            {[{label:'Libre',c:'#16a34a',n:libres},{label:'Occupé',c:'#2563eb',n:occupes},
              {label:'Réservé',c:'#ca8a04',n:reserve},{label:'Maintenance',c:'#dc2626',n:maint}]
              .map(({label,c,n})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:c,flexShrink:0}}/>
                  <span style={{fontSize:11,color:'#64748b'}}>{label}: <b style={{color:'#0f172a'}}>{n}</b></span>
                </div>
              ))}
          </div>
        </Card>

        {/* Alertes */}
        <Card title="Alertes opérationnelles"
          sub={`${critiques>0?critiques+' critique(s) · ':''}${ouverts} incident(s) ouverts`}>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {critiques>0&&(
              <div style={{background:'#fee2e2',borderRadius:9,padding:'10px 12px',
                display:'flex',gap:8,borderLeft:'3px solid #dc2626'}}>
                <span style={{fontSize:18}}>🚨</span>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:'#7f1d1d'}}>{critiques} incident(s) critique(s)</p>
                  <p style={{fontSize:11,color:'#dc2626',marginTop:2}}>Intervention immédiate</p>
                </div>
              </div>
            )}
            {sla>0&&(
              <div style={{background:'#fff7ed',borderRadius:9,padding:'10px 12px',
                display:'flex',gap:8,borderLeft:'3px solid #ea580c'}}>
                <span style={{fontSize:18}}>⏰</span>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:'#9a3412'}}>{sla} SLA dépassé(s)</p>
                  <p style={{fontSize:11,color:'#ea580c',marginTop:2}}>Délai de résolution expiré</p>
                </div>
              </div>
            )}
            {enVoyage>0&&(
              <div style={{background:'#eff6ff',borderRadius:9,padding:'10px 12px',
                display:'flex',gap:8,borderLeft:'3px solid #2563eb'}}>
                <span style={{fontSize:18}}>✈️</span>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:'#1e40af'}}>{enVoyage} en déplacement</p>
                  <p style={{fontSize:11,color:'#2563eb',marginTop:2}}>{planifies} rotation(s) planifiée(s)</p>
                </div>
              </div>
            )}
            {bat?.departs_s1>0&&(
              <div style={{background:'#f5f3ff',borderRadius:9,padding:'10px 12px',
                display:'flex',gap:8,borderLeft:'3px solid #7c3aed'}}>
                <span style={{fontSize:18}}>🗓️</span>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:'#4c1d95'}}>{bat.departs_s1} départ(s) cette semaine</p>
                  <p style={{fontSize:11,color:'#7c3aed',marginTop:2}}>Libérations à planifier</p>
                </div>
              </div>
            )}
            {tauxInd<60&&total>0&&(
              <div style={{background:'#fef3c7',borderRadius:9,padding:'10px 12px',
                display:'flex',gap:8,borderLeft:'3px solid #ca8a04'}}>
                <span style={{fontSize:18}}>⚠️</span>
                <div>
                  <p style={{fontSize:12,fontWeight:700,color:'#713f12'}}>Induction: {tauxInd}% seulement</p>
                  <p style={{fontSize:11,color:'#ca8a04',marginTop:2}}>{total-induits} membres non induits</p>
                </div>
              </div>
            )}
            {critiques===0&&sla===0&&enVoyage===0&&tauxInd>=60&&!bat?.departs_s1&&(
              <div style={{textAlign:'center',padding:'24px 0',color:'#16a34a'}}>
                <div style={{fontSize:40,marginBottom:8}}>✅</div>
                <p style={{fontWeight:700,fontSize:14,color:'#166534'}}>Tout est normal</p>
                <p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>Aucune alerte active</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Ligne 3: Conformité + Notifications ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:18}}>

        {/* Conformité HSE */}
        <Card title="Conformité Induction HSE" sub="Par société sous-traitante">
          {conf.length===0
            ? <p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:20}}>Chargement...</p>
            : conf.map(({s,pct,total:t,induits:i})=>(
                <div key={s} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:'#0f172a',
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:180}}>
                      {s}
                    </span>
                    <span style={{fontSize:12,fontWeight:800,
                      color:pct>=80?'#16a34a':pct>=60?'#ea580c':'#dc2626'}}>
                      {pct}% · {i}/{t}
                    </span>
                  </div>
                  <Bar value={pct} color={pct>=80?'#16a34a':pct>=60?'#f59e0b':'#dc2626'} h={5}/>
                </div>
              ))
          }
        </Card>

        {/* Notifications */}
        <Card title="Activité récente"
          sub={unread>0?`${unread} non lue(s)`:`${notifs.length} notification(s)`}
          action={unread>0&&<Badge c="#1e40af" bg="#dbeafe">{unread} nouvelles</Badge>}>
          {notifs.length===0
            ? <p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:20}}>Aucune notification</p>
            : notifs.slice(0,6).map((n,i)=>(
                <div key={n.id||i} style={{display:'flex',gap:10,padding:'9px 0',
                  borderBottom:i<5?'1px solid #f1f5f9':'none',alignItems:'flex-start'}}>
                  <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,marginTop:5,
                    background:!n.lu?'#2563eb':n.source==='induction_expiry'?'#ea580c':'#cbd5e1'}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:'#0f172a',
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {n.evenement_titre||n.message||'Notification'}
                    </p>
                    <p style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{ago(n.date_envoi)}</p>
                  </div>
                  {!n.lu&&<Badge c="#1e40af" bg="#dbeafe">Nouveau</Badge>}
                </div>
              ))
          }
        </Card>
      </div>

      {/* ── Accès rapides ── */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
        {[
          {icon:'🤖',label:'Assistant IA',path:'/assistant',c:'#7c3aed',bg:'#f5f3ff'},
          {icon:'🖥️',label:'Centre Opérationnel',path:'/operations',c:'#1e3a8a',bg:'#eff6ff'},
          {icon:'📊',label:'Analytics',path:'/analytics',c:'#059669',bg:'#f0fdf4'},
          {icon:'🛠️',label:'Maintenance',path:'/maintenance',c:'#dc2626',bg:'#fee2e2'},
          {icon:'📅',label:'Réservations',path:'/reservations',c:'#0891b2',bg:'#ecfeff'},
          {icon:'🔄',label:'Rotations',path:'/rotations',c:'#ca8a04',bg:'#fefce8'},
        ].map(({icon,label,path,c,bg})=>(
          <div key={path} onClick={()=>nav(path)}
            style={{background:bg,borderRadius:10,padding:'14px 16px',cursor:'pointer',
              border:`1px solid ${c}22`,transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{e.currentTarget.style.transform=''}}>
            <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
            <p style={{fontSize:12,fontWeight:700,color:c}}>{label}</p>
          </div>
        ))}
      </div>

      <style>{'@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}'}</style>
    </div>
  )
}
