/**
 * BAR & BOUTIQUE — Catalogue Marketplace CI
 * 50 produits · 13 catégories · Images réelles
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

// ── Images réelles par nom de produit ──────────────────────
const PHOTOS = {
  // Boissons gazeuses
  'Coca-Cola Classic':        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Coca-Cola_glass_bottle.jpg/200px-Coca-Cola_glass_bottle.jpg',
  'Coca-Cola 1.5L':           'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&h=400&fit=crop&q=80',
  'Fanta Orange':             'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Fanta_Orange.jpg/200px-Fanta_Orange.jpg',
  'Sprite':                   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Sprite_can.jpg/200px-Sprite_can.jpg',
  'Schweppes Tonic':          'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400&h=400&fit=crop&q=80',
  'Pepsi':                    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=400&fit=crop&q=80',
  '7 Up':                     'https://images.unsplash.com/photo-1581098365948-6a5a912b7a49?w=400&h=400&fit=crop&q=80',
  // Jus & Softs
  'Darci Mangue':             'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&h=400&fit=crop&q=80',
  'Pressea Orange':           'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400&h=400&fit=crop&q=80',
  'Ceres Multifruits':        'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&h=400&fit=crop&q=80',
  'Minute Maid Orange':       'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=400&h=400&fit=crop&q=80',
  'Malta Guinness':           'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Malta_Guinness.jpg/200px-Malta_Guinness.jpg',
  // Énergisantes
  'Red Bull Original':        'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=400&fit=crop&q=80',
  'Monster Energy Green':     'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=400&fit=crop&q=80',
  // Eaux
  'Evian':                    'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&h=400&fit=crop&q=80',
  'Cristaline':               'https://images.unsplash.com/photo-1616118132534-381055fe2e4d?w=400&h=400&fit=crop&q=80',
  // Bières
  'Heineken':                 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Heineken_beer_bottle.jpg/200px-Heineken_beer_bottle.jpg',
  'Desperados':               'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&h=400&fit=crop&q=80',
  'Guinness Stout':           'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Guinness.jpg/200px-Guinness.jpg',
  'Corona Extra':             'https://images.unsplash.com/photo-1566633806827-5c6cc7f5aff3?w=400&h=400&fit=crop&q=80',
  'Beaufort 65cl':            'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=400&fit=crop&q=80',
  'Ivoire Speciale':          'https://images.unsplash.com/photo-1473396877154-85e23c3f3096?w=400&h=400&fit=crop&q=80',
  // Vins rouges
  'JP Chenet Rouge':          'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=400&fit=crop&q=80',
  'Mouton Cadet Rouge':       'https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=400&h=400&fit=crop&q=80',
  "Jacob s Creek Shiraz":     'https://images.unsplash.com/photo-1569919659476-f0852f6834b7?w=400&h=400&fit=crop&q=80',
  // Vins blancs
  'JP Chenet Blanc':          'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&h=400&fit=crop&q=80',
  'Mateus Blanc':             'https://images.unsplash.com/photo-1474722883778-792e7990302f?w=400&h=400&fit=crop&q=80',
  // Vins rosés
  'Mateus Rose':              'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=400&h=400&fit=crop&q=80',
  'JP Chenet Rose':           'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&h=400&fit=crop&q=80',
  // Champagnes
  'Moet et Chandon Brut':     'https://images.unsplash.com/photo-1548211091-0e8de7b28a0b?w=400&h=400&fit=crop&q=80',
  'Veuve Clicquot Brut':      'https://images.unsplash.com/photo-1531401675083-f9e0abeef2c1?w=400&h=400&fit=crop&q=80',
  'Dom Perignon Vintage':     'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&h=400&fit=crop&q=80',
  // Spiritueux
  "Jack Daniel s Old N7":     'https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=400&h=400&fit=crop&q=80',
  'Johnnie Walker Black':     'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=400&fit=crop&q=80',
  'Hennessy VS':              'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&h=400&fit=crop&q=80',
  'Bacardi Carta Blanca':     'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=400&fit=crop&q=80',
  'Absolut Vodka':            'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=400&fit=crop&q=80',
  // Liqueurs
  'Baileys Original':         'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?w=400&h=400&fit=crop&q=80',
  'Malibu Coco':              'https://images.unsplash.com/photo-1609951651556-5334e2706168?w=400&h=400&fit=crop&q=80',
  'Jagermeister':             'https://images.unsplash.com/photo-1575650772417-e6b418b0d9bf?w=400&h=400&fit=crop&q=80',
  'Cointreau':                'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=400&h=400&fit=crop&q=80',
  'Amarula Cream':            'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=400&h=400&fit=crop&q=80',
  'Kahlua':                   'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&q=80',
  'Get 27':                   'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&h=400&fit=crop&q=80',
  // Cafés
  'Nescafe Classic':          'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=400&h=400&fit=crop&q=80',
  'Nescafe Gold':             'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=400&fit=crop&q=80',
  // Thés
  'Lipton Yellow Label':      'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&h=400&fit=crop&q=80',
  'Lipton Green Tea':         'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop&q=80',
  'Twinings English Breakfast':'https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=400&h=400&fit=crop&q=80',
  'Twinings Camomille':       'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop&q=80',
}

// ── Config catégories ───────────────────────────────────────
const CATS = {
  gazeuse:    {icon:'🥤', label:'Boissons gazeuses',     c:'#ef4444', bg:'#fef2f2'},
  jus:        {icon:'🍊', label:'Jus & Softs',            c:'#f97316', bg:'#fff7ed'},
  energie:    {icon:'⚡', label:'Énergisantes',           c:'#eab308', bg:'#fefce8'},
  eau:        {icon:'💧', label:'Eaux minérales',         c:'#0ea5e9', bg:'#f0f9ff'},
  biere:      {icon:'🍺', label:'Bières',                 c:'#d97706', bg:'#fffbeb'},
  vin_rouge:  {icon:'🍷', label:'Vins rouges',            c:'#be123c', bg:'#fff1f2'},
  vin_blanc:  {icon:'🥂', label:'Vins blancs',            c:'#ca8a04', bg:'#fefce8'},
  vin_rose:   {icon:'🌸', label:'Vins rosés',             c:'#ec4899', bg:'#fdf2f8'},
  champagne:  {icon:'🍾', label:'Champagnes',             c:'#a16207', bg:'#fef9c3'},
  spiritueux: {icon:'🥃', label:'Spiritueux',             c:'#7c3aed', bg:'#f5f3ff'},
  liqueur:    {icon:'🫗', label:'Liqueurs',               c:'#6d28d9', bg:'#ede9fe'},
  cafe:       {icon:'☕', label:'Cafés',                  c:'#92400e', bg:'#fdf6ec'},
  the:        {icon:'🍵', label:'Thés & Infusions',       c:'#15803d', bg:'#f0fdf4'},
  autre:      {icon:'📦', label:'Autres',                 c:'#64748b', bg:'#f8fafc'},
}

function getEmoji(nom) {
  const n = (nom||'').toLowerCase()
  if (['coca','fanta','sprite','pepsi','7up','schweppes'].some(k=>n.includes(k))) return '🥤'
  if (['darci','pressea','ceres','minute','malta'].some(k=>n.includes(k))) return '🍊'
  if (['red bull','monster','energy'].some(k=>n.includes(k))) return '⚡'
  if (['evian','cristaline','eau'].some(k=>n.includes(k))) return '💧'
  if (['heineken','desperados','guinness','corona','beaufort','ivoire'].some(k=>n.includes(k))) return '🍺'
  if (['chenet rouge','mouton cadet','jacob','shiraz'].some(k=>n.includes(k))) return '🍷'
  if (['chenet blanc','mateus blanc'].some(k=>n.includes(k))) return '🥂'
  if (['rose','rosé'].some(k=>n.includes(k))) return '🌸'
  if (['moet','veuve','dom per','champagne'].some(k=>n.includes(k))) return '🍾'
  if (['jack','johnnie','hennessy','bacardi','absolut','whisky','vodka'].some(k=>n.includes(k))) return '🥃'
  if (['baileys','malibu','jager','cointreau','amarula','kahlua','get 27'].some(k=>n.includes(k))) return '🫗'
  if (['nescafe','cafe','café'].some(k=>n.includes(k))) return '☕'
  if (['lipton','twinings','thé','the','infusion','camomille'].some(k=>n.includes(k))) return '🍵'
  return '📦'
}

// ── Étoiles rating ──────────────────────────────────────────
function Stars({ r }) {
  return <span style={{color:'#f59e0b', fontSize:11}}> {'★'.repeat(Math.round(r))}{'☆'.repeat(5-Math.round(r))} {r}</span>
}

// ── Carte article Marketplace ───────────────────────────────
function ArticleCard({ a, qty, onAdd }) {
  const [err, setErr] = useState(false)
  const url = PHOTOS[a.nom]
  const cfg = CATS[a.categorie] || CATS.autre
  const inCart = qty > 0

  return (
    <div onClick={() => onAdd(a)} style={{
      background:'#fff', borderRadius:16, overflow:'hidden', cursor:'pointer',
      border:`2px solid ${inCart ? cfg.c : '#f1f5f9'}`,
      boxShadow: inCart ? `0 0 0 3px ${cfg.c}25, 0 4px 20px rgba(0,0,0,.12)` : '0 2px 10px rgba(0,0,0,.08)',
      transition:'all .18s ease', display:'flex', flexDirection:'column',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow=`0 12px 28px rgba(0,0,0,.16)` }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=inCart?`0 0 0 3px ${cfg.c}25, 0 4px 20px rgba(0,0,0,.12)`:'0 2px 10px rgba(0,0,0,.08)' }}>

      {/* Photo */}
      <div style={{height:150, background:`linear-gradient(135deg,${cfg.bg},#fff)`, position:'relative', overflow:'hidden', flexShrink:0}}>
        {url && !err ? (
          <img src={url} alt={a.nom} onError={()=>setErr(true)}
            style={{width:'100%', height:'100%', objectFit:'contain', padding:8, display:'block'}}/>
        ) : (
          <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:60}}>
            {getEmoji(a.nom)}
          </div>
        )}
        {/* Badge catégorie */}
        <div style={{position:'absolute', top:8, left:8, background:cfg.c, color:'#fff',
          fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:99, letterSpacing:.5}}>
          {cfg.icon}
        </div>
        {/* Badge stock faible */}
        {a.stock < 15 && (
          <div style={{position:'absolute', bottom:6, left:8, background:'#dc2626', color:'#fff',
            fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:99}}>
            Stock limité
          </div>
        )}
        {/* Badge panier */}
        {inCart && (
          <div style={{position:'absolute', top:8, right:8, width:28, height:28, borderRadius:'50%',
            background:cfg.c, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:900, boxShadow:'0 2px 8px rgba(0,0,0,.3)'}}>
            {qty}
          </div>
        )}
      </div>

      {/* Infos */}
      <div style={{padding:'10px 12px', flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between',
        borderTop:`2px solid ${cfg.bg}`}}>
        <div>
          <div style={{fontSize:11.5, fontWeight:700, color:'#1e293b', lineHeight:1.4, marginBottom:3,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
            {a.nom}
          </div>
          <div style={{fontSize:10, color:'#94a3b8', marginBottom:4}}>{a.unite}</div>
        </div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontWeight:900, color:cfg.c, fontSize:15, fontFamily:'monospace'}}>
            {parseInt(a.prix).toLocaleString()}
            <span style={{fontSize:9, fontWeight:600, marginLeft:2}}>FCFA</span>
          </div>
          <div style={{fontSize:9.5, color:'#94a3b8'}}>{a.stock} restants</div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function Boutique() {
  const {user} = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role==='admin'

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
  const [artForm,   setArtForm]   = useState({nom:'',categorie:'gazeuse',prix:0,stock:100,unite:'33cl'})
  const scannerInst = useRef(null)

  const load = useCallback(() => {
    Promise.all([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({page_size:50}),
      boutiqueAPI.statsJour(),
      personnelAPI.list({page_size:200}),
    ]).then(([ra,rc,rs,rp]) => {
      setArticles(ra.data.results||ra.data||[])
      setConsos(rc.data.results||rc.data||[])
      setStatsJour(rs.data)
      setPersonnel(rp.data.results||rp.data||[])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    if(!agentId){setAgentInfo(null);return}
    setAgentInfo(personnel.find(x=>x.qr_code_string===agentId||String(x.id)===agentId||x.login_genere===agentId)||null)
  },[agentId,personnel])

  const startScan = async () => {
    setScanning(true)
    try {
      const {Html5Qrcode} = await import('html5-qrcode')
      const sc = new Html5Qrcode('qr_b')
      scannerInst.current = sc
      await sc.start({facingMode:'environment'},{fps:10,qrbox:200},d=>{setAgentId(d);stopScan()},()=>{})
    } catch{setScanning(false)}
  }
  const stopScan = () => {
    try{scannerInst.current?.stop().then(()=>{scannerInst.current=null;setScanning(false)}).catch(()=>setScanning(false))}catch{setScanning(false)}
  }

  const addTo   = a => {setMsg(null);setPanier(p=>{const ex=p.find(x=>x.a.id===a.id);return ex?p.map(x=>x.a.id===a.id?{...x,q:x.q+1}:x):[...p,{a,q:1}]})}
  const decFrom = id=> setPanier(p=>{const ex=p.find(x=>x.a.id===id);return ex?.q>1?p.map(x=>x.a.id===id?{...x,q:x.q-1}:x):p.filter(x=>x.a.id!==id)})
  const totalP  = panier.reduce((s,x)=>s+x.a.prix*x.q,0)
  const qty     = a => panier.find(x=>x.a.id===a.id)?.q||0

  const valider = async () => {
    if(!panier.length) return setMsg({type:'error',text:'Panier vide'})
    setSubmitting(true); setMsg(null)
    try {
      await Promise.all(panier.map(({a,q})=>boutiqueAPI.addConso({article:a.id,personnel:agentInfo?.id||null,quantite:q})))
      setMsg({type:'success',text:`✅ Vente de ${totalP.toLocaleString()} FCFA enregistrée !`})
      setPanier([]); setAgentId(''); setAgentInfo(null); load()
    } catch(e){setMsg({type:'error',text:e.response?.data?.detail||'Erreur'})}
    finally{setSubmitting(false)}
  }

  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
  const arts = articles.filter(a=>(!catFilter||a.categorie===catFilter)&&(!search||a.nom.toLowerCase().includes(search.toLowerCase())))
  const byCat = arts.reduce((acc,a)=>({...acc,[a.categorie]:[...(acc[a.categorie]||[]),a]}),{})
  const catOrder = ['gazeuse','jus','energie','eau','biere','vin_rouge','vin_blanc','vin_rose','champagne','spiritueux','liqueur','cafe','the','autre']

  return (
    <div style={{padding:20,background:'#f8fafc',minHeight:'100dvh'}}>

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>🛒 Bar & Boutique</h2>
          <p style={{fontSize:12,color:'#64748b',margin:'3px 0 0'}}>
            {loading?'...':
              `${articles.length} produits · ${Object.keys(byCat).length} catégories · ${statsJour?.total||0} ventes aujourd'hui`}
          </p>
        </div>
        {isAdmin&&<button onClick={()=>setArtModal(true)} style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'9px 16px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700}}>+ Article</button>}
      </div>

      {/* STATS DU JOUR */}
      {statsJour && statsJour.total > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
          {[['🛒 Ventes',statsJour.total,'#1e3a8a'],
            ['💰 CA',`${(statsJour.montant||0).toLocaleString()} FCFA`,'#16a34a'],
            ['📦 Articles',articles.length,'#7c3aed']].map(([l,v,c])=>(
            <div key={l} style={{background:'#fff',borderRadius:12,padding:'12px 16px',borderTop:`3px solid ${c}`,boxShadow:'0 1px 4px rgba(0,0,0,.06)'}}>
              <div style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:3}}>{l}</div>
            </div>
          ))}
        </div>
      )}

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
      {tab==='caisse' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 310px',gap:16}}>
          <div>
            {/* Filtres */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un produit..."
                style={{...inp,maxWidth:200,padding:'7px 12px',fontSize:12,width:'auto'}}/>
              <button onClick={()=>setCatFilter('')}
                style={{padding:'6px 14px',borderRadius:99,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
                  background:!catFilter?'#1e3a8a':'#fff',color:!catFilter?'#fff':'#475569',borderColor:!catFilter?'#1e3a8a':'#e2e8f0'}}>
                Tout
              </button>
              {catOrder.filter(k=>articles.some(a=>a.categorie===k)).map(k=>{
                const cfg=CATS[k]||CATS.autre
                return (
                  <button key={k} onClick={()=>setCatFilter(catFilter===k?'':k)}
                    style={{padding:'6px 13px',borderRadius:99,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
                      background:catFilter===k?cfg.c:'#fff',color:catFilter===k?'#fff':cfg.c,borderColor:cfg.c}}>
                    {cfg.icon} {cfg.label}
                  </button>
                )
              })}
            </div>

            {/* Grille */}
            {loading ? (
              <div style={{textAlign:'center',padding:60,fontSize:36}}>⏳</div>
            ) : Object.keys(byCat).length===0 ? (
              <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>
                <div style={{fontSize:56,marginBottom:12}}>🛒</div>
                <div style={{fontWeight:700,color:'#64748b',fontSize:15}}>Aucun article</div>
                <div style={{fontSize:12,marginTop:4}}>Allez dans Diagnostic → Initialiser les données</div>
              </div>
            ) : (
              catOrder.filter(cat=>byCat[cat]?.length).map(cat => {
                const cfg=CATS[cat]||CATS.autre
                const items=byCat[cat]
                return (
                  <div key={cat} style={{marginBottom:24}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,
                      padding:'8px 16px',background:cfg.bg,borderRadius:12,borderLeft:`5px solid ${cfg.c}`}}>
                      <span style={{fontSize:22}}>{cfg.icon}</span>
                      <span style={{fontWeight:800,fontSize:14,color:cfg.c}}>{cfg.label}</span>
                      <span style={{fontSize:11,color:'#94a3b8',marginLeft:'auto'}}>{items.length} produits</span>
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
              <div style={{padding:'11px 14px',background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',fontWeight:700,fontSize:13}}>
                👤 Agent (optionnel)
              </div>
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
                {agentInfo&&(
                  <div style={{marginTop:8,background:'#f0fdf4',border:'1px solid #86efac',borderRadius:10,padding:'8px 12px'}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#166534'}}>{agentInfo.nom} {agentInfo.prenom}</div>
                    <div style={{fontSize:11,color:'#16a34a'}}>{agentInfo.societe}</div>
                  </div>
                )}
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
                  <div style={{textAlign:'center',color:'#94a3b8',fontSize:12,padding:'24px 0'}}>Cliquez sur un article pour l'ajouter</div>
                ):(
                  <>
                    <div style={{maxHeight:260,overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                      {panier.map(({a,q})=>{
                        const url=PHOTOS[a.nom]; const cfg=CATS[a.categorie]||CATS.autre
                        return (
                          <div key={a.id} style={{display:'flex',alignItems:'center',gap:8,background:'#f8fafc',borderRadius:10,padding:'6px 10px'}}>
                            <div style={{width:42,height:42,borderRadius:10,overflow:'hidden',background:cfg.bg,flexShrink:0}}>
                              {url?<img src={url} alt={a.nom} style={{width:'100%',height:'100%',objectFit:'contain',padding:3}} onError={e=>e.target.style.display='none'}/>
                                :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{getEmoji(a.nom)}</div>}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:700,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nom}</div>
                              <div style={{fontSize:10,color:'#94a3b8'}}>{parseInt(a.prix).toLocaleString()} × {q}</div>
                            </div>
                            <div style={{fontWeight:900,fontSize:13,color:cfg.c,flexShrink:0}}>{(a.prix*q).toLocaleString()}</div>
                            <div style={{display:'flex',gap:2}}>
                              <button onClick={()=>decFrom(a.id)} style={{width:22,height:22,borderRadius:6,border:'1.5px solid #e2e8f0',background:'#fff',cursor:'pointer',fontWeight:900,fontSize:14}}>-</button>
                              <button onClick={()=>addTo(a)} style={{width:22,height:22,borderRadius:6,border:'none',background:'#1e3a8a',color:'#fff',cursor:'pointer',fontWeight:900,fontSize:14}}>+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',borderRadius:12,padding:'12px 16px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'rgba(255,255,255,.7)',fontSize:13}}>TOTAL</span>
                      <span style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:'#f0a500'}}>{totalP.toLocaleString()} <span style={{fontSize:11}}>FCFA</span></span>
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
            <div style={{padding:56,textAlign:'center',color:'#94a3b8'}}>
              <div style={{fontSize:44,marginBottom:10}}>📋</div>
              <div style={{fontWeight:700,color:'#64748b'}}>Aucune vente aujourd'hui</div>
            </div>
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
          {catOrder.filter(cat=>articles.some(a=>a.categorie===cat)).map(cat=>{
            const cfg=CATS[cat]||CATS.autre
            const items=articles.filter(a=>a.categorie===cat)
            return (
              <div key={cat} style={{marginBottom:28}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,
                  padding:'10px 16px',background:cfg.bg,borderRadius:12,borderLeft:`5px solid ${cfg.c}`}}>
                  <span style={{fontSize:26}}>{cfg.icon}</span>
                  <div>
                    <div style={{fontWeight:800,fontSize:16,color:cfg.c}}>{cfg.label}</div>
                    <div style={{fontSize:11,color:'#94a3b8'}}>{items.length} produits disponibles</div>
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

      {/* MODAL CRÉER */}
      {artModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setArtModal(false)}>
          <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:15}}>+ Nouvel article</span>
              <button onClick={()=>setArtModal(false)} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              {[['Nom *','nom','text'],['Prix FCFA *','prix','number'],['Stock','stock','number'],['Unité','unite','text']].map(([l,f,t])=>(
                <div key={f}><label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>{l}</label>
                <input type={t} value={artForm[f]||''} onChange={e=>setArtForm({...artForm,[f]:e.target.value})} style={inp}/></div>
              ))}
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Catégorie</label>
                <select value={artForm.categorie} onChange={e=>setArtForm({...artForm,categorie:e.target.value})} style={inp}>
                  {catOrder.map(k=><option key={k} value={k}>{CATS[k]?.icon} {CATS[k]?.label||k}</option>)}
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
