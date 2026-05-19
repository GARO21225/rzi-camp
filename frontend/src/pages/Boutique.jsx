/**
 * BAR & BOUTIQUE — Produits CI avec vraies photos + Fonctionnement Restauration
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

// ── Photos réelles produits CI ──────────────────────────────
const IMG = {
  // Bières
  'castel':     'https://images.unsplash.com/photo-1624552184280-9e9c17fa4e74?w=280&h=280&fit=crop',
  'flag':       'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=280&h=280&fit=crop',
  'beaufort':   'https://images.unsplash.com/photo-1618183479302-1e0aa382c36b?w=280&h=280&fit=crop',
  'heineken':   'https://images.unsplash.com/photo-1595981234058-a9302fb97229?w=280&h=280&fit=crop',
  'bock':       'https://images.unsplash.com/photo-1567696153798-9111f9cd3d0d?w=280&h=280&fit=crop',
  'ivoire':     'https://images.unsplash.com/photo-1473396877154-85e23c3f3096?w=280&h=280&fit=crop',
  // Spiritueux
  'sodabi':     'https://images.unsplash.com/photo-1608885898957-a559228e8749?w=280&h=280&fit=crop',
  'whisky':     'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=280&h=280&fit=crop',
  'rhum':       'https://images.unsplash.com/photo-1612528443702-f6741f70a049?w=280&h=280&fit=crop',
  'vin':        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=280&h=280&fit=crop',
  // Softs
  'coca':       'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=280&h=280&fit=crop',
  'fanta':      'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=280&h=280&fit=crop',
  'malta':      'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=280&h=280&fit=crop',
  'eau':        'https://images.unsplash.com/photo-1616118132534-381055fe2e4d?w=280&h=280&fit=crop',
  'jus':        'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=280&h=280&fit=crop',
  'caf':        'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=280&h=280&fit=crop',
  // Snacks
  'chips':      'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=280&h=280&fit=crop',
  'prince':     'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=280&h=280&fit=crop',
  'delice':     'https://images.unsplash.com/photo-1586985289688-ca3cf47d3e6e?w=280&h=280&fit=crop',
  'biscuit':    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=280&h=280&fit=crop',
  'cacahuete':  'https://images.unsplash.com/photo-1567892737950-30e1ccc84941?w=280&h=280&fit=crop',
  'cajou':      'https://images.unsplash.com/photo-1591113089028-f948e5d0f5db?w=280&h=280&fit=crop',
  'pain':       'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=280&h=280&fit=crop',
  // Hygiène
  'savon':      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=280&h=280&fit=crop',
  'lux':        'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=280&h=280&fit=crop',
  'colgate':    'https://images.unsplash.com/photo-1608613304814-b9d15c9bd1dc?w=280&h=280&fit=crop',
  'dentifrice': 'https://images.unsplash.com/photo-1608613304814-b9d15c9bd1dc?w=280&h=280&fit=crop',
  'rexona':     'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=280&h=280&fit=crop',
  'deodorant':  'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=280&h=280&fit=crop',
  // Tabac
  'cigarette':  'https://images.unsplash.com/photo-1470406852800-b97e5d92e2aa?w=280&h=280&fit=crop',
  'marlboro':   'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=280&h=280&fit=crop',
  'dunhill':    'https://images.unsplash.com/photo-1502920514313-52581002a659?w=280&h=280&fit=crop',
}

function getImg(nom) {
  const n = nom.toLowerCase()
  for (const [k, url] of Object.entries(IMG)) {
    if (n.includes(k)) return url
  }
  return null
}

function getEmoji(nom) {
  const n = nom.toLowerCase()
  if (['castel','flag','heineken','bock','beaufort','beer','ivoire'].some(k=>n.includes(k))) return '🍺'
  if (['sodabi','whisky','rhum','vin'].some(k=>n.includes(k))) return '🥃'
  if (['coca','fanta','malta'].some(k=>n.includes(k))) return '🥤'
  if (n.includes('eau')) return '💧'
  if (n.includes('jus')) return '🍊'
  if (n.includes('caf')) return '☕'
  if (['chips','lay'].some(k=>n.includes(k))) return '🍟'
  if (['biscuit','prince','delice'].some(k=>n.includes(k))) return '🍪'
  if (['cacahuete','cajou'].some(k=>n.includes(k))) return '🥜'
  if (n.includes('pain')) return '🍫'
  if (['savon','lux','colgate','dentifrice'].some(k=>n.includes(k))) return '🧴'
  if (['rexona','deodorant'].some(k=>n.includes(k))) return '🧴'
  if (['cigarette','marlboro','dunhill'].some(k=>n.includes(k))) return '🚬'
  return '📦'
}

// ── Carte article avec vraie photo ─────────────────────────
function ArticleCard({ article, onAdd, selected, size = 'normal' }) {
  const [imgErr, setImgErr] = React.useState(false)
  const url  = getImg(article.nom)
  const catC = { boisson:'#1d4ed8', snack:'#d97706', hygiene:'#16a34a', cigarette:'#6b7280', autre:'#7c3aed' }
  const c    = catC[article.categorie] || '#475569'
  const sm   = size === 'small'

  return (
    <div onClick={() => onAdd(article)}
      style={{ background:'#fff', border:`2px solid ${selected ? c : '#e2e8f0'}`,
        borderRadius: sm ? 10 : 14, overflow:'hidden', cursor:'pointer',
        boxShadow: selected ? `0 0 0 3px ${c}30` : '0 1px 4px rgba(0,0,0,.06)',
        transition:'all .15s', userSelect:'none' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 4px 12px ${c}25` }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow = selected?`0 0 0 3px ${c}30`:'0 1px 4px rgba(0,0,0,.06)' }}>

      {/* Photo */}
      <div style={{ height: sm ? 80 : 120, background: url && !imgErr ? 'transparent' : `${c}10`, position:'relative', overflow:'hidden' }}>
        {url && !imgErr ? (
          <img src={url} alt={article.nom} onError={() => setImgErr(true)}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        ) : (
          <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize: sm ? 28 : 44, background: `linear-gradient(135deg, ${c}15, ${c}05)` }}>
            {getEmoji(article.nom)}
          </div>
        )}
        {/* Badge catégorie */}
        <div style={{ position:'absolute', top:6, left:6, background:c, color:'#fff',
          fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:99, textTransform:'uppercase', letterSpacing:.5 }}>
          {article.categorie}
        </div>
        {/* Badge panier si sélectionné */}
        {selected && (
          <div style={{ position:'absolute', top:6, right:6, background:c, color:'#fff',
            width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:13, fontWeight:900 }}>
            {selected}
          </div>
        )}
      </div>

      {/* Infos */}
      <div style={{ padding: sm ? '8px 10px' : '10px 12px' }}>
        <div style={{ fontWeight:700, fontSize: sm ? 11 : 12.5, color:'#1e293b', lineHeight:1.3, marginBottom:4,
          display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {article.nom}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:900, color:c, fontSize: sm ? 13 : 15 }}>
            {parseInt(article.prix).toLocaleString()}
          </div>
          <div style={{ fontSize:9.5, color:'#94a3b8' }}>FCFA/{article.unite}</div>
        </div>
      </div>
    </div>
  )
}

// ── Catégories ──────────────────────────────────────────────
const CATS = {
  boisson:   { icon:'🍺', label:'Boissons',  color:'#2563eb' },
  snack:     { icon:'🍿', label:'Snacks',     color:'#d97706' },
  hygiene:   { icon:'🧼', label:'Hygiène',    color:'#16a34a' },
  cigarette: { icon:'🚬', label:'Tabac',      color:'#6b7280' },
  autre:     { icon:'📦', label:'Autres',     color:'#7c3aed' },
}

// ════════════════════════════════════════════════════════════
export default function Boutique() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'

  const [articles,   setArticles]   = useState([])
  const [consos,     setConsos]     = useState([])
  const [personnel,  setPersonnel]  = useState([])
  const [statsJour,  setStatsJour]  = useState(null)
  const [loading,    setLoading]    = useState(true)

  const [tab,       setTab]        = useState('caisse')
  const [catFilter, setCatFilter]  = useState('')
  const [search,    setSearch]     = useState('')

  const [agentId,   setAgentId]    = useState('')
  const [agentInfo, setAgentInfo]  = useState(null)
  const [panier,    setPanier]     = useState([])
  const [submitting,setSubmitting] = useState(false)
  const [msg,       setMsg]        = useState(null)

  const [scanning,  setScanning]   = useState(false)
  const scannerRef  = useRef(null)
  const scannerInst = useRef(null)

  const [artModal,  setArtModal]   = useState(false)
  const [artForm,   setArtForm]    = useState({ nom:'', categorie:'boisson', prix:0, stock:100, unite:'pièce' })

  const load = useCallback(() => {
    Promise.all([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({ page_size:100 }),
      boutiqueAPI.statsJour(),
      personnelAPI.list({ page_size:200 }),
    ]).then(([ra, rc, rs, rp]) => {
      setArticles(ra.data.results || ra.data || [])
      setConsos(rc.data.results || rc.data || [])
      setStatsJour(rs.data)
      setPersonnel(rp.data.results || rp.data || [])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!agentId) { setAgentInfo(null); return }
    const p = personnel.find(x =>
      x.qr_code_string === agentId || String(x.id) === agentId || x.login_genere === agentId
    )
    setAgentInfo(p || null)
  }, [agentId, personnel])

  const startScan = async () => {
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr_boutique')
      scannerInst.current = scanner
      await scanner.start(
        { facingMode:'environment' }, { fps:10, qrbox:200 },
        decoded => { setAgentId(decoded); stopScan() }, ()=>{}
      )
    } catch { setScanning(false) }
  }
  const stopScan = () => {
    try { scannerInst.current?.stop().then(()=>{ scannerInst.current=null; setScanning(false) }).catch(()=>setScanning(false)) }
    catch { setScanning(false) }
  }

  const addToPanier = (article) => {
    setMsg(null)
    setPanier(p => {
      const ex = p.find(x=>x.article.id===article.id)
      if (ex) return p.map(x=>x.article.id===article.id ? {...x, quantite:x.quantite+1} : x)
      return [...p, { article, quantite:1 }]
    })
  }
  const removeFromPanier = (articleId) => {
    setPanier(p => {
      const ex = p.find(x=>x.article.id===articleId)
      if (ex && ex.quantite > 1) return p.map(x=>x.article.id===articleId ? {...x, quantite:x.quantite-1} : x)
      return p.filter(x=>x.article.id!==articleId)
    })
  }
  const totalPanier = panier.reduce((s,x) => s + x.article.prix * x.quantite, 0)

  const valider = async () => {
    if (!panier.length) return setMsg({type:'error', text:'Panier vide'})
    setSubmitting(true); setMsg(null)
    try {
      await Promise.all(panier.map(item =>
        boutiqueAPI.addConso({ article: item.article.id, personnel: agentInfo?.id || null, quantite: item.quantite })
      ))
      setMsg({ type:'success', text:`✅ ${totalPanier.toLocaleString()} FCFA — Vente enregistrée !` })
      setPanier([]); setAgentId(''); setAgentInfo(null)
      load()
    } catch(e) { setMsg({ type:'error', text: e.response?.data?.detail || 'Erreur' }) }
    finally { setSubmitting(false) }
  }

  const createArticle = async () => {
    try {
      await boutiqueAPI.createArticle({ ...artForm, prix: Number(artForm.prix), stock: Number(artForm.stock) })
      setArtModal(false)
      setArtForm({ nom:'', categorie:'boisson', prix:0, stock:100, unite:'pièce' })
      load()
    } catch(e) { alert(e.response?.data?.detail || 'Erreur') }
  }

  const artsFiltres = articles.filter(a => {
    const mc = !catFilter || a.categorie === catFilter
    const ms = !search || a.nom.toLowerCase().includes(search.toLowerCase())
    return mc && ms
  })

  const artsByCat = artsFiltres.reduce((acc, a) => {
    if (!acc[a.categorie]) acc[a.categorie] = []
    acc[a.categorie].push(a)
    return acc
  }, {})

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'10px 12px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  return (
    <div style={{ padding:20 }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 style={{ fontSize:21, fontWeight:800, color:'#1e3a8a', margin:0 }}>🛒 Bar & Boutique</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'3px 0 0' }}>
            {loading ? '...' : `${articles.length} articles · ${statsJour?.total || 0} ventes aujourd'hui`}
          </p>
        </div>
        {isAdmin && (
          <button onClick={()=>setArtModal(true)}
            style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'9px 16px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            + Nouvel article
          </button>
        )}
      </div>

      {/* ── STATS BANNER ── */}
      {statsJour && (statsJour.total > 0) && (
        <div style={{ background:'linear-gradient(135deg,#0f2447,#1e3a8a)', borderRadius:14, padding:'14px 20px',
          color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <div style={{ fontFamily:'monospace', fontSize:38, fontWeight:900, lineHeight:1 }}>{statsJour.total}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', marginTop:2 }}>consommations aujourd'hui</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:'#f0a500' }}>
              {(statsJour.montant||0).toLocaleString()} FCFA
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.5)' }}>chiffre du jour</div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display:'flex', gap:0, marginBottom:18, borderBottom:'2px solid #e2e8f0' }}>
        {[['caisse','🛒 Caisse'],['historique','📋 Historique'],['catalogue','📦 Catalogue']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:'9px 20px', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
              background:'transparent', color:tab===k?'#1e3a8a':'#64748b',
              borderBottom:`3px solid ${tab===k?'#1e3a8a':'transparent'}`, marginBottom:-2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══════════ CAISSE ══════════ */}
      {tab === 'caisse' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16 }}>

          {/* Grille articles */}
          <div>
            {/* Filtres */}
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="🔍 Rechercher..."
                style={{ ...inp, maxWidth:180, padding:'7px 12px', fontSize:12, width:'auto' }} />
              {[['','Tous',...Object.entries(CATS).map(([k,v])=>[k,`${v.icon} ${v.label}`])].flat()].map((_, i) => {
                const entries = [['','Tous'], ...Object.entries(CATS).map(([k,v])=>[k,`${v.icon} ${v.label}`])]
                return entries.map(([k,l]) => (
                  <button key={k} onClick={()=>setCatFilter(catFilter===k&&k?'':k)}
                    style={{ padding:'6px 12px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
                      background:catFilter===k&&k?CATS[k]?.color||'#1e3a8a':catFilter===''&&k===''?'#1e3a8a':'#fff',
                      color:(catFilter===k&&k)||(catFilter===''&&k==='')?'#fff':'#475569',
                      borderColor:k&&CATS[k]?CATS[k].color:catFilter===''&&k===''?'#1e3a8a':'#e2e8f0' }}>
                    {l}
                  </button>
                ))
              })[0]}
            </div>

            {/* Articles par catégorie */}
            {loading ? (
              <div style={{ textAlign:'center', padding:40, fontSize:32 }}>⏳</div>
            ) : Object.keys(artsByCat).length === 0 ? (
              <div style={{ textAlign:'center', padding:48, color:'#94a3b8' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🛒</div>
                <div style={{ fontWeight:700, color:'#64748b' }}>Aucun article</div>
                <div style={{ fontSize:12, marginTop:4 }}>Allez dans Diagnostic → Initialiser les données</div>
              </div>
            ) : (
              Object.entries(artsByCat).map(([cat, arts]) => (
                <div key={cat} style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:18 }}>{CATS[cat]?.icon||'📦'}</span>
                    <span style={{ fontWeight:800, fontSize:13, color:CATS[cat]?.color||'#475569', textTransform:'uppercase', letterSpacing:.8 }}>
                      {CATS[cat]?.label||cat}
                    </span>
                    <span style={{ fontSize:11, color:'#94a3b8' }}>({arts.length})</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
                    {arts.map(a => {
                      const inPanier = panier.find(x=>x.article.id===a.id)
                      return (
                        <ArticleCard key={a.id} article={a}
                          onAdd={addToPanier}
                          selected={inPanier?.quantite}
                          size="normal" />
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Panneau droit ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Agent */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'11px 14px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontWeight:700, fontSize:13, color:'#1e3a8a' }}>
                👤 Agent (optionnel)
              </div>
              <div style={{ padding:12 }}>
                <button onClick={scanning ? stopScan : startScan}
                  style={{ width:'100%', background:scanning?'#dc2626':'#0f2447', color:'#fff', border:'none', padding:10, borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:700, marginBottom:8 }}>
                  {scanning ? '⏹ Arrêter' : '📷 Scanner QR Agent'}
                </button>
                {scanning && <div id="qr_boutique" style={{ borderRadius:8, overflow:'hidden', marginBottom:8 }} />}
                <div style={{ display:'flex', gap:6 }}>
                  <input value={agentId} onChange={e=>setAgentId(e.target.value)}
                    placeholder="QR, login ou ID..."
                    style={{ ...inp, fontSize:12, padding:'7px 10px' }} />
                  <button onClick={()=>{setAgentId('');setAgentInfo(null)}}
                    style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, padding:'7px 10px', cursor:'pointer' }}>✕</button>
                </div>
                {agentInfo && (
                  <div style={{ marginTop:8, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'8px 12px', display:'flex', gap:10, alignItems:'center' }}>
                    <span style={{ fontSize:22 }}>✅</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:'#166534' }}>{agentInfo.nom} {agentInfo.prenom}</div>
                      <div style={{ fontSize:11, color:'#16a34a' }}>{agentInfo.societe}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panier */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden', flex:1 }}>
              <div style={{ padding:'11px 14px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'#1e3a8a' }}>🛒 Panier ({panier.length})</span>
                {panier.length > 0 && (
                  <button onClick={()=>setPanier([])} style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:600 }}>Vider</button>
                )}
              </div>
              <div style={{ padding:12 }}>
                {panier.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12, padding:'20px 0' }}>
                    Cliquez sur un article
                  </div>
                ) : (
                  <>
                    <div style={{ maxHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                      {panier.map(item => (
                        <div key={item.article.id} style={{ display:'flex', alignItems:'center', gap:8, background:'#f8fafc', borderRadius:8, padding:'6px 10px' }}>
                          {/* Mini photo */}
                          <div style={{ width:36, height:36, borderRadius:7, overflow:'hidden', flexShrink:0 }}>
                            {getImg(item.article.nom) ? (
                              <img src={getImg(item.article.nom)} alt={item.article.nom}
                                style={{ width:'100%', height:'100%', objectFit:'cover' }}
                                onError={e=>{ e.target.style.display='none' }} />
                            ) : (
                              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, background:'#f1f5f9' }}>
                                {getEmoji(item.article.nom)}
                              </div>
                            )}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.article.nom}</div>
                            <div style={{ fontSize:10, color:'#94a3b8' }}>{parseInt(item.article.prix).toLocaleString()} × {item.quantite}</div>
                          </div>
                          <div style={{ fontWeight:800, fontSize:12, color:'#1e3a8a', flexShrink:0 }}>
                            {(item.article.prix*item.quantite).toLocaleString()}
                          </div>
                          <div style={{ display:'flex', gap:2 }}>
                            <button onClick={()=>removeFromPanier(item.article.id)}
                              style={{ width:20,height:20,borderRadius:5,border:'1px solid #e2e8f0',background:'#fff',cursor:'pointer',fontSize:12,fontWeight:700 }}>-</button>
                            <button onClick={()=>addToPanier(item.article)}
                              style={{ width:20,height:20,borderRadius:5,border:'none',background:'#1e3a8a',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:700 }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div style={{ background:'linear-gradient(135deg,#0f2447,#1e3a8a)', borderRadius:10, padding:'11px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:600 }}>TOTAL</span>
                      <span style={{ fontFamily:'monospace', fontSize:20, fontWeight:900, color:'#f0a500' }}>
                        {totalPanier.toLocaleString()} FCFA
                      </span>
                    </div>

                    {msg && (
                      <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, fontSize:12, fontWeight:600,
                        background:msg.type==='success'?'#f0fdf4':'#fef2f2',
                        color:msg.type==='success'?'#166534':'#991b1b',
                        border:`1px solid ${msg.type==='success'?'#bbf7d0':'#fecaca'}` }}>
                        {msg.text}
                      </div>
                    )}

                    <button onClick={valider} disabled={submitting}
                      style={{ width:'100%', background:submitting?'#94a3b8':'#16a34a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:submitting?'wait':'pointer', fontSize:14, fontWeight:700 }}>
                      {submitting ? '⏳...' : '✅ Valider la vente'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ HISTORIQUE ══════════ */}
      {tab === 'historique' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
          {consos.length === 0 ? (
            <div style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>📋</div>
              <div style={{ fontWeight:700, color:'#64748b' }}>Aucune vente aujourd'hui</div>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
                <thead>
                  <tr style={{ background:'linear-gradient(135deg,#0f2447,#1e3a8a)' }}>
                    {['Heure','Agent','Article','Qté','Montant','Vendeur'].map(h=>(
                      <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, textTransform:'uppercase', color:'rgba(255,255,255,.85)', letterSpacing:.8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consos.map((c,i) => (
                    <tr key={c.id} style={{ borderTop:'1px solid #f1f5f9', background:i%2?'#fafafa':'#fff' }}>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>
                        {new Date(c.date_conso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600 }}>{c.personnel_nom||'Anonyme'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12 }}>
                        <span style={{ marginRight:6 }}>{getEmoji(c.article_nom||'')}</span>{c.article_nom}
                      </td>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', textAlign:'center' }}>{c.quantite}</td>
                      <td style={{ padding:'10px 14px', fontWeight:800, color:'#1e3a8a' }}>{parseInt(c.montant||0).toLocaleString()} FCFA</td>
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#94a3b8' }}>{c.valide_par_nom||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════ CATALOGUE ══════════ */}
      {tab === 'catalogue' && (
        <div>
          {Object.entries(CATS).map(([cat, cfg]) => {
            const arts = articles.filter(a=>a.categorie===cat)
            if (!arts.length) return null
            return (
              <div key={cat} style={{ marginBottom:28 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:`${cfg.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{cfg.icon}</div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16, color:cfg.color }}>{cfg.label}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{arts.length} articles</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12 }}>
                  {arts.map(a => (
                    <ArticleCard key={a.id} article={a} onAdd={()=>{setTab('caisse');addToPanier(a)}}
                      selected={panier.find(x=>x.article.id===a.id)?.quantite} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════ MODAL CRÉER ARTICLE ══════════ */}
      {artModal && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setArtModal(false)}>
          <div style={{ background:'#fff',borderRadius:18,width:'100%',maxWidth:400,overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontWeight:700,fontSize:15 }}>+ Nouvel article</span>
              <button onClick={()=>setArtModal(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:12 }}>
              {[['Nom *','nom','text'],['Prix FCFA *','prix','number'],['Stock','stock','number'],['Unité','unite','text']].map(([l,f,t])=>(
                <div key={f}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase' }}>{l}</label>
                  <input type={t} value={artForm[f]||''} onChange={e=>setArtForm({...artForm,[f]:e.target.value})} style={inp}/>
                </div>
              ))}
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase' }}>Catégorie</label>
                <select value={artForm.categorie} onChange={e=>setArtForm({...artForm,categorie:e.target.value})} style={inp}>
                  {Object.entries(CATS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setArtModal(false)} style={{ flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontFamily:'inherit' }}>Annuler</button>
                <button onClick={createArticle} style={{ flex:2,background:'#1e3a8a',color:'#fff',border:'none',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit' }}>✅ Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
