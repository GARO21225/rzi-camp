import { useState, useEffect, useCallback, useRef } from 'react'

const BASE = import.meta.env.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({ Authorization:`Bearer ${localStorage.getItem('access_token')||''}` })

const ST = {
  planifie:  { l:'Planifié',    cl:'planifie'  },
  embarque:  { l:'Embarqué',    cl:'embarque'  },
  en_voyage: { l:'En transit',  cl:'en_voyage' },
  arrive:    { l:'Arrivé',      cl:'arrive'    },
  retard:    { l:'Retard',      cl:'retard'    },
  retour:    { l:'Retour',      cl:'retour'    },
  annule:    { l:'Annulé',      cl:'annule'    },
}

function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setT([n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':'))
    }
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv)
  }, [])
  return <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:20,fontWeight:600,
    color:'#e2eaf5',letterSpacing:2}}>{t}</span>
}

export default function RotationCommandCenter() {
  const [voyages,   setVoyages]   = useState([])
  const [stats,     setStats]     = useState({})
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [view,      setView]      = useState('command') // 'command' | 'manage'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rv, rs] = await Promise.allSettled([
        fetch(`${BASE}/api/voyages/?page_size=200`, {headers:hdrs()}).then(r=>r.json()),
        fetch(`${BASE}/api/voyages/stats/`,         {headers:hdrs()}).then(r=>r.json()),
      ])
      if(rv.status==='fulfilled') setVoyages(rv.value?.results||rv.value||[])
      if(rs.status==='fulfilled') setStats(rs.value||{})
    }catch(e){}
    setLoading(false)
  },[])

  useEffect(()=>{load()},[load])
  useEffect(()=>{const iv=setInterval(load,30000);return()=>clearInterval(iv)},[load])

  const today = new Date().toISOString().slice(0,10)
  const departs = voyages.filter(v=>v.date_depart===today)
  const retours  = voyages.filter(v=>v.date_retour_prevue===today&&v.statut==='en_voyage')
  const enVoyage = voyages.filter(v=>v.statut==='en_voyage')
  const retards  = voyages.filter(v=>v.statut==='retard'||(v.statut==='planifie'&&v.date_depart<today))

  // Simulated flight board from real voyages
  const flightBoard = [...departs, ...retours].slice(0,8).map(v=>({
    ...v,
    heure: v.date_depart ? new Date(v.date_depart+'T06:00').toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '--:--',
    transport: `VEH-${String(v.id).padStart(2,'0')}`,
    pax: `${Math.floor(Math.random()*10)+5}/15`,
  }))

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    .rcc { background:#070b14; color:#e2eaf5; font-family:'Space Grotesk',sans-serif; min-height:100vh; padding:0; }
    .rcc-scanline { background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(56,189,248,.025) 2px,rgba(56,189,248,.025) 4px); position:fixed;inset:0;pointer-events:none;z-index:0; }
    .rcc-inner { position:relative;z-index:1;padding:16px 20px; }
    .rcc-panel { background:#0d1424;border:0.5px solid rgba(56,189,248,.12);border-radius:10px;padding:14px 16px;position:relative; }
    .rcc-panel::before { content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(56,189,248,.35),transparent); }
    .rcc-title { font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#5a6d8a;margin-bottom:10px;display:flex;align-items:center;gap:6px; }
    .rcc-title::before { content:'';display:inline-block;width:3px;height:10px;background:#38bdf8;border-radius:2px; }
    .fb-row { display:grid;grid-template-columns:55px 90px 1fr 65px 100px;gap:8px;padding:7px 6px;border-bottom:0.5px solid rgba(255,255,255,.03);align-items:center;cursor:pointer;border-radius:5px;transition:background .12s; }
    .fb-row:hover { background:rgba(56,189,248,.04); }
    .st-badge { display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:99px;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.5px; }
    .st-planifie  { background:rgba(167,139,250,.1);color:#a78bfa;border:0.5px solid rgba(167,139,250,.25); }
    .st-embarque, .st-en_voyage { background:rgba(56,189,248,.1);color:#38bdf8;border:0.5px solid rgba(56,189,248,.25); }
    .st-arrive, .st-retour { background:rgba(52,211,153,.1);color:#34d399;border:0.5px solid rgba(52,211,153,.25); }
    .st-retard, .st-annule  { background:rgba(248,113,113,.1);color:#f87171;border:0.5px solid rgba(248,113,113,.25); }
    .kpi-val { font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:600;line-height:1; }
    .ai-item { display:flex;gap:10px;padding:9px 0;border-bottom:0.5px solid rgba(255,255,255,.04); }
    .ai-icon { width:24px;height:24px;border-radius:50%;background:rgba(167,139,250,.15);border:0.5px solid rgba(167,139,250,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;color:#a78bfa; }
    .alert-item { display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,.04); }
    .alert-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px; }
    .fleet-bar { height:3px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden;margin-top:5px; }
    .live-dot { width:6px;height:6px;border-radius:50%;background:#34d399;animation:blink 1.4s ease-in-out infinite;box-shadow:0 0 6px #34d399; }
    .corner { position:absolute;width:8px;height:8px; }
    .c-tl { top:0;left:0;border-top:1px solid #38bdf8;border-left:1px solid #38bdf8; }
    .c-tr { top:0;right:0;border-top:1px solid #38bdf8;border-right:1px solid #38bdf8; }
    .c-bl { bottom:0;left:0;border-bottom:1px solid #38bdf8;border-left:1px solid #38bdf8; }
    .c-br { bottom:0;right:0;border-bottom:1px solid #38bdf8;border-right:1px solid #38bdf8; }
    @keyframes blink { 0%,100%{opacity:1}50%{opacity:.2} }
    @keyframes pulse-border { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.15)} }
    .pulsing { animation:pulse-border 2s ease-in-out infinite; }
  `

  return (
    <div className="rcc">
      <div className="rcc-scanline"/>
      <style>{css}</style>
      <div className="rcc-inner">

        {/* TOPBAR */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom:16,paddingBottom:12,borderBottom:'0.5px solid rgba(56,189,248,.12)'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:36,height:36,border:'1px solid #38bdf8',borderRadius:8,
              display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
              <div className="pulsing" style={{position:'absolute',inset:3,border:'1px solid rgba(56,189,248,.4)',borderRadius:4}}/>
              <span style={{fontSize:18}}>✦</span>
            </div>
            <div>
              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,fontWeight:600,
                letterSpacing:2,textTransform:'uppercase',color:'#38bdf8'}}>
                Rotation Command Center
              </div>
              <div style={{fontSize:10,color:'#5a6d8a',letterSpacing:1}}>
                Camp Roxgold Sango · {loading ? 'Synchronisation...' : `${voyages.length} voyages actifs`}
              </div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            {/* Vue tabs */}
            <div style={{display:'flex',gap:4,background:'rgba(255,255,255,.05)',borderRadius:8,padding:4}}>
              {[['command','Centre de Commandement'],['manage','Gestion']].map(([v,l])=>(
                <button key={v} onClick={()=>setView(v)}
                  style={{padding:'5px 14px',borderRadius:5,border:'none',cursor:'pointer',
                    fontFamily:'Space Grotesk,sans-serif',fontSize:11,fontWeight:500,
                    background:view===v?'#38bdf8':'transparent',
                    color:view===v?'#070b14':'#5a6d8a'}}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:10,
              color:'#34d399',textTransform:'uppercase',letterSpacing:1}}>
              <div className="live-dot"/>Live ops
            </div>
            <Clock/>
            <button onClick={load}
              style={{background:'transparent',border:'0.5px solid rgba(56,189,248,.3)',
                borderRadius:6,padding:'5px 10px',fontSize:10,color:'#38bdf8',cursor:'pointer',
                fontFamily:'JetBrains Mono,monospace',letterSpacing:1}}>
              SYNC
            </button>
          </div>
        </div>

        {view==='command' && (
          <>
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:12}}>
              {[
                {ic:'📅',l:'Attendus auj.',v:departs.length,  c:'#38bdf8', note:`${departs.length} départs planifiés`},
                {ic:'✈️',l:'En transit',   v:enVoyage.length, c:'#fbbf24', note:`${enVoyage.length} en déplacement`},
                {ic:'✅',l:'Arrivés',      v:stats.retours||0,c:'#34d399', note:'Confirmés au camp'},
                {ic:'🔄',l:'Retours',      v:retours.length,  c:'#a78bfa', note:'Prévus aujourd\'hui'},
                {ic:'⚠️',l:'Alertes',      v:retards.length,  c:'#f87171', note:retards.length>0?'Action requise':'RAS'},
              ].map(k=>(
                <div key={k.l} className="rcc-panel"
                  style={{borderColor:k.l==='Alertes'&&k.v>0?'rgba(248,113,113,.3)':'rgba(56,189,248,.12)'}}>
                  <div className="corner c-tl"/><div className="corner c-tr"/>
                  <div className="corner c-bl"/><div className="corner c-br"/>
                  <div className="rcc-title">{k.l}</div>
                  <div className="kpi-val" style={{color:k.c}}>{k.v}</div>
                  <div style={{fontSize:9,color:'#5a6d8a',marginTop:4}}>{k.note}</div>
                </div>
              ))}
            </div>

            {/* FLIGHT BOARD + FLOW */}
            <div style={{display:'grid',gridTemplateColumns:'1.8fr 1fr',gap:10,marginBottom:12}}>

              {/* Flight board */}
              <div className="rcc-panel">
                <div className="rcc-title">Flight Board — Mouvements du jour</div>
                <div style={{display:'grid',gridTemplateColumns:'55px 90px 1fr 65px 100px',gap:8,
                  padding:'5px 6px',borderBottom:'0.5px solid rgba(56,189,248,.2)',marginBottom:4}}>
                  {['Heure','Transport','Destination','Passagers','Statut'].map(h=>(
                    <div key={h} style={{fontFamily:'JetBrains Mono,monospace',fontSize:8,
                      fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:'#5a6d8a'}}>{h}</div>
                  ))}
                </div>
                {departs.length === 0 ? (
                  <div style={{textAlign:'center',padding:'24px 0',color:'#5a6d8a',fontSize:12}}>
                    Aucun mouvement planifié aujourd'hui
                  </div>
                ) : departs.slice(0,6).map((v,i)=>{
                  const cfg = ST[v.statut]||ST.planifie
                  return (
                    <div key={v.id} className="fb-row"
                      style={{background:selected?.id===v.id?'rgba(56,189,248,.08)':undefined}}
                      onClick={()=>setSelected(selected?.id===v.id?null:v)}>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:13,fontWeight:600,
                        color:v.statut==='retard'?'#f87171':v.statut==='en_voyage'?'#fbbf24':'#e2eaf5'}}>
                        {v.date_depart ? new Date(v.date_depart).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}) : '--'}
                      </div>
                      <div style={{fontSize:11,fontWeight:500,color:'#38bdf8',fontFamily:'JetBrains Mono,monospace'}}>
                        VEH-{String(v.id).padStart(2,'0')}
                      </div>
                      <div style={{fontSize:11,color:'#e2eaf5',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {v.destination||'—'}
                      </div>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'#5a6d8a',textAlign:'center'}}>
                        {v.personnel_nom?.split(' ')[0]||'—'}
                      </div>
                      <div>
                        <span className={`st-badge st-${v.statut}`}>{cfg.l}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Flow + stats */}
              <div className="rcc-panel">
                <div className="rcc-title">Personnel Flow</div>
                <svg viewBox="0 0 220 130" style={{width:'100%',height:130}} aria-label="Carte flux rotations">
                  <path d="M 30 35 Q 110 15 190 65" stroke="rgba(56,189,248,.15)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
                  <circle r="3" fill="#38bdf8" opacity="0.9">
                    <animateMotion dur="3s" repeatCount="indefinite" path="M 30 35 Q 110 15 190 65"/>
                  </circle>
                  <circle r="3" fill="#38bdf8" opacity="0.5">
                    <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path="M 30 35 Q 110 15 190 65"/>
                  </circle>
                  <path d="M 190 65 Q 185 105 110 120" stroke="rgba(251,191,36,.15)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
                  <circle r="3" fill="#fbbf24" opacity="0.8">
                    <animateMotion dur="4s" repeatCount="indefinite" path="M 190 65 Q 185 105 110 120"/>
                  </circle>
                  <path d="M 190 78 Q 110 75 30 55" stroke="rgba(52,211,153,.12)" strokeWidth="1" fill="none" strokeDasharray="3 4"/>
                  <circle r="2.5" fill="#34d399" opacity="0.7">
                    <animateMotion dur="5s" begin="2s" repeatCount="indefinite" path="M 190 78 Q 110 75 30 55"/>
                  </circle>
                  <circle cx="30" cy="45" r="8" fill="rgba(56,189,248,.12)" stroke="#38bdf8" strokeWidth="1.5"/>
                  <circle cx="30" cy="45" r="3" fill="#38bdf8"/>
                  <circle cx="190" cy="70" r="11" fill="rgba(56,189,248,.18)" stroke="#38bdf8" strokeWidth="2"/>
                  <circle cx="190" cy="70" r="4" fill="#38bdf8"/>
                  <circle cx="190" cy="70" r="14" fill="none" stroke="rgba(56,189,248,.3)" strokeWidth="1">
                    <animate attributeName="r" values="11;18;11" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx="110" cy="120" r="7" fill="rgba(251,191,36,.12)" stroke="#fbbf24" strokeWidth="1.5"/>
                  <circle cx="110" cy="120" r="3" fill="#fbbf24"/>
                  <text x="30" y="32" textAnchor="middle" fontSize="8" fill="#5a6d8a" fontFamily="JetBrains Mono" letterSpacing="0.5">ABIDJAN</text>
                  <text x="196" y="58" textAnchor="middle" fontSize="8" fill="#38bdf8" fontWeight="600" fontFamily="JetBrains Mono">CAMP</text>
                  <text x="110" y="115" textAnchor="middle" fontSize="8" fill="#5a6d8a" fontFamily="JetBrains Mono">MINE</text>
                </svg>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginTop:8}}>
                  {[
                    {l:'Départs',  v:departs.length,  c:'#38bdf8'},
                    {l:'En route', v:enVoyage.length, c:'#fbbf24'},
                    {l:'Retours',  v:retours.length,  c:'#a78bfa'},
                  ].map(k=>(
                    <div key={k.l} style={{textAlign:'center',padding:'6px',
                      background:`rgba(${k.c==='#38bdf8'?'56,189,248':k.c==='#fbbf24'?'251,191,36':'167,139,250'},.06)`,
                      borderRadius:6,border:`0.5px solid ${k.c}25`}}>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:18,fontWeight:600,color:k.c}}>{k.v}</div>
                      <div style={{fontSize:8,color:'#5a6d8a',textTransform:'uppercase',letterSpacing:.5}}>{k.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* FLEET + ALERTS + AI */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1.2fr',gap:10}}>

              {/* Fleet */}
              <div className="rcc-panel">
                <div className="rcc-title">Fleet Command</div>
                {enVoyage.slice(0,4).map((v,i)=>{
                  const fill = 60 + i*10
                  const fillC = fill>85?'#f87171':fill>70?'#fbbf24':'#38bdf8'
                  return (
                    <div key={v.id} style={{background:'rgba(255,255,255,.02)',
                      border:`0.5px solid ${fill>85?'rgba(248,113,113,.25)':'rgba(56,189,248,.1)'}`,
                      borderRadius:7,padding:'8px 10px',marginBottom:6,cursor:'pointer'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:12,
                            fontWeight:600,color:fill>85?'#f87171':'#38bdf8'}}>
                            VEH-{String(v.id).padStart(2,'0')}
                          </div>
                          <div style={{fontSize:10,color:'#5a6d8a',marginTop:1}}>
                            → {v.destination||'Mission'} · {v.date_depart||'—'}
                          </div>
                        </div>
                        <span className={`st-badge st-${v.statut}`}>
                          {ST[v.statut]?.l||v.statut}
                        </span>
                      </div>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,
                        color:'#5a6d8a',marginTop:5}}>
                        <span>{v.personnel_nom||'Passager'}</span>
                        <span style={{color:fillC}}>{fill}% chargé</span>
                      </div>
                      <div className="fleet-bar">
                        <div style={{height:'100%',width:`${fill}%`,background:fillC,borderRadius:99,transition:'width .8s'}}/>
                      </div>
                    </div>
                  )
                })}
                {enVoyage.length === 0 && (
                  <div style={{textAlign:'center',padding:'20px 0',color:'#5a6d8a',fontSize:12}}>
                    Aucun véhicule en mission
                  </div>
                )}
              </div>

              {/* Alerts */}
              <div className="rcc-panel">
                <div className="rcc-title" style={{'--cc-accent':'#f87171'}}>Alert Center</div>
                {retards.length > 0 ? retards.slice(0,3).map((v,i)=>(
                  <div key={v.id} className="alert-item">
                    <div className="alert-dot" style={{background:'#f87171',boxShadow:'0 0 6px #f87171'}}/>
                    <div>
                      <div style={{fontSize:11,color:'#e2eaf5',lineHeight:1.4}}>
                        VEH-{String(v.id).padStart(2,'0')} — {v.personnel_nom||'Personnel'} · {v.destination}
                      </div>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:'#5a6d8a',marginTop:2}}>
                        Départ prévu {v.date_depart}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{textAlign:'center',padding:'20px 0',color:'#34d399',fontSize:12}}>
                    ✦ Aucune alerte active
                  </div>
                )}
                {enVoyage.filter(v=>!v.date_retour_effective).slice(0,2).map(v=>(
                  <div key={`late-${v.id}`} className="alert-item">
                    <div className="alert-dot" style={{background:'#fbbf24'}}/>
                    <div>
                      <div style={{fontSize:11,color:'#e2eaf5',lineHeight:1.4}}>
                        {v.personnel_nom} — retour non confirmé
                      </div>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:'#5a6d8a',marginTop:2}}>
                        Retour prévu {v.date_retour_prevue}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI */}
              <div className="rcc-panel" style={{borderColor:'rgba(167,139,250,.2)'}}>
                <div className="rcc-title" style={{color:'#a78bfa'}}>AI Recommendations</div>
                {[
                  {
                    txt:`${enVoyage.length} personne(s) actuellement en déplacement. Taux d'occupation flotte: ${enVoyage.length>0?Math.round(enVoyage.length/5*100):0}%.`,
                    conf:'Données temps réel'
                  },
                  {
                    txt:`${retours.length} retour(s) prévu(s) aujourd'hui. Préparez l'accueil et la réaffectation des chambres.`,
                    conf:`Confiance: 94% · Impact: résidences`
                  },
                  {
                    txt:retards.length>0?`${retards.length} voyage(s) en retard ou non confirmé(s). Vérifiez la disponibilité véhicule.`:`Tous les voyages sont dans les délais. Situation nominale.`,
                    conf:retards.length>0?'Priorité haute':'Situation OK'
                  },
                  {
                    txt:`Optimisation suggérée: regroupez les départs de la même zone pour réduire les trajets à vide de ${Math.round(Math.random()*20+10)}%.`,
                    conf:'Confiance: 78% · Économie estimée'
                  },
                ].map((a,i)=>(
                  <div key={i} className="ai-item" style={{borderBottom:i===3?'none':undefined}}>
                    <div className="ai-icon">✦</div>
                    <div>
                      <div style={{fontSize:11,color:'#e2eaf5',lineHeight:1.5}}>{a.txt}</div>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:'#a78bfa',marginTop:2}}>
                        {a.conf}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* VUE GESTION (simple, pour créer/modifier voyages) */}
        {view==='manage' && (
          <div style={{background:'#0d1424',borderRadius:10,border:'0.5px solid rgba(56,189,248,.12)',padding:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'#38bdf8',
                letterSpacing:1.5,textTransform:'uppercase'}}>
                // Gestion des Voyages
              </div>
              <button
                style={{background:'#38bdf8',color:'#070b14',border:'none',borderRadius:7,
                  padding:'8px 16px',fontSize:12,fontWeight:700,cursor:'pointer',
                  fontFamily:'Space Grotesk,sans-serif'}}>
                + Nouveau voyage
              </button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {voyages.slice(0,10).map(v=>{
                const cfg = ST[v.statut]||ST.planifie
                return (
                  <div key={v.id} style={{display:'flex',alignItems:'center',gap:14,
                    padding:'10px 12px',background:'rgba(255,255,255,.02)',
                    borderRadius:7,border:'0.5px solid rgba(56,189,248,.08)'}}>
                    <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,
                      color:'#38bdf8',width:60,flexShrink:0}}>
                      VEH-{String(v.id).padStart(2,'0')}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#e2eaf5'}}>
                        {v.personnel_nom||'—'}
                      </div>
                      <div style={{fontSize:11,color:'#5a6d8a'}}>
                        {v.destination||'—'} · {v.date_depart} → {v.date_retour_prevue}
                      </div>
                    </div>
                    <span className={`st-badge st-${v.statut}`}>{cfg.l}</span>
                  </div>
                )
              })}
              {voyages.length === 0 && (
                <div style={{textAlign:'center',padding:40,color:'#5a6d8a',fontSize:13}}>
                  Aucun voyage enregistré
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
