/**
 * BAR & BOUTIQUE — Catalogue CI avec images réelles Wikipedia/Unsplash
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

// ── Photos réelles exactes par nom d'article ───────────────
const PHOTOS = {
  // 🍺 Bières
  'Castel 65cl':        'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Castel_beer.jpg/200px-Castel_beer.jpg',
  'Flag 65cl':          'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Flag_beer.jpg/200px-Flag_beer.jpg',
  'Heineken 50cl':      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Heineken_beer_bottle.jpg/200px-Heineken_beer_bottle.jpg',
  'Guinness':           'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Guinness.jpg/200px-Guinness.jpg',
  // 🥤 Softs
  'Coca-Cola':          'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_glass_bottle.jpg/200px-Coca-Cola_glass_bottle.jpg',
  'Fanta':              'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Fanta_Orange.jpg/200px-Fanta_Orange.jpg',
  'Sprite':             'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Sprite_can.jpg/200px-Sprite_can.jpg',
  'Malta Guinness':     'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Malta_Guinness.jpg/200px-Malta_Guinness.jpg',
  'Eau minerale':       'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Bottle_of_water.jpg/200px-Bottle_of_water.jpg',
  // 🍷 Vins
  'JP Chenet Rouge':    'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=300&h=300&fit=crop&q=85',
  "Baron d Arignac":   'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=300&h=300&fit=crop&q=85',
  'Grand Sud':          'https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=300&h=300&fit=crop&q=85',
  'Mouton Cadet':       'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=300&h=300&fit=crop&q=85',
  // 🥃 Liqueurs
  'Baileys':            'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=300&h=300&fit=crop&q=85',
  'Get 27':             'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300&h=300&fit=crop&q=85',
  'Malibu':             'https://images.unsplash.com/photo-1609951651556-5334e2706168?w=300&h=300&fit=crop&q=85',
  'Jagermeister':       'https://images.unsplash.com/photo-1575650772417-e6b418b0d9bf?w=300&h=300&fit=crop&q=85',
  // 🚬 Cigarettes
  'Cigarette Fine':     'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Cigarette_pack.jpg/200px-Cigarette_pack.jpg',
  'Cigarette Mustang':  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Cigarette_pack.jpg/200px-Cigarette_pack.jpg',
  'Marlboro':           'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Cigarette_pack.jpg/200px-Cigarette_pack.jpg',
  'Camel':              'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Cigarette_pack.jpg/200px-Cigarette_pack.jpg',
  'Winston':            'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Cigarette_pack.jpg/200px-Cigarette_pack.jpg',
  // 🍿 Snacks
  'Chips':              'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Potato-Chips.jpg/200px-Potato-Chips.jpg',
  'Biscuits':           'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Biscuits.jpg/200px-Biscuits.jpg',
  'Cacahuetes':         'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Peanuts.jpg/200px-Peanuts.jpg',
  'Chocolat':           'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Chocolate.jpg/200px-Chocolate.jpg',
  // 🧼 Hygiène
  'Savon':              'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Soap.jpg/200px-Soap.jpg',
  'Dentifrice':         'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Toothpaste.jpg/200px-Toothpaste.jpg',
  'Deodorant':          'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Deodorant.jpg/200px-Deodorant.jpg',
  'Papier toilette':    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Toilet_paper.jpg/200px-Toilet_paper.jpg',
}

const CATS = {
  biere:     { icon:'🍺', label:'Bières',               color:'#d97706', bg:'#fef3c7' },
  soft:      { icon:'🥤', label:'Softs & Jus',           color:'#0284c7', bg:'#e0f2fe' },
  vin:       { icon:'🍷', label:'Vins',                  color:'#9333ea', bg:'#f3e8ff' },
  liqueur:   { icon:'🥃', label:'Liqueurs & Spiritueux', color:'#dc2626', bg:'#fee2e2' },
  cigarette: { icon:'🚬', label:'Cigarettes',            color:'#64748b', bg:'#f1f5f9' },
  snack:     { icon:'🍿', label:'Snacks',                color:'#ea580c', bg:'#fff7ed' },
  hygiene:   { icon:'🧼', label:'Hygiène',               color:'#16a34a', bg:'#f0fdf4' },
  autre:     { icon:'📦', label:'Autres',                color:'#7c3aed', bg:'#ede9fe' },
}

function getEmoji(nom) {
  const n = (nom||'').toLowerCase()
  if (['castel','flag','heineken','guinness','biere','beer'].some(k=>n.includes(k))) return '🍺'
  if (['coca','fanta','sprite','malta','eau'].some(k=>n.includes(k))) return '🥤'
  if (['chenet','arignac','grand sud','mouton','vin'].some(k=>n.includes(k))) return '🍷'
  if (['baileys','get 27','malibu','jager','whisky','rhum'].some(k=>n.includes(k))) return '🥃'
  if (['marlboro','camel','winston','fine','mustang','cigarette'].some(k=>n.includes(k))) return '🚬'
  if (['chips','biscuit','cacahuete','chocolat'].some(k=>n.includes(k))) return '🍿'
  if (['savon','dentifrice','deodorant','papier'].some(k=>n.includes(k))) return '🧼'
  return '📦'
}

// ── Carte article POS ──────────────────────────────────────
function ArticleCard({ a, qty, onAdd }) {
  const [err, setErr] = useState(false)
  const url = PHOTOS[a.nom]
  const cfg = CATS[a.categorie] || CATS.autre
  const inCart = qty > 0

  return (
    <div onClick={() => onAdd(a)}
      style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        border: `2px solid ${inCart ? cfg.color : '#f1f5f9'}`,
        boxShadow: inCart ? `0 0 0 3px ${cfg.color}25, 0 4px 16px rgba(0,0,0,.1)` : '0 2px 8px rgba(0,0,0,.07)',
        transition: 'all .18s ease', position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 24px rgba(0,0,0,.15)` }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=inCart?`0 0 0 3px ${cfg.color}25, 0 4px 16px rgba(0,0,0,.1)`:'0 2px 8px rgba(0,0,0,.07)' }}>

      {/* Image */}
      <div style={{ height: 140, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${cfg.bg}, white)` }}>
        {url && !err ? (
          <img src={url} alt={a.nom} onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>
            {getEmoji(a.nom)}
          </div>
        )}

        {/* Badge catégorie haut gauche */}
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: cfg.color, color: '#fff',
          fontSize: 9.5, fontWeight: 800, padding: '3px 9px',
          borderRadius: 99, letterSpacing: .5,
        }}>
          {cfg.icon}
        </div>

        {/* Badge quantité panier */}
        {inCart && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 30, height: 30, borderRadius: '50%',
            background: cfg.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900,
            boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          }}>
            {qty}
          </div>
        )}
      </div>

      {/* Infos article */}
      <div style={{ padding: '10px 12px', borderTop: `2px solid ${cfg.bg}` }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: '#1e293b', lineHeight: 1.35, marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>
          {a.nom}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 900, color: cfg.color, fontSize: 17, fontFamily: 'monospace' }}>
            {parseInt(a.prix).toLocaleString()}
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>FCFA/{a.unite}</span>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function Boutique() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'

  const [articles,  setArticles]  = useState([])
  const [consos,    setConsos]    = useState([])
  const [personnel, setPersonnel] = useState([])
  const [statsJour, setStatsJour] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('caisse')
  const [catFilter, setCatFilter] = useState('')
  const [search,    setSearch]    = useState('')
  const [agentId,   setAgentId]   = useState('')
  const [agentInfo, setAgentInfo] = useState(null)
  const [panier,    setPanier]    = useState([])
  const [submitting,setSubmitting]= useState(false)
  const [msg,       setMsg]       = useState(null)
  const [scanning,  setScanning]  = useState(false)
  const [artModal,  setArtModal]  = useState(false)
  const [artForm,   setArtForm]   = useState({ nom:'', categorie:'biere', prix:0, stock:100, unite:'bouteille' })
  const scannerInst = useRef(null)

  const load = useCallback(() => {
    Promise.all([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({ page_size:50 }),
      boutiqueAPI.statsJour(),
      personnelAPI.list({ page_size:200 }),
    ]).then(([ra,rc,rs,rp]) => {
      setArticles(ra.data.results||ra.data||[])
      setConsos(rc.data.results||rc.data||[])
      setStatsJour(rs.data)
      setPersonnel(rp.data.results||rp.data||[])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(()=>{ load() }, [load])

  useEffect(()=>{
    if (!agentId){ setAgentInfo(null); return }
    setAgentInfo(personnel.find(x=>x.qr_code_string===agentId||String(x.id)===agentId||x.login_genere===agentId)||null)
  }, [agentId, personnel])

  const startScan = async () => {
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const sc = new Html5Qrcode('qr_b')
      scannerInst.current = sc
      await sc.start({ facingMode:'environment' }, { fps:10, qrbox:200 },
        d => { setAgentId(d); stopScan() }, ()=>{})
    } catch { setScanning(false) }
  }
  const stopScan = () => {
    try { scannerInst.current?.stop().then(()=>{ scannerInst.current=null; setScanning(false) }).catch(()=>setScanning(false)) }
    catch { setScanning(false) }
  }

  const addTo    = a => { setMsg(null); setPanier(p=>{ const ex=p.find(x=>x.a.id===a.id); return ex?p.map(x=>x.a.id===a.id?{...x,q:x.q+1}:x):[...p,{a,q:1}] }) }
  const decFrom  = id=> setPanier(p=>{ const ex=p.find(x=>x.a.id===id); return ex?.q>1?p.map(x=>x.a.id===id?{...x,q:x.q-1}:x):p.filter(x=>x.a.id!==id) })
  const totalP   = panier.reduce((s,x)=>s+x.a.prix*x.q,0)
  const qty      = a => panier.find(x=>x.a.id===a.id)?.q||0

  const valider = async () => {
    if (!panier.length) return setMsg({type:'error',text:'Panier vide'})
    setSubmitting(true); setMsg(null)
    try {
      await Promise.all(panier.map(({a,q})=>boutiqueAPI.addConso({article:a.id,personnel:agentInfo?.id||null,quantite:q})))
      setMsg({type:'success',text:`✅ Vente de ${totalP.toLocaleString()} FCFA enregistrée !`})
      setPanier([]); setAgentId(''); setAgentInfo(null); load()
    } catch(e){ setMsg({type:'error',text:e.response?.data?.detail||'Erreur'}) }
    finally { setSubmitting(false) }
  }

  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
  const arts = articles.filter(a=>(!catFilter||a.categorie===catFilter)&&(!search||a.nom.toLowerCase().includes(search.toLowerCase())))
  const byCat = arts.reduce((acc,a)=>({...acc,[a.categorie]:[...(acc[a.categorie]||[]),a]}),{})

  return (
    <div style={{padding:20,background:'#f8fafc',minHeight:'100dvh'}}>

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>🛒 Bar & Boutique</h2>
          <p style={{fontSize:12,color:'#64748b',margin:'3px 0 0'}}>{loading?'...':
            `${articles.length} articles · ${statsJour?.total||0} ventes aujourd'hui · ${(statsJour?.montant||0).toLocaleString()} FCFA`}</p>
        </div>
        {isAdmin&&<button onClick={()=>setArtModal(true)} style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'9px 16px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700}}>+ Article</button>}
      </div>

      {/* TABS */}
      <div style={{display:'flex',borderBottom:'2px solid #e2e8f0',marginBottom:16}}>
        {[['caisse','🛒 Caisse'],['historique','📋 Historique'],['catalogue','📦 Catalogue']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:'9px 20px',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,
              background:'transparent',color:tab===k?'#1e3a8a':'#64748b',
              borderBottom:`3px solid ${tab===k?'#1e3a8a':'transparent'}`,marginBottom:-2}}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ CAISSE ══ */}
      {tab==='caisse'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16}}>
          <div>
            {/* Filtres */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
                style={{...inp,maxWidth:180,padding:'7px 12px',fontSize:12,width:'auto'}}/>
              {[['','Tout'],...Object.entries(CATS).filter(([k])=>articles.some(a=>a.categorie===k)).map(([k,v])=>[k,`${v.icon}`])].map(([k,l])=>(
                <button key={k} onClick={()=>setCatFilter(k)}
                  style={{padding:'7px 13px',borderRadius:99,border:'2px solid',cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit',
                    background:catFilter===k?(k?CATS[k].color:'#1e3a8a'):'#fff',
                    color:catFilter===k?'#fff':(k?CATS[k].color:'#475569'),
                    borderColor:catFilter===k?(k?CATS[k].color:'#1e3a8a'):(k?CATS[k].color:'#e2e8f0')}}>
                  {l}{k&&` ${CATS[k]?.label}`}
                </button>
              ))}
            </div>

            {/* Grille */}
            {loading?(
              <div style={{textAlign:'center',padding:60,fontSize:36}}>⏳</div>
            ):Object.keys(byCat).length===0?(
              <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>
                <div style={{fontSize:56,marginBottom:12}}>🛒</div>
                <div style={{fontWeight:700,color:'#64748b'}}>Aucun article</div>
                <div style={{fontSize:12,marginTop:4}}>Allez dans Diagnostic → Initialiser les données</div>
              </div>
            ):(
              Object.entries(CATS).map(([cat,cfg])=>{
                const items=byCat[cat]; if(!items?.length) return null
                return (
                  <div key={cat} style={{marginBottom:22}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'6px 12px',background:cfg.bg,borderRadius:10,borderLeft:`4px solid ${cfg.color}`}}>
                      <span style={{fontSize:20}}>{cfg.icon}</span>
                      <span style={{fontWeight:800,fontSize:13,color:cfg.color}}>{cfg.label}</span>
                      <span style={{fontSize:11,color:'#94a3b8',marginLeft:'auto'}}>{items.length} articles</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:12}}>
                      {items.map(a=><ArticleCard key={a.id} a={a} qty={qty(a)} onAdd={addTo}/>)}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Panneau droit */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Agent */}
            <div style={{background:'#fff',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0'}}>
              <div style={{padding:'11px 14px',background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',fontWeight:700,fontSize:13}}>👤 Agent (optionnel)</div>
              <div style={{padding:12}}>
                <button onClick={scanning?stopScan:startScan}
                  style={{width:'100%',background:scanning?'#dc2626':'#1e3a8a',color:'#fff',border:'none',padding:10,borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,marginBottom:8}}>
                  {scanning?'⏹ Arrêter':'📷 Scanner QR Agent'}
                </button>
                {scanning&&<div id="qr_b" style={{borderRadius:8,overflow:'hidden',marginBottom:8}}/>}
                <div style={{display:'flex',gap:6}}>
                  <input value={agentId} onChange={e=>setAgentId(e.target.value)} placeholder="Login ou ID..."
                    style={{...inp,fontSize:12,padding:'7px 10px'}}/>
                  <button onClick={()=>{setAgentId('');setAgentInfo(null)}} style={{background:'#f1f5f9',border:'1px solid #e2e8f0',borderRadius:8,padding:'7px 10px',cursor:'pointer'}}>✕</button>
                </div>
                {agentInfo&&<div style={{marginTop:8,background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:'8px 12px'}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#166534'}}>{agentInfo.nom} {agentInfo.prenom}</div>
                  <div style={{fontSize:11,color:'#16a34a'}}>{agentInfo.societe}</div>
                </div>}
              </div>
            </div>

            {/* Panier */}
            <div style={{background:'#fff',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0',flex:1}}>
              <div style={{padding:'11px 14px',background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700,fontSize:13}}>🛒 Panier ({panier.length})</span>
                {panier.length>0&&<button onClick={()=>setPanier([])} style={{background:'rgba(220,38,38,.35)',border:'none',color:'#fff',padding:'3px 10px',borderRadius:99,cursor:'pointer',fontSize:12,fontWeight:700}}>Vider</button>}
              </div>
              <div style={{padding:12}}>
                {panier.length===0?(
                  <div style={{textAlign:'center',color:'#94a3b8',fontSize:12,padding:'24px 0'}}>Cliquez sur un article</div>
                ):(
                  <>
                    <div style={{maxHeight:240,overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                      {panier.map(({a,q})=>{
                        const url=PHOTOS[a.nom]
                        const cfg=CATS[a.categorie]||CATS.autre
                        return (
                          <div key={a.id} style={{display:'flex',alignItems:'center',gap:8,background:'#f8fafc',borderRadius:10,padding:'6px 10px'}}>
                            <div style={{width:40,height:40,borderRadius:9,overflow:'hidden',background:cfg.bg,flexShrink:0}}>
                              {url?<img src={url} alt={a.nom} style={{width:'100%',height:'100%',objectFit:'contain',padding:2}} onError={e=>e.target.style.display='none'}/>
                                :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{getEmoji(a.nom)}</div>}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:700,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nom}</div>
                              <div style={{fontSize:10,color:'#94a3b8'}}>{parseInt(a.prix).toLocaleString()} × {q}</div>
                            </div>
                            <div style={{fontWeight:900,fontSize:13,color:cfg.color,flexShrink:0}}>{(a.prix*q).toLocaleString()}</div>
                            <div style={{display:'flex',gap:2}}>
                              <button onClick={()=>decFrom(a.id)} style={{width:22,height:22,borderRadius:6,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontWeight:900}}>-</button>
                              <button onClick={()=>addTo(a)} style={{width:22,height:22,borderRadius:6,border:'none',background:'#1e3a8a',color:'#fff',cursor:'pointer',fontWeight:900}}>+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',borderRadius:12,padding:'12px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'rgba(255,255,255,.7)',fontSize:13}}>TOTAL</span>
                      <span style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:'#f0a500'}}>{totalP.toLocaleString()} FCFA</span>
                    </div>
                    {msg&&<div style={{padding:'8px 12px',borderRadius:8,marginBottom:10,fontSize:12,fontWeight:600,
                      background:msg.type==='success'?'#f0fdf4':'#fef2f2',
                      color:msg.type==='success'?'#166534':'#991b1b',
                      border:`1px solid ${msg.type==='success'?'#bbf7d0':'#fecaca'}`}}>{msg.text}</div>}
                    <button onClick={valider} disabled={submitting}
                      style={{width:'100%',background:submitting?'#94a3b8':'#16a34a',color:'#fff',border:'none',padding:'13px',borderRadius:10,cursor:submitting?'wait':'pointer',fontSize:14,fontWeight:700}}>
                      {submitting?'⏳...':'✅ Valider la vente'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ HISTORIQUE ══ */}
      {tab==='historique'&&(
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:14,overflow:'hidden'}}>
          {consos.length===0?(
            <div style={{padding:56,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:44,marginBottom:10}}>📋</div><div style={{fontWeight:700,color:'#64748b'}}>Aucune vente aujourd'hui</div></div>
          ):(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)'}}>
                {['Heure','Agent','Article','Qté','Montant'].map(h=><th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:10.5,fontWeight:700,textTransform:'uppercase',color:'rgba(255,255,255,.85)',letterSpacing:.8}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {consos.map((c,i)=>(
                  <tr key={c.id} style={{borderTop:'1px solid #f1f5f9',background:i%2?'#fafafa':'#fff'}}>
                    <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:11,color:'#64748b'}}>{new Date(c.date_conso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{padding:'10px 14px',fontSize:12,fontWeight:600}}>{c.personnel_nom||'Anonyme'}</td>
                    <td style={{padding:'10px 14px',fontSize:12}}>{getEmoji(c.article_nom||'')} {c.article_nom}</td>
                    <td style={{padding:'10px 14px',fontFamily:'monospace',textAlign:'center'}}>{c.quantite}</td>
                    <td style={{padding:'10px 14px',fontWeight:800,color:'#1e3a8a'}}>{parseInt(c.montant||0).toLocaleString()} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ CATALOGUE ══ */}
      {tab==='catalogue'&&(
        <div>
          {Object.entries(CATS).map(([cat,cfg])=>{
            const items=articles.filter(a=>a.categorie===cat)
            if(!items.length) return null
            return (
              <div key={cat} style={{marginBottom:28}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'10px 16px',background:cfg.bg,borderRadius:12,borderLeft:`5px solid ${cfg.color}`}}>
                  <span style={{fontSize:24}}>{cfg.icon}</span>
                  <div>
                    <div style={{fontWeight:800,fontSize:16,color:cfg.color}}>{cfg.label}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{items.length} articles disponibles</div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:14}}>
                  {items.map(a=><ArticleCard key={a.id} a={a} qty={qty(a)} onAdd={()=>{setTab('caisse');addTo(a)}}/>)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL */}
      {artModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setArtModal(false)}>
          <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:400,overflow:'hidden'}}>
            <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:15}}>+ Nouvel article</span>
              <button onClick={()=>setArtModal(false)} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              {[['Nom *','nom','text'],['Prix FCFA *','prix','number'],['Stock','stock','number'],['Unité','unite','text']].map(([l,f,t])=>(
                <div key={f}><label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>{l}</label>
                <input type={t} value={artForm[f]||''} onChange={e=>setArtForm({...artForm,[f]:e.target.value})} style={inp}/></div>
              ))}
              <div><label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Catégorie</label>
                <select value={artForm.categorie} onChange={e=>setArtForm({...artForm,categorie:e.target.value})} style={inp}>
                  {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setArtModal(false)} style={{flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontFamily:'inherit'}}>Annuler</button>
                <button onClick={async()=>{try{await boutiqueAPI.createArticle({...artForm,prix:Number(artForm.prix),stock:Number(artForm.stock)});setArtModal(false);load()}catch(e){alert(e.response?.data?.detail||'Erreur')}}}
                  style={{flex:2,background:'#1e3a8a',color:'#fff',border:'none',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>✅ Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
