import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'

// Composant carte lazy — chargé uniquement quand visible
const LeafletMapLazy = lazy(() => import('../components/LeafletMap'))

function MapPreview({ geojson }) {
  return (
    <div style={{height:260,position:'relative'}}>
      <Suspense fallback={
        <div style={{height:'100%',display:'flex',alignItems:'center',
          justifyContent:'center',background:'#f8fafc',color:'#94a3b8',fontSize:12}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗺️</div>
            Chargement de la carte...
          </div>
        </div>
      }>
        <LeafletMapLazy geojson={geojson} center={[8.111,-6.822]} zoom={16}/>
      </Suspense>
      {/* Overlay transparent pour capter le clic sans bloquer Leaflet */}
      <div style={{position:'absolute',inset:0,zIndex:1000,cursor:'pointer'}}/>
    </div>
  )
}

const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const tok  = () => localStorage.getItem('access_token') || ''
const hdrs = () => ({ 'Content-Type':'application/json', Authorization:`Bearer ${tok()}` })

function KpiCard({ icon, label, value, sub, color='#1e3a8a', bg='#eff6ff' }) {
  return (
    <div style={{
      background:'#fff', borderRadius:12, border:'1px solid #e2e8f0',
      padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.06)',
    }}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <p style={{fontSize:11,fontWeight:600,textTransform:'uppercase',
            letterSpacing:'.5px',color:'#64748b',marginBottom:8}}>{label}</p>
          <p style={{fontSize:28,fontWeight:800,color:'#0f172a',lineHeight:1}}>
            {value ?? <span style={{color:'#cbd5e1'}}>—</span>}
          </p>
          {sub && <p style={{fontSize:12,color:'#94a3b8',marginTop:6}}>{sub}</p>}
        </div>
        <div style={{width:44,height:44,borderRadius:12,background:bg,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function AlertBox({ icon, title, desc, color, bg }) {
  return (
    <div style={{display:'flex',gap:12,padding:'12px 14px',borderRadius:10,
      background:bg,borderLeft:`3px solid ${color}`,marginBottom:10}}>
      <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
      <div>
        <p style={{fontSize:13,fontWeight:700,color,margin:0}}>{title}</p>
        <p style={{fontSize:12,color:'#64748b',marginTop:2,margin:0}}>{desc}</p>
      </div>
    </div>
  )
}

function ProgBar({ value, color='#1e3a8a' }) {
  return (
    <div style={{height:5,background:'#f1f5f9',borderRadius:99,overflow:'hidden',marginTop:4}}>
      <div style={{
        width:`${Math.min(100,Math.max(0,value||0))}%`,
        height:'100%',background:color,borderRadius:99,transition:'width .5s'
      }}/>
    </div>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const [d, setD] = useState({})
  const [perso, setPerso] = useState([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rB, rI, rV, rP, rN] = await Promise.allSettled([
        fetch(`${BASE}/api/batiments/stats/`,         {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/incidents/stats-sql/`,     {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/voyages/stats/`,           {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/personnel/?page_size=500`, {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/notifications/compteur/`,  {headers:hdrs()}).then(r=>r.json()),
      ])
      const merged = {}
      if (rB.status==='fulfilled') merged.bat = rB.value
      if (rI.status==='fulfilled') merged.inc = rI.value
      if (rV.status==='fulfilled') merged.voy = rV.value
      if (rN.status==='fulfilled') merged.notifs = rN.value?.notifications || []
      setD(merged)
      if (rP.status==='fulfilled') setPerso(rP.value?.results || rP.value || [])
    } catch(e) { console.error('Dashboard load error:', e) }
    setSync(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [load])

  // Calculs depuis les vrais champs API
  const ps      = d.bat?.par_statut || {}
  const libres  = ps['Libre']       || 0
  const occupes = ps['Occupé']      || 0
  const reserve = ps['Réservé']     || 0
  const maint   = ps['Maintenance'] || 0
  const taux    = d.bat?.taux_occupation ?? null

  const ouverts  = (d.inc?.declare||0) + (d.inc?.assigne||0) + (d.inc?.en_cours||0)
  const critiques= d.inc?.critique    || 0
  const sla      = d.inc?.sla_depasse || 0

  const enVoyage = d.voy?.en_voyage || 0
  const planifies= d.voy?.planifies  || 0

  const total   = perso.length
  const induits = perso.filter(p => p.inductionrecord?.statut === 'valide').length
  const enCours = perso.filter(p => p.inductionrecord?.statut === 'en_cours').length
  const tauxInd = total ? Math.round(induits / total * 100) : 0

  const bySoc = {}
  perso.forEach(p => {
    const s = p.societe || 'Autre'
    if (!bySoc[s]) bySoc[s] = {total:0,induits:0}
    bySoc[s].total++
    if (p.inductionrecord?.statut === 'valide') bySoc[s].induits++
  })
  const conf = Object.entries(bySoc)
    .map(([s,v]) => ({s, pct: Math.round(v.induits/v.total*100), ...v}))
    .sort((a,b) => b.pct - a.pct).slice(0,6)

  const unread = (d.notifs||[]).filter(n=>!n.lu).length

  const MODULES = [
    {icon:'🤖',label:'Assistant IA',  path:'/assistant',   c:'#7c3aed',bg:'#f5f3ff'},
    {icon:'🖥️',label:'Opérationnel',  path:'/operations',  c:'#1e3a8a',bg:'#eff6ff'},
    {icon:'📊',label:'Analytics',     path:'/analytics',   c:'#059669',bg:'#f0fdf4'},
    {icon:'🛠️',label:'Maintenance',   path:'/maintenance', c:'#dc2626',bg:'#fee2e2'},
    {icon:'📅',label:'Réservations',  path:'/reservations',c:'#0891b2',bg:'#ecfeff'},
    {icon:'🔄',label:'Rotations',     path:'/rotations',   c:'#ca8a04',bg:'#fefce8'},
  ]

  return (
    <div style={{padding:'20px',background:'#f8fafc',minHeight:'100vh',fontFamily:'Inter,system-ui,sans-serif'}}>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:'#0f172a',margin:0}}>Tableau de bord</h1>
          <p style={{fontSize:12,color:'#94a3b8',margin:'4px 0 0'}}>
            Roxgold Sango · {sync ? `Sync ${sync.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}` : 'Chargement...'}
          </p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:6,background:'#f0fdf4',
            border:'1px solid #bbf7d0',borderRadius:99,padding:'5px 12px',
            fontSize:11,fontWeight:700,color:'#16a34a'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#16a34a',display:'inline-block'}}/>
            En direct
          </div>
          <button onClick={load} disabled={loading}
            style={{background:'#0f172a',color:'#fff',border:'none',borderRadius:9,
              padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',
              display:'flex',alignItems:'center',gap:6}}>
            {loading ? '⏳' : '🔄'} Actualiser
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(185px,1fr))',gap:12,marginBottom:18}}>
        <KpiCard icon="🏠" label="Occupation" color="#1e3a8a" bg="#eff6ff"
          value={taux !== null ? `${taux}%` : '—'}
          sub={`${occupes} occupés · ${libres} libres · ${maint} maintenance`}
        />
        <KpiCard icon="👥" label="Personnel" color="#7c3aed" bg="#f5f3ff"
          value={total || '—'}
          sub={`${enVoyage} en déplacement · ${planifies} planifiés`}
        />
        <KpiCard icon="🚨" label="Incidents" color="#dc2626" bg="#fee2e2"
          value={ouverts}
          sub={`${critiques} critique(s) · ${sla} SLA dépassé(s)`}
        />
        <KpiCard icon="🎓" label="Induction QHSE" color="#059669" bg="#f0fdf4"
          value={`${tauxInd}%`}
          sub={`${induits} induits · ${enCours} en cours`}
        />
        <KpiCard icon="📊" label="Résidences" color="#0891b2" bg="#ecfeff"
          value={d.bat?.total ?? '—'}
          sub={`${reserve} réservées · ${d.bat?.departs_s1||0} départ(s) sem.`}
        />
      </div>

      {/* Ligne 2: Carte GIS + Alertes */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:14,marginBottom:18}}>

        {/* Mini-carte GIS cliquable */}
        <div
          onClick={()=>nav('/carte')}
          style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',
            overflow:'hidden',cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,.06)',
            transition:'box-shadow .15s'}}
          onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.12)'}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)'}>
          {/* Header carte */}
          <div style={{padding:'12px 16px',borderBottom:'1px solid #f1f5f9',
            display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <p style={{fontSize:13,fontWeight:700,color:'#0f172a',margin:0}}>🗺️ Carte du camp</p>
              <p style={{fontSize:11,color:'#94a3b8',margin:'2px 0 0'}}>Résidences · Statuts en temps réel</p>
            </div>
            <span style={{fontSize:11,fontWeight:700,color:'#1e3a8a',background:'#eff6ff',
              padding:'4px 10px',borderRadius:99,border:'1px solid #bfdbfe'}}>
              Ouvrir la carte →
            </span>
          </div>
          {/* Carte Leaflet */}
          <MapPreview geojson={geojson} />
          {/* Légende */}
          <div style={{padding:'10px 16px',display:'flex',gap:16,flexWrap:'wrap',
            borderTop:'1px solid #f1f5f9',background:'#fafafa'}}>
            {[{l:'Libre',c:'#16a34a',n:libres},{l:'Occupé',c:'#2563eb',n:occupes},
              {l:'Réservé',c:'#ca8a04',n:reserve},{l:'Maintenance',c:'#dc2626',n:maint}]
              .map(({l,c,n})=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                  <span style={{width:9,height:9,borderRadius:'50%',background:c,flexShrink:0}}/>
                  <span style={{fontSize:11,color:'#64748b'}}>{l}: <b style={{color:'#0f172a'}}>{n}</b></span>
                </div>
              ))}
          </div>
        </div>

        {/* Alertes */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'16px 18px'}}>
          <p style={{fontSize:14,fontWeight:700,color:'#0f172a',margin:'0 0 14px'}}>
            Alertes opérationnelles
          </p>
          {critiques > 0 && <AlertBox icon="🚨" title={`${critiques} incident(s) critique(s)`}
            desc="Intervention immédiate requise" color="#dc2626" bg="#fee2e2"/>}
          {sla > 0 && <AlertBox icon="⏰" title={`${sla} SLA dépassé(s)`}
            desc="Délai de résolution expiré" color="#ea580c" bg="#fff7ed"/>}
          {enVoyage > 0 && <AlertBox icon="✈️" title={`${enVoyage} personne(s) en déplacement`}
            desc={`${planifies} rotation(s) planifiée(s)`} color="#2563eb" bg="#eff6ff"/>}
          {(d.bat?.departs_s1||0) > 0 && <AlertBox icon="🗓️"
            title={`${d.bat.departs_s1} départ(s) cette semaine`}
            desc="Libérations de résidences à planifier" color="#7c3aed" bg="#f5f3ff"/>}
          {tauxInd < 60 && total > 0 && <AlertBox icon="⚠️"
            title={`Induction faible: ${tauxInd}%`}
            desc={`${total-induits} membres non induits`} color="#ca8a04" bg="#fefce8"/>}
          {critiques===0 && sla===0 && enVoyage===0 && tauxInd>=60 && (
            <div style={{textAlign:'center',padding:'30px 0',color:'#16a34a'}}>
              <div style={{fontSize:44,marginBottom:8}}>✅</div>
              <p style={{fontWeight:700,fontSize:15,margin:0}}>Tout est normal</p>
              <p style={{fontSize:12,color:'#94a3b8',marginTop:4,margin:0}}>Aucune alerte active</p>
            </div>
          )}

        </div>

        {/* Conformité HSE */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'16px 18px'}}>
          <p style={{fontSize:14,fontWeight:700,color:'#0f172a',margin:'0 0 14px'}}>
            Conformité Induction HSE
          </p>
          {loading && <p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:'20px 0'}}>Chargement...</p>}
          {conf.map(({s,pct,total:t,induits:i}) => (
            <div key={s} style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:600,color:'#0f172a',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:175}}>
                  {s}
                </span>
                <span style={{fontSize:12,fontWeight:800,flexShrink:0,marginLeft:8,
                  color:pct>=80?'#16a34a':pct>=60?'#ea580c':'#dc2626'}}>
                  {pct}%
                </span>
              </div>
              <ProgBar value={pct} color={pct>=80?'#16a34a':pct>=60?'#f59e0b':'#dc2626'}/>
              <p style={{fontSize:10,color:'#94a3b8',margin:'3px 0 0'}}>{i}/{t} membres</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ligne 3: Notifications + Modules */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        {/* Notifications */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'16px 18px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p style={{fontSize:14,fontWeight:700,color:'#0f172a',margin:0}}>Activité récente</p>
            {unread > 0 && (
              <span style={{background:'#dbeafe',color:'#1e40af',padding:'2px 10px',
                borderRadius:99,fontSize:11,fontWeight:700}}>{unread} nouvelles</span>
            )}
          </div>
          {(d.notifs||[]).length === 0
            ? <p style={{color:'#94a3b8',fontSize:13,textAlign:'center',padding:'20px 0'}}>Aucune notification</p>
            : (d.notifs||[]).slice(0,6).map((n,i) => (
                <div key={n.id||i} style={{display:'flex',gap:10,padding:'9px 0',
                  borderBottom:i<5?'1px solid #f1f5f9':'none',alignItems:'flex-start'}}>
                  <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,marginTop:5,
                    background:!n.lu?'#2563eb':'#cbd5e1'}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:600,color:'#0f172a',margin:0,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {n.evenement_titre || n.message || 'Notification'}
                    </p>
                    <p style={{fontSize:11,color:'#94a3b8',margin:'2px 0 0'}}>
                      {n.date_envoi ? new Date(n.date_envoi).toLocaleString('fr-FR',{
                        day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
                    </p>
                  </div>
                </div>
              ))
          }
        </div>

        {/* Modules */}
        <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:'16px 18px'}}>
          <p style={{fontSize:14,fontWeight:700,color:'#0f172a',margin:'0 0 14px'}}>Accès rapides</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {MODULES.map(({icon,label,path,c,bg}) => (
              <div key={path} onClick={()=>nav(path)}
                style={{background:bg,borderRadius:10,padding:'14px',cursor:'pointer',
                  border:`1px solid ${c}22`,transition:'transform .15s'}}
                onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                onMouseLeave={e=>e.currentTarget.style.transform=''}>
                <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
                <p style={{fontSize:12,fontWeight:700,color:c,margin:0}}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
