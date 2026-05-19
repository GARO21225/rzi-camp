/**
 * BAR & BOUTIQUE — Fonctionnement identique à la Restauration
 * Scanner QR → Sélectionner articles → Valider consommation
 * Stats du jour · Historique · Catalogue avec vraies photos
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

// ── Configuration catégories avec emojis CI ───────────────────
const CATS = {
  boisson:   { icon:'🍺', label:'Boissons',   color:'#2563eb', bg:'#dbeafe' },
  snack:     { icon:'🍿', label:'Snacks',      color:'#d97706', bg:'#fef3c7' },
  hygiene:   { icon:'🧼', label:'Hygiène',     color:'#16a34a', bg:'#dcfce7' },
  cigarette: { icon:'🚬', label:'Tabac',       color:'#6b7280', bg:'#f3f4f6' },
  autre:     { icon:'📦', label:'Autres',      color:'#7c3aed', bg:'#ede9fe' },
}

// Sous-catégories des boissons pour l'affichage
const SOUS_CATS = {
  biere:       { icon:'🍺', label:'Bières',      keywords:['castel','flag','heineken','bock','beaufort','ivoire beer'] },
  spiritueux:  { icon:'🥃', label:'Spiritueux',  keywords:['sodabi','whisky','rhum','vin'] },
  soft:        { icon:'🥤', label:'Softs & Eau', keywords:['coca','fanta','malta','eau','jus','café'] },
}

function getArticleEmoji(nom) {
  const n = nom.toLowerCase()
  if (n.includes('castel')||n.includes('flag')||n.includes('heineken')||n.includes('bock')||n.includes('beaufort')||n.includes('beer')) return '🍺'
  if (n.includes('sodabi')||n.includes('whisky')||n.includes('rhum')) return '🥃'
  if (n.includes('vin')) return '🍷'
  if (n.includes('coca')||n.includes('fanta')||n.includes('malta')) return '🥤'
  if (n.includes('eau')) return '💧'
  if (n.includes('jus')) return '🍊'
  if (n.includes('café')||n.includes('cafe')) return '☕'
  if (n.includes('chips')) return '🍟'
  if (n.includes('biscuit')||n.includes('delices')||n.includes('prince')) return '🍪'
  if (n.includes('cacahuete')||n.includes('noix')) return '🥜'
  if (n.includes('pain')) return '🍫'
  if (n.includes('savon')||n.includes('dentifrice')||n.includes('deodorant')) return '🧴'
  if (n.includes('cigarette')||n.includes('marlboro')||n.includes('dunhill')) return '🚬'
  return '📦'
}

// ════════════════════════════════════════════════════════════════
export default function Boutique() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'
  const isResto = user?.profile?.role === 'restauration' || isAdmin

  // Data
  const [articles,   setArticles]   = useState([])
  const [consos,     setConsos]     = useState([])
  const [personnel,  setPersonnel]  = useState([])
  const [statsJour,  setStatsJour]  = useState(null)
  const [loading,    setLoading]    = useState(true)

  // UI
  const [tab,        setTab]        = useState('caisse')
  const [catFilter,  setCatFilter]  = useState('')
  const [searchArt,  setSearchArt]  = useState('')

  // Caisse
  const [agentId,    setAgentId]    = useState('')
  const [agentInfo,  setAgentInfo]  = useState(null)
  const [panier,     setPanier]     = useState([])  // [{article, quantite}]
  const [submitting, setSubmitting] = useState(false)
  const [msg,        setMsg]        = useState(null)

  // Scanner QR
  const [scanning,   setScanning]   = useState(false)
  const scannerRef   = useRef(null)
  const scannerInst  = useRef(null)

  // Gestion articles (admin)
  const [artModal,   setArtModal]   = useState(false)
  const [artForm,    setArtForm]    = useState({ nom:'', categorie:'boisson', prix:0, stock:100, unite:'pièce' })

  const load = useCallback(() => {
    Promise.all([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({ page_size:100 }),
      boutiqueAPI.statsJour(),
      personnelAPI.list({ page_size:200 }),
    ]).then(([ra,rc,rs,rp]) => {
      setArticles(ra.data.results || ra.data || [])
      setConsos(rc.data.results || rc.data || [])
      setStatsJour(rs.data)
      setPersonnel(rp.data.results || rp.data || [])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(()=>{ load() },[load])

  // Rechercher agent par ID (après scan QR ou saisie)
  useEffect(() => {
    if (!agentId) { setAgentInfo(null); return }
    const p = personnel.find(x =>
      x.qr_code_string === agentId ||
      String(x.id) === agentId ||
      x.login_genere === agentId
    )
    setAgentInfo(p || null)
  }, [agentId, personnel])

  // Scanner QR
  const startScan = async () => {
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr_boutique')
      scannerInst.current = scanner
      await scanner.start(
        { facingMode:'environment' },
        { fps:10, qrbox:220 },
        (decoded) => {
          setAgentId(decoded)
          stopScan()
        },
        () => {}
      )
    } catch(e) { setScanning(false) }
  }
  const stopScan = () => {
    try { scannerInst.current?.stop().then(()=>{ scannerInst.current=null; setScanning(false) }).catch(()=>setScanning(false)) }
    catch { setScanning(false) }
  }

  // Panier
  const addToPanier = (article) => {
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
  const totalPanier = panier.reduce((sum, x) => sum + x.article.prix * x.quantite, 0)

  const valider = async () => {
    if (panier.length === 0) return setMsg({type:'error', text:'Panier vide'})
    setSubmitting(true); setMsg(null)
    try {
      // Valider chaque article du panier
      await Promise.all(panier.map(item =>
        boutiqueAPI.addConso({
          article:   item.article.id,
          personnel: agentId ? (agentInfo?.id || null) : null,
          quantite:  item.quantite,
        })
      ))
      const total = totalPanier
      setMsg({ type:'success', text:`✅ Consommation validée — ${total.toLocaleString()} FCFA` })
      setPanier([])
      setAgentId('')
      setAgentInfo(null)
      load()
    } catch(e) {
      setMsg({ type:'error', text: e.response?.data?.detail || 'Erreur lors de la validation' })
    } finally { setSubmitting(false) }
  }

  const createArticle = async () => {
    try {
      await boutiqueAPI.createArticle({ ...artForm, prix: Number(artForm.prix), stock: Number(artForm.stock) })
      setArtModal(false)
      setArtForm({ nom:'', categorie:'boisson', prix:0, stock:100, unite:'pièce' })
      load()
    } catch(e) { alert(e.response?.data?.detail || 'Erreur') }
  }

  // Articles filtrés pour la caisse
  const artsFiltres = articles.filter(a => {
    const matchCat = !catFilter || a.categorie === catFilter
    const matchSearch = !searchArt || a.nom.toLowerCase().includes(searchArt.toLowerCase())
    return matchCat && matchSearch
  })

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'10px 12px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  // Grouper articles par catégorie pour la caisse
  const artsByCat = artsFiltres.reduce((acc, a) => {
    const c = a.categorie
    if (!acc[c]) acc[c] = []
    acc[c].push(a)
    return acc
  }, {})

  return (
    <div style={{ padding:20 }}>

      {/* ── HEADER ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:21, fontWeight:800, color:'#1e3a8a', margin:0 }}>🛒 Bar & Boutique</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>
            {articles.length} articles · Consommations du jour
          </p>
        </div>
        {isAdmin && (
          <button onClick={()=>setArtModal(true)}
            style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'9px 18px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            + Nouvel article
          </button>
        )}
      </div>

      {/* ── STATS DU JOUR ── */}
      {statsJour && (
        <div style={{ marginBottom:16 }}>
          <div style={{ background:'linear-gradient(135deg, #1e3a8a, #2563eb)', borderRadius:16, padding:'16px 22px', color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>📅 Aujourd'hui</div>
              <div style={{ fontFamily:'monospace', fontSize:46, fontWeight:900, lineHeight:1 }}>{statsJour.total || 0}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:3 }}>consommations validées</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.55)', marginBottom:4 }}>Chiffre du jour</div>
              <div style={{ fontFamily:'monospace', fontSize:28, fontWeight:900, color:'#f0a500' }}>
                {(statsJour.montant || 0).toLocaleString()} FCFA
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{ display:'flex', gap:6, marginBottom:16, borderBottom:'2px solid #e2e8f0', paddingBottom:0 }}>
        {[['caisse','🛒 Caisse'],['historique','📋 Historique'],['catalogue','📦 Catalogue']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:'9px 18px', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit',
              background:'transparent', borderBottom:`3px solid ${tab===k?'#1e3a8a':'transparent'}`,
              color: tab===k ? '#1e3a8a' : '#64748b', marginBottom:-2, transition:'.15s' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          ONGLET CAISSE
      ════════════════════════════════════════ */}
      {tab === 'caisse' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>

          {/* ── Grille articles ── */}
          <div>
            {/* Filtres */}
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
              <input value={searchArt} onChange={e=>setSearchArt(e.target.value)}
                placeholder="🔍 Rechercher un article..."
                style={{ ...inp, maxWidth:220, padding:'7px 12px', fontSize:12, width:'auto' }} />
              <button onClick={()=>setCatFilter('')}
                style={{ padding:'6px 12px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
                  background:!catFilter?'#1e3a8a':'#fff', color:!catFilter?'#fff':'#475569', borderColor:!catFilter?'#1e3a8a':'#e2e8f0' }}>
                Tous
              </button>
              {Object.entries(CATS).map(([k,v]) => (
                <button key={k} onClick={()=>setCatFilter(catFilter===k?'':k)}
                  style={{ padding:'6px 12px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit',
                    background:catFilter===k?v.color:'#fff', color:catFilter===k?'#fff':v.color, borderColor:catFilter===k?v.color:v.color+'50' }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>

            {/* Articles par catégorie */}
            {loading ? (
              <div style={{ textAlign:'center', padding:40, fontSize:32 }}>⏳</div>
            ) : (
              Object.entries(artsByCat).map(([cat, arts]) => (
                <div key={cat} style={{ marginBottom:18 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:(CATS[cat]||CATS.autre).color, textTransform:'uppercase', letterSpacing:1, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:16 }}>{(CATS[cat]||CATS.autre).icon}</span>
                    {(CATS[cat]||CATS.autre).label}
                    <span style={{ fontSize:10, color:'#94a3b8', fontWeight:400 }}>({arts.length} articles)</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
                    {arts.map(a => {
                      const inPanier = panier.find(x=>x.article.id===a.id)
                      const catCfg = CATS[a.categorie] || CATS.autre
                      return (
                        <div key={a.id} onClick={() => addToPanier(a)}
                          style={{ background:'#fff', border:`2px solid ${inPanier?catCfg.color:'#e2e8f0'}`,
                            borderRadius:12, padding:12, cursor:'pointer', transition:'all .15s', textAlign:'center',
                            boxShadow: inPanier?`0 0 0 3px ${catCfg.color}25`:'var(--s-xs)' }}
                          onMouseEnter={e=>!inPanier&&(e.currentTarget.style.borderColor=catCfg.color+'80')}
                          onMouseLeave={e=>!inPanier&&(e.currentTarget.style.borderColor='#e2e8f0')}>
                          <div style={{ fontSize:32, marginBottom:6, lineHeight:1 }}>{getArticleEmoji(a.nom)}</div>
                          <div style={{ fontSize:11, fontWeight:700, color:'#1e293b', lineHeight:1.3, marginBottom:4 }}>{a.nom}</div>
                          <div style={{ fontSize:12, fontWeight:900, color:catCfg.color }}>{parseInt(a.prix).toLocaleString()}</div>
                          <div style={{ fontSize:9, color:'#94a3b8' }}>FCFA / {a.unite}</div>
                          {inPanier && (
                            <div style={{ marginTop:6, background:catCfg.color, color:'#fff', borderRadius:20, fontSize:11, fontWeight:700, padding:'2px 8px' }}>
                              × {inPanier.quantite}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Panneau droit: Agent + Panier ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Identifier l'agent */}
            <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', fontWeight:700, fontSize:13, color:'#1e3a8a' }}>
                👤 Agent (optionnel)
              </div>
              <div style={{ padding:14 }}>
                {/* Scanner QR */}
                <button onClick={scanning ? stopScan : startScan}
                  style={{ width:'100%', background:scanning?'#dc2626':'#0f2447', color:'#fff', border:'none', padding:'10px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700, marginBottom:10 }}>
                  {scanning ? '⏹ Arrêter le scan' : '📷 Scanner QR Agent'}
                </button>

                {scanning && (
                  <div style={{ marginBottom:10, borderRadius:10, overflow:'hidden', background:'#000' }}>
                    <div id="qr_boutique" style={{ width:'100%' }} />
                  </div>
                )}

                <div style={{ display:'flex', gap:6 }}>
                  <input value={agentId} onChange={e=>{setAgentId(e.target.value)}}
                    placeholder="QR, login ou ID..."
                    style={{ ...inp, fontSize:12, padding:'8px 10px' }} />
                  <button onClick={()=>{setAgentId('');setAgentInfo(null)}}
                    style={{ background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 10px', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>

                {agentInfo && (
                  <div style={{ marginTop:8, background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:24 }}>👤</span>
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
              <div style={{ padding:'12px 16px', background:'#f8fafc', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:700, fontSize:13, color:'#1e3a8a' }}>🛒 Panier ({panier.length})</span>
                {panier.length > 0 && (
                  <button onClick={()=>setPanier([])}
                    style={{ background:'none', border:'none', color:'#dc2626', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                    Vider
                  </button>
                )}
              </div>
              <div style={{ padding:12 }}>
                {panier.length === 0 ? (
                  <div style={{ textAlign:'center', color:'#94a3b8', fontSize:12, padding:'20px 0' }}>
                    Cliquez sur un article pour l'ajouter
                  </div>
                ) : (
                  <>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12, maxHeight:250, overflowY:'auto' }}>
                      {panier.map(item => (
                        <div key={item.article.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'#f8fafc', borderRadius:8 }}>
                          <span style={{ fontSize:18 }}>{getArticleEmoji(item.article.nom)}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.article.nom}</div>
                            <div style={{ fontSize:10, color:'#94a3b8' }}>{parseInt(item.article.prix).toLocaleString()} × {item.quantite}</div>
                          </div>
                          <div style={{ fontWeight:800, fontSize:12, color:'#1e3a8a', flexShrink:0 }}>
                            {(item.article.prix * item.quantite).toLocaleString()}
                          </div>
                          <div style={{ display:'flex', gap:3 }}>
                            <button onClick={()=>removeFromPanier(item.article.id)}
                              style={{ width:20, height:20, borderRadius:5, border:'1px solid #e2e8f0', background:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>-</button>
                            <button onClick={()=>addToPanier(item.article)}
                              style={{ width:20, height:20, borderRadius:5, border:'none', background:'#1e3a8a', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)', borderRadius:10, padding:'12px 14px', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ color:'rgba(255,255,255,.75)', fontSize:12, fontWeight:600 }}>TOTAL</span>
                      <span style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:'#f0a500' }}>
                        {totalPanier.toLocaleString()} FCFA
                      </span>
                    </div>

                    {msg && (
                      <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:10, fontSize:12, fontWeight:600,
                        background: msg.type==='success'?'#f0fdf4':'#fef2f2',
                        color:      msg.type==='success'?'#166534':'#991b1b',
                        border:     `1px solid ${msg.type==='success'?'#bbf7d0':'#fecaca'}` }}>
                        {msg.text}
                      </div>
                    )}

                    <button onClick={valider} disabled={submitting}
                      style={{ width:'100%', background:submitting?'#94a3b8':'#16a34a', color:'#fff', border:'none', padding:'13px', borderRadius:10, cursor:submitting?'wait':'pointer', fontSize:14, fontWeight:700 }}>
                      {submitting ? '⏳ Validation...' : '✅ Valider la vente'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ONGLET HISTORIQUE
      ════════════════════════════════════════ */}
      {tab === 'historique' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            {consos.length === 0 ? (
              <div style={{ padding:48, textAlign:'center', color:'#94a3b8' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🛒</div>
                <div style={{ fontWeight:700, color:'#64748b' }}>Aucune consommation aujourd'hui</div>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
                <thead>
                  <tr style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)' }}>
                    {['Heure','Agent','Article','Qté','Montant','Validé par'].map(h=>(
                      <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'rgba(255,255,255,.85)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consos.map((c,i)=>(
                    <tr key={c.id} style={{ borderTop:'1px solid #f1f5f9', background:i%2?'#fafafa':'#fff' }}>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>
                        {new Date(c.date_conso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600 }}>{c.personnel_nom||'Anonyme'}</td>
                      <td style={{ padding:'10px 14px', fontSize:12 }}>
                        <span style={{ marginRight:6 }}>{getArticleEmoji(c.article_nom||'')}</span>
                        {c.article_nom}
                      </td>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, textAlign:'center' }}>{c.quantite}</td>
                      <td style={{ padding:'10px 14px', fontWeight:800, color:'#1e3a8a' }}>{parseInt(c.montant||0).toLocaleString()} FCFA</td>
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#94a3b8' }}>{c.valide_par_nom||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ONGLET CATALOGUE
      ════════════════════════════════════════ */}
      {tab === 'catalogue' && (
        <div>
          {Object.entries(CATS).map(([cat, catCfg]) => {
            const arts = articles.filter(a => a.categorie === cat)
            if (arts.length === 0) return null
            return (
              <div key={cat} style={{ marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:catCfg.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                    {catCfg.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, color:catCfg.color }}>{catCfg.label}</div>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>{arts.length} articles disponibles</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
                  {arts.map(a => (
                    <div key={a.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)', textAlign:'center' }}>
                      <div style={{ fontSize:40, marginBottom:8 }}>{getArticleEmoji(a.nom)}</div>
                      <div style={{ fontWeight:700, fontSize:13, color:'#1e293b', marginBottom:4, lineHeight:1.3 }}>{a.nom}</div>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:8 }}>{a.unite}</div>
                      <div style={{ fontWeight:900, color:catCfg.color, fontSize:16 }}>{parseInt(a.prix).toLocaleString()} FCFA</div>
                      {isAdmin && (
                        <div style={{ marginTop:6, fontSize:10, color:'#94a3b8' }}>Stock: {a.stock}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ═══ MODAL CRÉER ARTICLE ═══ */}
      {artModal && isAdmin && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setArtModal(false)}>
          <div style={{ background:'#fff',borderRadius:18,width:'100%',maxWidth:420,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)' }}>
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
                <button onClick={createArticle} style={{ flex:2,background:'#1e3a8a',color:'#fff',border:'none',padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit' }}>
                  ✅ Créer l'article
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
