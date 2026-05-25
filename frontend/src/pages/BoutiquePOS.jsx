/**
 * Boutique POS Mobile — Système caisse inspiré supermarché
 * Design: scan QR + sélection tactile + panier bas
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'

// ── Détection mobile ──────────────────────────────────────
const isMobile = () => window.innerWidth < 768

// ── Helpers ────────────────────────────────────────────────
const CAT_COLORS = {
  gazeuse:'#ef4444',jus:'#f97316',energie:'#eab308',eau:'#0ea5e9',
  biere:'#d97706',vin_rouge:'#be123c',vin_blanc:'#ca8a04',vin_rose:'#ec4899',
  champagne:'#a16207',spiritueux:'#7c3aed',liqueur:'#6d28d9',
  cafe:'#92400e',the:'#15803d',autre:'#64748b'
}

export default function BoutiquePOS() {
  const navigate = useNavigate()
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser || user?.username === 'admin')
  const mobile = isMobile()

  // Data
  const [articles,  setArticles]  = useState([])
  const [consos,    setConsos]    = useState([])
  const [personnel, setPersonnel] = useState([])
  const [loading,   setLoading]   = useState(true)

  // POS State
  const [panier,    setPanier]    = useState([])
  const [agentId,   setAgentId]   = useState('')
  const [agentInfo, setAgentInfo] = useState(null)
  const [bonAgent,  setBonAgent]  = useState(null)
  const [catFilter, setCatFilter] = useState('')
  const [search,    setSearch]    = useState('')
  const [scanning,  setScanning]  = useState(false)
  const [msg,       setMsg]       = useState(null)
  const [submitting,setSubmitting]= useState(false)
  
  // Mobile: afficher panier ou produits
  const [showCart,  setShowCart]  = useState(false)
  
  // Onglets desktop
  const [tab,       setTab]       = useState('caisse')
  
  const scannerRef = useRef(null)

  const load = useCallback(() => {
    Promise.all([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({page_size:50}),
      personnelAPI.list({page_size:200}),
    ]).then(([ra,rc,rp]) => {
      setArticles(ra.data.results||ra.data||[])
      setConsos(rc.data.results||rc.data||[])
      setPersonnel(rp.data.results||rp.data||[])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(()=>{ load() },[load])

  useEffect(() => {
    if (!agentId) { setAgentInfo(null); setBonAgent(null); return }
    const p = personnel.find(x => 
      x.qr_code_string===agentId || String(x.id)===agentId || x.login_genere===agentId
    ) || null
    setAgentInfo(p)
    if (p) {
      boutiqueAPI.soldePersonnel(p.id).then(r=>setBonAgent(r.data)).catch(()=>setBonAgent(null))
    }
  },[agentId,personnel])

  // QR Scanner
  const startScan = async () => {
    setScanning(true)
    try {
      const {Html5Qrcode} = await import('html5-qrcode')
      const sc = new Html5Qrcode('qr_pos')
      scannerRef.current = sc
      await sc.start({facingMode:'environment'},{fps:10,qrbox:200},
        (text) => {
          setAgentId(text); setScanning(false)
          sc.stop().catch(()=>{})
        }, ()=>{})
    } catch(e) { setScanning(false); alert('Caméra non disponible') }
  }

  const stopScan = () => {
    setScanning(false)
    if (scannerRef.current) {
      scannerRef.current.stop().catch(()=>{})
      scannerRef.current = null
    }
  }

  // Panier
  const addTo = (art) => {
    setPanier(prev => {
      const ex = prev.find(x=>x.id===art.id)
      if (ex) return prev.map(x=>x.id===art.id?{...x,qte:x.qte+1}:x)
      return [...prev, {...art, qte:1}]
    })
    if (mobile) setShowCart(false) // rester sur les produits
  }

  const removeFrom = (artId) => {
    setPanier(prev => {
      const ex = prev.find(x=>x.id===artId)
      if (!ex) return prev
      if (ex.qte <= 1) return prev.filter(x=>x.id!==artId)
      return prev.map(x=>x.id===artId?{...x,qte:x.qte-1}:x)
    })
  }

  const total = panier.reduce((s,x)=>s+parseInt(x.prix)*x.qte,0)
  const nbItems = panier.reduce((s,x)=>s+x.qte,0)

  const valider = async () => {
    if (panier.length===0) return
    setSubmitting(true)
    try {
      for (const item of panier) {
        await boutiqueAPI.addConso({
          article: item.id,
          quantite: item.qte,
          personnel: agentInfo?.id || null,
          montant: parseInt(item.prix)*item.qte,
        })
      }
      setMsg({type:'success', text:`✅ ${total.toLocaleString()} FCFA encaissés !`})
      setPanier([]); setAgentId(''); setAgentInfo(null); setBonAgent(null)
      setShowCart(false)
      load()
      setTimeout(()=>setMsg(null), 3000)
    } catch(e) {
      setMsg({type:'error', text:'Erreur lors de la vente'})
    } finally { setSubmitting(false) }
  }

  // Filtrage articles
  const filtered = articles.filter(a => {
    if (!a.actif) return false
    if (catFilter && a.categorie !== catFilter) return false
    if (search && !a.nom.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const cats = [...new Set(articles.filter(a=>a.actif).map(a=>a.categorie))]
  
  // ─────────────────────────────────────────────────────────
  // RENDER MOBILE POS
  // ─────────────────────────────────────────────────────────
  if (mobile) return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#f1f5f9',
      overflow:'hidden',position:'fixed',inset:0}}>

      {/* Header mobile */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',
        padding:'10px 14px',display:'flex',alignItems:'center',
        justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontWeight:800,fontSize:16}}>🛒 Caisse</div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {agentInfo && (
            <div style={{background:'rgba(255,255,255,.15)',borderRadius:99,
              padding:'3px 10px',fontSize:11,fontWeight:700}}>
              {agentInfo.prenom} · {bonAgent ? `${parseInt(bonAgent.credit_restant).toLocaleString()} FCFA` : ''}
            </div>
          )}
          <button onClick={()=>navigate('/boutique-admin')}
            style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',
              padding:'5px 10px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:700}}>
            ⚙️
          </button>
        </div>
      </div>

      {/* Agent bar */}
      <div style={{background:'#fff',padding:'8px 12px',borderBottom:'1px solid #e2e8f0',
        display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
        {scanning ? (
          <div style={{flex:1}}>
            <div id="qr_pos" style={{height:120}}/>
            <button onClick={stopScan} style={{width:'100%',marginTop:6,background:'#fef2f2',
              color:'#dc2626',border:'1px solid #fca5a5',padding:7,borderRadius:9,
              cursor:'pointer',fontWeight:700,fontSize:12}}>
              ✕ Arrêter
            </button>
          </div>
        ) : (
          <>
            <input value={agentId} onChange={e=>setAgentId(e.target.value)}
              placeholder="Login ou ID agent..."
              style={{flex:1,border:'1px solid #e2e8f0',borderRadius:9,padding:'8px 10px',
                fontSize:13,outline:'none'}}/>
            <button onClick={startScan}
              style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'8px 12px',
                borderRadius:9,cursor:'pointer',fontSize:16}}>
              📷
            </button>
            {agentId && (
              <button onClick={()=>{setAgentId('');setAgentInfo(null)}}
                style={{background:'#f8fafc',border:'1px solid #e2e8f0',padding:'8px 10px',
                  borderRadius:9,cursor:'pointer',fontSize:13}}>
                ✕
              </button>
            )}
          </>
        )}
      </div>

      {/* Catégories scrollable */}
      <div style={{display:'flex',gap:8,padding:'8px 12px',overflowX:'auto',
        background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0,
        scrollbarWidth:'none'}}>
        <button onClick={()=>setCatFilter('')}
          style={{background:!catFilter?'#1e3a8a':'#f8fafc',color:!catFilter?'#fff':'#64748b',
            border:'none',padding:'6px 14px',borderRadius:99,cursor:'pointer',
            fontSize:12,fontWeight:700,whiteSpace:'nowrap',flexShrink:0}}>
          Tout
        </button>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCatFilter(c===catFilter?''  :c)}
            style={{background:catFilter===c?(CAT_COLORS[c]||'#1e3a8a'):'#f8fafc',
              color:catFilter===c?'#fff':'#64748b',border:'none',padding:'6px 14px',
              borderRadius:99,cursor:'pointer',fontSize:12,fontWeight:700,
              whiteSpace:'nowrap',flexShrink:0}}>
            {c}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{padding:'8px 12px',background:'#f8fafc',flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher un article..."
          style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:99,
            padding:'8px 14px',fontSize:13,outline:'none',background:'#fff',
            boxSizing:'border-box'}}/>
      </div>

      {/* Grille articles — scrollable */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 12px',
        paddingBottom: nbItems>0 ? 90 : 12}}>
        {loading ? (
          <div style={{textAlign:'center',padding:40,fontSize:32}}>⏳</div>
        ) : filtered.length===0 ? (
          <div style={{textAlign:'center',padding:30,color:'#94a3b8'}}>
            Aucun article
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
            {filtered.map(a => {
              const inCart = panier.find(x=>x.id===a.id)
              const col = CAT_COLORS[a.categorie]||'#64748b'
              return (
                <button key={a.id} onClick={()=>addTo(a)}
                  style={{background:'#fff',border:`2px solid ${inCart?col:'#e2e8f0'}`,
                    borderRadius:14,padding:12,cursor:'pointer',textAlign:'left',
                    boxShadow:inCart?`0 0 0 2px ${col}30`:`0 1px 4px rgba(0,0,0,.06)`,
                    transition:'all .15s',position:'relative',fontFamily:'inherit'}}>
                  {inCart && (
                    <div style={{position:'absolute',top:-6,right:-6,background:col,
                      color:'#fff',borderRadius:'50%',width:22,height:22,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      fontSize:11,fontWeight:900}}>
                      {inCart.qte}
                    </div>
                  )}
                  {a.image_url ? (
                    <img src={a.image_url.startsWith('data:') ? a.image_url : a.image_url}
                      alt={a.nom}
                      style={{width:'100%',height:80,objectFit:'contain',borderRadius:8,
                        marginBottom:8}}
                      onError={e=>{e.target.style.display='none'}}/>
                  ) : (
                    <div style={{width:'100%',height:60,display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:32,marginBottom:6}}>
                      🛒
                    </div>
                  )}
                  <div style={{fontWeight:700,fontSize:12,color:'#1e293b',marginBottom:2,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {a.nom}
                  </div>
                  <div style={{fontWeight:900,color:col,fontSize:14,fontFamily:'monospace'}}>
                    {parseInt(a.prix).toLocaleString()}
                    <span style={{fontSize:9,fontFamily:'inherit',color:'#94a3b8'}}> FCFA</span>
                  </div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>
                    Stock: {a.stock} · {a.unite}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Panier flottant bas */}
      {nbItems > 0 && (
        <div style={{position:'fixed',bottom:0,left:0,right:0,
          background:'linear-gradient(135deg,#0f2447,#1e3a8a)',
          padding:'12px 16px',zIndex:200,boxShadow:'0 -4px 20px rgba(0,0,0,.2)'}}>
          
          {/* Liste articles si expanded */}
          {showCart && (
            <div style={{maxHeight:200,overflowY:'auto',marginBottom:10}}>
              {panier.map(item=>(
                <div key={item.id} style={{display:'flex',justifyContent:'space-between',
                  alignItems:'center',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,.1)'}}>
                  <div style={{color:'#fff',fontSize:13,flex:1}}>
                    {item.nom}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <button onClick={()=>removeFrom(item.id)}
                      style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',
                        width:28,height:28,borderRadius:'50%',cursor:'pointer',fontSize:16}}>
                      −
                    </button>
                    <span style={{color:'#f0a500',fontWeight:700,minWidth:20,textAlign:'center'}}>
                      {item.qte}
                    </span>
                    <button onClick={()=>addTo(item)}
                      style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',
                        width:28,height:28,borderRadius:'50%',cursor:'pointer',fontSize:16}}>
                      +
                    </button>
                    <span style={{color:'rgba(255,255,255,.7)',fontSize:12,minWidth:70,
                      textAlign:'right',fontFamily:'monospace'}}>
                      {(parseInt(item.prix)*item.qte).toLocaleString()} F
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <button onClick={()=>setShowCart(!showCart)}
              style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',
                padding:'10px 14px',borderRadius:10,cursor:'pointer',fontSize:13,
                display:'flex',alignItems:'center',gap:6}}>
              🛒 <span style={{fontWeight:700,background:'#f0a500',color:'#000',
                borderRadius:'50%',width:20,height:20,display:'inline-flex',
                alignItems:'center',justifyContent:'center',fontSize:11}}>
                {nbItems}
              </span>
            </button>
            <div style={{flex:1,textAlign:'center'}}>
              <div style={{fontFamily:'monospace',fontSize:22,fontWeight:900,color:'#f0a500'}}>
                {total.toLocaleString()} FCFA
              </div>
              {agentInfo && bonAgent && (
                <div style={{fontSize:10,color:'rgba(255,255,255,.6)'}}>
                  Solde: {parseInt(bonAgent.credit_restant).toLocaleString()} FCFA
                </div>
              )}
            </div>
            <button onClick={valider} disabled={submitting}
              style={{background:submitting?'#94a3b8':'#16a34a',color:'#fff',
                border:'none',padding:'12px 20px',borderRadius:12,cursor:'pointer',
                fontSize:14,fontWeight:700}}>
              {submitting ? '⏳' : '✅ Encaisser'}
            </button>
          </div>
        </div>
      )}

      {/* Toast message */}
      {msg && (
        <div style={{position:'fixed',top:80,left:16,right:16,zIndex:300,
          background:msg.type==='success'?'#16a34a':'#dc2626',
          color:'#fff',borderRadius:12,padding:'12px 16px',
          fontSize:14,fontWeight:700,textAlign:'center',
          boxShadow:'0 4px 20px rgba(0,0,0,.3)'}}>
          {msg.text}
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────
  // RENDER DESKTOP — délégue à l'ancienne page Boutique
  // ─────────────────────────────────────────────────────────
  return null // sera remplacé par la navigation vers /boutique
}
