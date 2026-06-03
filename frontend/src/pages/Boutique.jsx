// BOUTIQUE v1779617956 — Modifier/Suppr CATALOGUE ONLY
/**
 * BAR & BOUTIQUE — CRUD complet Admin
 * Ajouter / Modifier / Supprimer articles + catégories + images
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

// ── Images par défaut (fallback si pas d'image en DB) ──────
const DEFAULT_PHOTOS = {
  'Coca-Cola Classic':        null,
  'Coca-Cola 1.5L':           null,
  'Fanta Orange':             null,
  'Sprite':                   null,
  'Schweppes Tonic':          null,
  'Pepsi':                    null,
  '7 Up':                     null,
  'Darci Mangue':             null,
  'Pressea Orange':           null,
  'Ceres Multifruits':        null,
  'Minute Maid Orange':       null,
  'Malta Guinness':           null,
  'Red Bull Original':        null,
  'Monster Energy Green':     null,
  'Evian':                    null,
  'Cristaline':               null,
  'Heineken':                 null,
  'Desperados':               null,
  'Guinness Stout':           null,
  'Corona Extra':             null,
  'Beaufort 65cl':            null,
  'Ivoire Speciale':          null,
  'JP Chenet Rouge':          null,
  'Mouton Cadet Rouge':       null,
  "Jacob s Creek Shiraz":     null,
  'JP Chenet Blanc':          null,
  'Mateus Blanc':             null,
  'Mateus Rose':              null,
  'Moet et Chandon Brut':     null,
  'Veuve Clicquot Brut':      null,
  'Dom Perignon Vintage':     null,
  "Jack Daniel s Old N7":     null,
  'Johnnie Walker Black':     null,
  'Hennessy VS':              null,
  'Bacardi Carta Blanca':     null,
  'Absolut Vodka':            null,
  'Baileys Original':         null,
  'Malibu Coco':              null,
  'Jagermeister':             null,
  'Cointreau':                null,
  'Amarula Cream':            null,
  'Kahlua':                   null,
  'Get 27':                   null,
  'Nescafe Classic':          null,
  'Nescafe Gold':             null,
  'Lipton Yellow Label':      null,
  'Lipton Green Tea':         null,
  'Twinings English Breakfast':null,
  'Twinings Camomille':       null,
}

function getPhoto(a) {
  return a.image_url || DEFAULT_PHOTOS[a.nom] || null
}

// Config catégories prédéfinies
const CAT_DEFAULTS = {
  gazeuse:    {icon:'🥤', c:'#ef4444', bg:'#fef2f2', label:'Boissons gazeuses'},
  jus:        {icon:'🍊', c:'#f97316', bg:'#fff7ed', label:'Jus & Softs'},
  energie:    {icon:'⚡', c:'#eab308', bg:'#fefce8', label:'Énergisantes'},
  eau:        {icon:'💧', c:'#0ea5e9', bg:'#f0f9ff', label:'Eaux minérales'},
  biere:      {icon:'🍺', c:'#d97706', bg:'#fffbeb', label:'Bières'},
  vin_rouge:  {icon:'🍷', c:'#be123c', bg:'#fff1f2', label:'Vins rouges'},
  vin_blanc:  {icon:'🥂', c:'#ca8a04', bg:'#fefce8', label:'Vins blancs'},
  vin_rose:   {icon:'🌸', c:'#ec4899', bg:'#fdf2f8', label:'Vins rosés'},
  champagne:  {icon:'🍾', c:'#a16207', bg:'#fef9c3', label:'Champagnes'},
  spiritueux: {icon:'🥃', c:'#7c3aed', bg:'#f5f3ff', label:'Spiritueux'},
  liqueur:    {icon:'🫗', c:'#6d28d9', bg:'#ede9fe', label:'Liqueurs'},
  cafe:       {icon:'☕', c:'#92400e', bg:'#fdf6ec', label:'Cafés'},
  the:        {icon:'🍵', c:'#15803d', bg:'#f0fdf4', label:'Thés & Infusions'},
  autre:      {icon:'📦', c:'#64748b', bg:'#f8fafc', label:'Autre'},
}

// Charger les overrides localStorage au démarrage
const _catLabelOverrides = (() => {
  try { return JSON.parse(localStorage.getItem('cat_labels')||'{}') } catch { return {} }
})()

function getCatCfg(cat) {
  const base = CAT_DEFAULTS[cat] || { icon:'📦', c:'#64748b', bg:'#f1f5f9', label: cat }
  if (_catLabelOverrides[cat]) return {...base, label: _catLabelOverrides[cat]}
  return base
}

function getEmoji(nom) {
  const n = (nom||'').toLowerCase()
  if (['coca','fanta','sprite','pepsi','7up','schweppes'].some(k=>n.includes(k))) return '🥤'
  if (['darci','pressea','ceres','minute maid','malta'].some(k=>n.includes(k))) return '🍊'
  if (['red bull','monster'].some(k=>n.includes(k))) return '⚡'
  if (['evian','cristaline','eau'].some(k=>n.includes(k))) return '💧'
  if (['heineken','desperados','guinness','corona','beaufort','ivoire'].some(k=>n.includes(k))) return '🍺'
  if (['chenet rouge','mouton','jacob','shiraz'].some(k=>n.includes(k))) return '🍷'
  if (['chenet blanc','mateus blanc'].some(k=>n.includes(k))) return '🥂'
  if (['ros'].some(k=>n.includes(k))) return '🌸'
  if (['moet','veuve','dom per','champagne'].some(k=>n.includes(k))) return '🍾'
  if (['jack','johnnie','hennessy','bacardi','absolut'].some(k=>n.includes(k))) return '🥃'
  if (['baileys','malibu','jager','cointreau','amarula','kahlua','get 27'].some(k=>n.includes(k))) return '🫗'
  if (['nescafe','cafe'].some(k=>n.includes(k))) return '☕'
  if (['lipton','twinings','camomille'].some(k=>n.includes(k))) return '🍵'
  return '📦'
}



// ── Panneau Analyses Consommations ─────────────────────────
function AnalysesPanel({ periode, onPeriodeChange, data, loading, onLoad }) {
  React.useEffect(() => { onLoad(periode) }, [periode])

  const CAT_COLORS = {
    gazeuse:'#ef4444',jus:'#f97316',energie:'#eab308',eau:'#0ea5e9',biere:'#d97706',
    vin_rouge:'#be123c',vin_blanc:'#ca8a04',vin_rose:'#ec4899',champagne:'#a16207',
    spiritueux:'#7c3aed',liqueur:'#6d28d9',cafe:'#92400e',the:'#15803d',autre:'#64748b',
  }

  const exportCSV = () => {
    if (!data?.top_articles) return
    const rows = [['Article','Catégorie','Quantité','CA (FCFA)'],
      ...data.top_articles.map(a=>[a.article__nom,a.article__categorie,a.qte,a.ca])]
    const csv = rows.map(r=>r.join(';')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href=url; a.download=`analyses_boutique_${periode}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Filtres */}
      <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontWeight:700,fontSize:13,color:'#1e3a8a'}}>📊 Analyses — Période :</span>
        {[['7j','7 derniers jours'],['30j','30 derniers jours'],['90j','3 derniers mois'],['annee','Cette année']].map(([k,l])=>(
          <button key={k} onClick={()=>onPeriodeChange(k)}
            style={{padding:'7px 14px',borderRadius:99,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
              background:periode===k?'#1e3a8a':'#fff',color:periode===k?'#fff':'#1e3a8a',borderColor:'#1e3a8a'}}>
            {l}
          </button>
        ))}
        {data && (
          <button onClick={exportCSV}
            style={{marginLeft:'auto',padding:'7px 16px',borderRadius:99,border:'2px solid #16a34a',
              cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',background:'#f0fdf4',color:'#16a34a'}}>
            📥 Export CSV
          </button>
        )}
      </div>

      {loading && <div style={{textAlign:'center',padding:60,fontSize:36}}>⏳</div>}

      {!loading && !data && (
        <div style={{textAlign:'center',padding:60,color:'#94a3b8'}}>
          <div style={{fontSize:48}}>📊</div>
          <div style={{fontWeight:600}}>Aucune donnée · vérifiez l'endpoint /api/boutique/consommations/analyses/</div>
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            {[
              ['💰 CA FCFA',`${data.total_ca.toLocaleString()} FCFA`,'#1e3a8a'],
              ['📦 Quantités',data.total_qte,'#16a34a'],
              ['🧾 Transactions',data.nb_transactions,'#7c3aed'],
              ['📈 Panier moyen',data.nb_transactions?`${Math.round(data.total_ca/data.nb_transactions).toLocaleString()} FCFA`:'—','#f59e0b'],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:'#fff',borderRadius:12,padding:'14px 16px',borderTop:`3px solid ${c}`,boxShadow:'0 1px 6px rgba(0,0,0,.07)'}}>
                <div style={{fontFamily:'monospace',fontSize:20,fontWeight:900,color:c}}>{v}</div>
                <div style={{fontSize:11,color:'#94a3b8',marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>

          {/* Top articles + Top agents */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
            {/* Top articles */}
            <div style={{background:'#fff',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0'}}>
              <div style={{padding:'12px 16px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontWeight:700,fontSize:13,color:'#1e3a8a'}}>
                🏆 Top 10 Articles
              </div>
              <div style={{padding:12}}>
                {data.top_articles.length===0 ? (
                  <div style={{textAlign:'center',color:'#94a3b8',padding:20,fontSize:12}}>Aucune vente</div>
                ) : data.top_articles.map((a,i)=>{
                  const max = data.top_articles[0]?.ca||1
                  const pct = Math.round(a.ca/max*100)
                  const col = CAT_COLORS[a.article__categorie]||'#64748b'
                  return (
                    <div key={i} style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:600,color:'#1e293b'}}>{i+1}. {a.article__nom}</span>
                        <span style={{fontSize:11,fontWeight:800,color:col}}>{a.ca.toLocaleString()} FCFA</span>
                      </div>
                      <div style={{background:'#f1f5f9',borderRadius:99,height:4,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:col}}/>
                      </div>
                      <div style={{fontSize:9,color:'#94a3b8',marginTop:1}}>{a.qte} unités vendues</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top agents */}
            <div style={{background:'#fff',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0'}}>
              <div style={{padding:'12px 16px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontWeight:700,fontSize:13,color:'#1e3a8a'}}>
                👤 Top Consommateurs
              </div>
              <div style={{padding:12}}>
                {data.top_agents.length===0 ? (
                  <div style={{textAlign:'center',color:'#94a3b8',padding:20,fontSize:12}}>
                    Aucun agent identifié
                  </div>
                ) : data.top_agents.map((a,i)=>{
                  const max = data.top_agents[0]?.ca||1
                  const pct = Math.round(a.ca/max*100)
                  return (
                    <div key={i} style={{marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:600,color:'#1e293b'}}>
                          {i+1}. {a.nom||"Anonyme"}
                        </span>
                        <span style={{fontSize:11,fontWeight:800,color:'#16a34a'}}>{a.ca.toLocaleString()} FCFA</span>
                      </div>
                      <div style={{background:'#f1f5f9',borderRadius:99,height:4,overflow:'hidden'}}>
                        <div style={{height:'100%',borderRadius:99,width:`${pct}%`,background:'#16a34a'}}/>
                      </div>
                      <div style={{fontSize:9,color:'#94a3b8',marginTop:1}}>{a.qte} achats · {a.personnel__societe}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Par catégorie */}
          <div style={{background:'#fff',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0',marginBottom:16}}>
            <div style={{padding:'12px 16px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontWeight:700,fontSize:13,color:'#1e3a8a'}}>
              📂 Répartition par catégorie
            </div>
            <div style={{padding:16,display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
              {data.par_categorie.map((cat,i)=>{
                const col = CAT_COLORS[cat.article__categorie]||'#64748b'
                const total = data.par_categorie.reduce((s,c)=>s+c.ca,0)||1
                const pct   = Math.round(cat.ca/total*100)
                return (
                  <div key={i} style={{padding:'10px 12px',background:`${col}10`,borderRadius:10,borderLeft:`3px solid ${col}`}}>
                    <div style={{fontWeight:700,fontSize:12,color:col}}>{cat.article__categorie||'autre'}</div>
                    <div style={{fontFamily:'monospace',fontSize:16,fontWeight:900,color:col,margin:'4px 0'}}>
                      {cat.ca.toLocaleString()} FCFA
                    </div>
                    <div style={{fontSize:10,color:'#94a3b8'}}>{cat.qte} unités · {pct}% du CA</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Évolution journalière */}
          {data.evolution && data.evolution.length > 0 && (
            <div style={{background:'#fff',borderRadius:14,overflow:'hidden',border:'1px solid #e2e8f0'}}>
              <div style={{padding:'12px 16px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',fontWeight:700,fontSize:13,color:'#1e3a8a'}}>
                📈 Évolution journalière (30 jours)
              </div>
              <div style={{padding:16,overflowX:'auto'}}>
                <div style={{display:'flex',gap:4,alignItems:'flex-end',minHeight:80,minWidth:Math.max(300,data.evolution.length*30)}}>
                  {data.evolution.map((d,i)=>{
                    const max = Math.max(...data.evolution.map(x=>x.ca))||1
                    const h   = Math.round(d.ca/max*80)
                    return (
                      <div key={i} title={`${d.jour}: ${d.ca.toLocaleString()} FCFA`}
                        style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'help'}}>
                        <div style={{width:'100%',background:'#1e3a8a',borderRadius:'3px 3px 0 0',height:h,minHeight:2,transition:'height .2s'}}/>
                        <div style={{fontSize:7,color:'#94a3b8',transform:'rotate(-45deg)',whiteSpace:'nowrap'}}>
                          {new Date(d.jour).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Panneau Gestion des Bons de Caisse ─────────────────────
function GererBonsPanel({ bons, personnel, annee, onRefresh }) {
  // États locaux pour la modification de bon
  const [editBon,      setEditBon]     = useState(null)
  const [editMontant,  setEditMontant] = useState(100000)
  const [loading,    setLoading]   = useState(false)
  const [msg,        setMsg]       = useState(null)
  const [montant,    setMontant]   = useState(100000)
  const [selPerso,   setSelPerso]  = useState('')
  const [search,     setSearch]    = useState('')
  const [searchSociete, setSearchSociete] = useState('')

  const crediterTous = async () => {
    if (!window.confirm(`Créditer TOUS les personnels actifs de ${montant.toLocaleString()} FCFA pour ${annee} ?`)) return
    setLoading(true)
    try {
      const r = await boutiqueAPI.crediterTous({ montant, annee })
      setMsg({ type:'success', text: r.data.message })
      onRefresh()
    } catch(e) { setMsg({ type:'error', text: e.response?.data?.error||'Erreur' }) }
    finally { setLoading(false) }
  }

  const crediterUn = async () => {
    if (!selPerso) return alert('Sélectionner un personnel')
    setLoading(true)
    try {
      const r = await boutiqueAPI.crediterPersonnel({ personnel_id: selPerso, montant, annee })
      setMsg({ type:'success', text: r.data.message })
      setSelPerso('')
      onRefresh()
    } catch(e) { setMsg({ type:'error', text: e.response?.data?.error||'Erreur' }) }
    finally { setLoading(false) }
  }

  const filteredBons = bons.filter(b => {
    const matchSearch = !search || b.personnel_nom.toLowerCase().includes(search.toLowerCase())
    const matchSociete = !searchSociete || b.personnel_info?.societe === searchSociete
    return matchSearch && matchSociete
  })

  const totalCredit  = bons.reduce((s,b) => s+parseInt(b.credit_initial),  0)
  const totalRestant = bons.reduce((s,b) => s+parseInt(b.credit_restant),  0)
  const totalUtilise = bons.reduce((s,b) => s+parseInt(b.credit_utilise||0),0)

  const inp = {border:'2px solid #e2e8f0',borderRadius:9,padding:'9px 12px',fontSize:13,outline:'none',fontFamily:'inherit'}

  return (
    <div style={{marginTop:24,background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',
        display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontWeight:800,fontSize:15}}>🎫 Bons de Caisse — {annee}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.7)',marginTop:2}}>
            Tickets annuels de consommation · Rechargement 100 000 FCFA/an
          </div>
        </div>
        <div style={{textAlign:'right',fontSize:12}}>
          <div style={{fontFamily:'monospace',fontSize:20,fontWeight:900,color:'#f0a500'}}>
            {totalRestant.toLocaleString()}
          </div>
          <div style={{color:'rgba(255,255,255,.6)'}}>FCFA restants / {totalCredit.toLocaleString()}</div>
        </div>
      </div>

      <div style={{padding:20}}>
        {/* Stats globales */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
          {[
            ['🎫 Bons actifs',bons.length,'#1e3a8a'],
            ['💰 Crédits restants',`${totalRestant.toLocaleString()} FCFA`,'#16a34a'],
            ['🛒 Total consommé',`${totalUtilise.toLocaleString()} FCFA`,'#dc2626'],
          ].map(([l,v,c])=>(
            <div key={l} style={{background:'#f8fafc',borderRadius:10,padding:'12px 14px',borderTop:`3px solid ${c}`}}>
              <div style={{fontFamily:'monospace',fontSize:16,fontWeight:900,color:c}}>{v}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {msg && (
          <div style={{padding:'10px 14px',borderRadius:10,marginBottom:16,fontSize:13,fontWeight:600,
            background:msg.type==='success'?'#f0fdf4':'#fef2f2',
            color:msg.type==='success'?'#166534':'#991b1b',
            border:`1px solid ${msg.type==='success'?'#bbf7d0':'#fecaca'}`}}>
            {msg.text}
          </div>
        )}

        {/* Actions admin */}
        <div style={{background:'#f8fafc',borderRadius:12,padding:16,marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:13,color:'#1e3a8a',marginBottom:12}}>⚙️ Actions</div>
          
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {/* Crédit tous */}
            <div>
              <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:8}}>Créditer tous les personnels actifs</div>
              <div style={{display:'flex',gap:8}}>
                <input type="number" value={montant} onChange={e=>setMontant(Number(e.target.value))}
                  style={{...inp,width:130}} min={1000} max={500000} step={10000}/>
                <span style={{alignSelf:'center',fontSize:11,color:'#94a3b8'}}>FCFA</span>
              </div>
              <button onClick={crediterTous} disabled={loading}
                style={{marginTop:8,width:'100%',background:loading?'#94a3b8':'#1e3a8a',color:'#fff',
                  border:'none',padding:'10px',borderRadius:9,cursor:loading?'wait':'pointer',
                  fontSize:13,fontWeight:700,fontFamily:'inherit'}}>
                {loading?'⏳...':`🚀 Créditer tous (${annee})`}
              </button>
            </div>
            {/* Crédit un seul */}
            <div>
              <div style={{fontSize:12,fontWeight:600,color:'#64748b',marginBottom:8}}>Créditer un seul résident</div>
              <select value={selPerso} onChange={e=>setSelPerso(e.target.value)}
                style={{...inp,width:'100%',marginBottom:8}}>
                <option value="">— Sélectionner —</option>
                {personnel.map(p=>(
                  <option key={p.id} value={p.id}>{p.nom} {p.prenom} ({p.societe})</option>
                ))}
              </select>
              <button onClick={crediterUn} disabled={loading||!selPerso}
                style={{width:'100%',background:loading||!selPerso?'#94a3b8':'#16a34a',color:'#fff',
                  border:'none',padding:'10px',borderRadius:9,cursor:loading||!selPerso?'default':'pointer',
                  fontSize:13,fontWeight:700,fontFamily:'inherit'}}>
                💳 Créditer ce résident
              </button>
            </div>
          </div>
        </div>

        {/* Liste des bons */}
        <div style={{fontWeight:700,fontSize:13,color:'#1e3a8a',marginBottom:10}}>
          📋 État des bons ({bons.length} résidents)
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Rechercher un résident..."
          style={{...inp,width:'100%',marginBottom:12,boxSizing:'border-box'}}/>
        <div style={{maxHeight:340,overflowY:'auto',display:'flex',flexDirection:'column',gap:6}}>
          {filteredBons.length===0 ? (
            <div style={{textAlign:'center',padding:24,color:'#94a3b8',fontSize:12}}>
              Aucun bon créé — cliquez sur "Créditer tous"
            </div>
          ) : filteredBons.map(b => {
            const pct = 100 - b.pourcentage
            const barColor = pct > 50 ? '#16a34a' : pct > 20 ? '#f59e0b' : '#dc2626'
            return (
              <div key={b.id} style={{background:'#f8fafc',borderRadius:10,padding:'10px 14px',
                border:`1px solid ${pct < 20 ? '#fca5a5' : '#e2e8f0'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <div>
                    <span style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{b.personnel_nom}</span>
                    <span style={{fontSize:11,color:'#94a3b8',marginLeft:8}}>{b.personnel_info?.societe}</span>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontFamily:'monospace',fontWeight:900,fontSize:14,
                      color:barColor}}>{parseInt(b.credit_restant).toLocaleString()}</span>
                    <span style={{fontSize:9,color:'#94a3b8',marginLeft:3}}>/ {parseInt(b.credit_initial).toLocaleString()} FCFA</span>
                  </div>
                </div>
                <div style={{background:'#e2e8f0',borderRadius:99,height:5,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:99,width:`${Math.max(2,pct)}%`,background:barColor,transition:'width .3s'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:3}}>
                  <span style={{fontSize:10,color:'#94a3b8'}}>
                    {parseInt(b.credit_utilise).toLocaleString()} FCFA utilisés ({b.pourcentage}%)
                  </span>
                  <div style={{display:'flex',gap:4}}>
                    <button onClick={()=>{setEditBon(b);setEditMontant(parseInt(b.credit_initial))}}
                      style={{background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe',
                        padding:'2px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:700}}>
                      ✏️ Modifier
                    </button>
                    <button onClick={async()=>{
                      if(!window.confirm(`Supprimer le bon de ${b.personnel_nom} ?`)) return
                      try {
                        await api.delete(`/api/boutique/bons/${b.id}/`)
                        onRefresh()
                      } catch(e) { alert(e.response?.data?.error||'Erreur suppression') }
                    }}
                      style={{background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',
                        padding:'2px 8px',borderRadius:6,cursor:'pointer',fontSize:10,fontWeight:700}}>
                      🗑️ Suppr.
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─ Modal modifier montant bon ─ */}
      {editBon && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',zIndex:2100,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>e.target===e.currentTarget&&setEditBon(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:380,
            overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',
              padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>Modifier le bon</div>
                <div style={{fontSize:11,opacity:.8}}>{editBon.personnel_nom}</div>
              </div>
              <button onClick={()=>setEditBon(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:28,height:28,borderRadius:8,cursor:'pointer'}}>X</button>
            </div>
            <div style={{padding:20}}>
              <div style={{fontSize:12,color:'#64748b',marginBottom:8}}>Montant crédit (FCFA)</div>
              <div style={{display:'flex',gap:6,marginBottom:8}}>
                {[50000,100000,150000,200000].map(v=>(
                  <button key={v} onClick={()=>setEditMontant(v)}
                    style={{flex:1,padding:'6px 2px',borderRadius:8,cursor:'pointer',fontFamily:'inherit',
                      fontSize:10,fontWeight:700,border:'1.5px solid '+(editMontant===v?'#1e3a8a':'#e2e8f0'),
                      background:editMontant===v?'#1e3a8a':'#f8fafc',color:editMontant===v?'#fff':'#1e3a8a'}}>
                    {v/1000}K
                  </button>
                ))}
              </div>
              <input type="number" value={editMontant}
                onChange={e=>setEditMontant(parseInt(e.target.value)||0)}
                style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',
                  fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>
                Actuel: {parseInt(editBon.credit_initial).toLocaleString()} FCFA
              </div>
              <button onClick={async()=>{
                try {
                  const base = (import.meta?.env?.VITE_API_URL||window.location.origin.replace('frontend','backend')).replace(/\/+$/,'')
                  const tok  = localStorage.getItem('access_token')
                  const r = await fetch(base+'/api/boutique/bons/crediter/',{
                    method:'POST',
                    headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
                    body:JSON.stringify({personnel_id:editBon.personnel,montant:editMontant,annee:new Date().getFullYear()})
                  })
                  if(r.ok){setEditBon(null);onRefresh()}
                  else {const d=await r.json();alert(d.error||'Erreur')}
                }catch(e){alert('Erreur: '+e.message)}
              }}
                style={{width:'100%',marginTop:14,background:'#1e3a8a',color:'#fff',border:'none',
                  padding:12,borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal Article (Créer / Modifier) ─────────────────────── (Créer / Modifier) ───────────────────────
function ArticleModal({ article, categories, onSave, onClose }) {
  const isEdit = !!article?.id
  const [form, setForm] = useState(article || {
    nom:'', categorie:'gazeuse', prix:0, stock:100, unite:'33cl', image_url:'', actif:true
  })
  const [imgPreview, setImgPreview] = useState(form.image_url || '')
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}

  const handleSave = async () => {
    if (!form.nom.trim()) return alert('Nom requis')
    setSaving(true)
    try {
      await onSave({...form, prix:Number(form.prix)||0, stock:Number(form.stock)||0, image_url: imgPreview})
      onClose()
    } catch(e) { alert(e.response?.data?.detail||JSON.stringify(e.response?.data)||'Erreur') }
    finally { setSaving(false) }
  }

  const allCats = [...new Set([...Object.keys(CAT_DEFAULTS), ...categories])]

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:2000,padding:0}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#fff',width:'100%',maxWidth:560,maxHeight:'95dvh',overflow:'auto',borderRadius:'18px 18px 0 0',boxShadow:'0 -8px 40px rgba(0,0,0,.2)'}}>
        <div style={{position:'sticky',top:0,background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:'18px 18px 0 0',zIndex:10}}>
          <span style={{fontWeight:700,fontSize:15}}>{isEdit?'✏️ Modifier l\'article':'➕ Nouvel article'}</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18}}>✕</button>
        </div>
        <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>

          {/* IMAGE: upload fichier OU URL */}
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:8,textTransform:'uppercase'}}>🖼️ Image de l'article</label>
            
            {/* Preview */}
            <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:10}}>
              <div style={{width:100,height:100,borderRadius:14,overflow:'hidden',
                border:`2px solid ${imgPreview?'#1e3a8a':'#e2e8f0'}`,background:'#f8fafc',
                flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                {imgPreview ? (
                  <>
                    <img src={imgPreview} alt="preview"
                      style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}
                      onError={e=>{e.target.style.display='none'}}/>
                    <button onClick={()=>setImgPreview('')}
                      style={{position:'absolute',top:2,right:2,width:20,height:20,borderRadius:'50%',
                        background:'rgba(220,38,38,.8)',color:'#fff',border:'none',cursor:'pointer',
                        fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                  </>
                ) : (
                  <span style={{fontSize:40}}>{getEmoji(form.nom)}</span>
                )}
              </div>
              
              <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                {/* Upload fichier */}
                <label style={{
                  display:'flex',alignItems:'center',gap:8,padding:'10px 14px',
                  background:'#eff6ff',border:'2px dashed #bfdbfe',borderRadius:10,
                  cursor:'pointer',fontSize:13,color:'#2563eb',fontWeight:600}}>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) { alert('Image trop grande (max 2 Mo)'); return }
                      const reader = new FileReader()
                      reader.onload = ev => setImgPreview(ev.target.result)
                      reader.readAsDataURL(file)
                    }}/>
                  📸 Télécharger une photo
                  <span style={{fontSize:10,color:'#64748b',fontWeight:400}}>JPG/PNG max 2Mo</span>
                </label>
                
                {/* Ou URL */}
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{flex:1,height:1,background:'#e2e8f0'}}/>
                  <span style={{fontSize:11,color:'#94a3b8'}}>ou</span>
                  <div style={{flex:1,height:1,background:'#e2e8f0'}}/>
                </div>
                
                <input value={imgPreview.startsWith('data:') ? '' : imgPreview}
                  onChange={e=>setImgPreview(e.target.value)}
                  placeholder="https://... URL d'image (Wikipedia, Unsplash…)"
                  style={{...inp,fontSize:12}}/>
              </div>
            </div>
          </div>

          {/* Nom */}
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Nom de l'article *</label>
            <input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} placeholder="Ex: Coca-Cola 33cl" style={inp}/>
          </div>

          {/* Catégorie */}
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Catégorie</label>
            <div style={{display:'flex',gap:8}}>
              <select value={form.categorie} onChange={e=>setForm({...form,categorie:e.target.value})}
                style={{...inp, flex:1}}>
                {allCats.map(k=>{
                  const cfg=getCatCfg(k)
                  return <option key={k} value={k}>{cfg.icon} {cfg.label}</option>
                })}
              </select>
              <button onClick={()=>setShowNewCat(!showNewCat)}
                title="Créer une nouvelle catégorie"
                style={{background:'#f0f9ff',border:'2px solid #0ea5e9',color:'#0284c7',borderRadius:9,padding:'0 14px',cursor:'pointer',fontSize:18,fontWeight:700,flexShrink:0}}>+</button>
            </div>
            {showNewCat && (
              <div style={{marginTop:8,display:'flex',gap:8}}>
                <input value={newCat} onChange={e=>setNewCat(e.target.value)}
                  placeholder="Ex: cocktails, snacks_CI..."
                  style={{...inp,fontSize:12}}/>
                <button onClick={()=>{if(newCat.trim()){setForm({...form,categorie:newCat.trim()});setShowNewCat(false);setNewCat('')}}}
                  style={{background:'#0ea5e9',color:'#fff',border:'none',padding:'0 14px',borderRadius:9,cursor:'pointer',fontWeight:700,flexShrink:0}}>
                  ✓ Créer
                </button>
              </div>
            )}
          </div>

          {/* Prix + Stock */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Prix FCFA *</label>
              <input type="number" value={form.prix} onChange={e=>setForm({...form,prix:e.target.value})} style={inp}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Stock</label>
              <input type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} style={inp}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase'}}>Unité</label>
              <input value={form.unite} onChange={e=>setForm({...form,unite:e.target.value})} placeholder="33cl, 75cl..." style={inp}/>
            </div>
          </div>

          {/* Actif toggle */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#f8fafc',borderRadius:10,padding:'12px 16px'}}>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>Article actif</div>
              <div style={{fontSize:11,color:'#94a3b8'}}>Visible dans la caisse et le catalogue</div>
            </div>
            <button type="button" onClick={()=>setForm({...form,actif:!form.actif})}
              style={{width:48,height:26,borderRadius:99,border:'none',cursor:'pointer',transition:'all .2s',
                background:form.actif?'#16a34a':'#e2e8f0',position:'relative',flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',position:'absolute',top:3,transition:'all .2s',
                left:form.actif?25:3,boxShadow:'0 1px 4px rgba(0,0,0,.2)'}}/>
            </button>
          </div>

          {/* Boutons action */}
          <div style={{display:'flex',gap:10,paddingTop:4}}>
            <button onClick={onClose} style={{flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',padding:13,borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:14}}>Annuler</button>
            <button onClick={handleSave} disabled={saving}
              style={{flex:2,background:saving?'#94a3b8':'#1e3a8a',color:'#fff',border:'none',padding:13,borderRadius:10,cursor:saving?'wait':'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              {saving?'⏳ Enregistrement...':(isEdit?'💾 Enregistrer':'✅ Créer l\'article')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Carte Article avec actions Admin ────────────────────────
function ArticleCard({ a, qty, onAdd }) {
  const [err, setErr] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const url = getPhoto(a)
  const cfg = getCatCfg(a.categorie)
  const inCart = qty > 0

  return (
    <div style={{background:'#fff',borderRadius:16,overflow:'hidden',border:`2px solid ${inCart?cfg.c:'#f1f5f9'}`,
      boxShadow:inCart?`0 0 0 3px ${cfg.c}25,0 4px 20px rgba(0,0,0,.12)`:'0 2px 10px rgba(0,0,0,.08)',
      transition:'all .18s ease',position:'relative',display:'flex',flexDirection:'column'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow=`0 10px 28px rgba(0,0,0,.15)`}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=inCart?`0 0 0 3px ${cfg.c}25,0 4px 20px rgba(0,0,0,.12)`:'0 2px 10px rgba(0,0,0,.08)'}}>

      {/* Zone cliquable pour ajouter */}
      <div onClick={()=>onAdd(a)} style={{cursor:'pointer'}}>
        <div style={{height:140,background:`linear-gradient(135deg,${cfg.bg},#fff)`,position:'relative',overflow:'hidden'}}>
          {url&&!err ? (
            <img src={url} alt={a.nom} onError={()=>setErr(true)}
              style={{width:'100%',height:'100%',objectFit:'contain',padding:8,display:'block'}}/>
          ) : (
            <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:56}}>
              {getEmoji(a.nom)}
            </div>
          )}
          <div style={{position:'absolute',top:8,left:8,background:cfg.c,color:'#fff',
            fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:99,letterSpacing:.5}}>
            {cfg.icon}
          </div>
          {a.stock < 15 && (
            <div style={{position:'absolute',bottom:6,left:8,background:'#dc2626',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 8px',borderRadius:99}}>
              Stock limité
            </div>
          )}
          {inCart && (
            <div style={{position:'absolute',top:8,right:8,width:28,height:28,borderRadius:'50%',
              background:cfg.c,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:14,fontWeight:900,boxShadow:'0 2px 8px rgba(0,0,0,.3)'}}>
              {qty}
            </div>
          )}
        </div>
        <div style={{padding:'10px 12px',flex:1,borderTop:`2px solid ${cfg.bg}`}}>
          <div style={{fontWeight:700,fontSize:12,color:'#1e293b',lineHeight:1.4,marginBottom:4,
            display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',minHeight:30}}>
            {a.nom}
          </div>
          {/* Badge stock visible */}
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <span style={{
              background: (a.stock||0)===0 ? '#fee2e2' : (a.stock||0) <= (a.stock_min||5) ? '#fef3c7' : '#dcfce7',
              color: (a.stock||0)===0 ? '#dc2626' : (a.stock||0) <= (a.stock_min||5) ? '#92400e' : '#16a34a',
              fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99
            }}>
              {(a.stock||0)===0 ? '🔴 Rupture' : `📦 ${a.stock||0} restant${(a.stock||0)>1?'s':''}`}
            </span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:900,color:cfg.c,fontSize:15,fontFamily:'monospace'}}>
              {parseInt(a.prix).toLocaleString()}<span style={{fontSize:9,marginLeft:2}}>FCFA</span>
            </div>
            <div style={{fontSize:9.5,color:'#94a3b8'}}>{a.stock} · {a.unite}</div>
          </div>
        </div>
      </div>

    </div>
  )
}

// ════════════════════════════════════════════════════════════
export default function Boutique() {
  const {user} = useStore()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [stockFilter,           setStockFilter]          = useState('')
  const [stockCatFilter,        setStockCatFilter]       = useState('')
  const [exclureAchatsInternes, setExclureAchatsInternes] = useState(false)
  // Gestion stock
  const [stockModal,   setStockModal]   = useState(null)
  const [stockQte,     setStockQte]     = useState(0)
  const [stockOp,      setStockOp]      = useState('add')
  const [stockRaison,  setStockRaison]  = useState('')
  useEffect(()=>{
    const h = ()=>setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize',h)
    return ()=>window.removeEventListener('resize',h)
  },[])
  const isAdmin = !!(user?.is_staff || user?.is_superuser ||
    user?.profile?.role === 'admin' || user?.role === 'admin' ||
    user?.username === 'admin')

  const [articles,   setArticles]   = useState([])
  const [consos,     setConsos]     = useState([])
  const [personnel,  setPersonnel]  = useState([])
  const [statsJour,  setStatsJour]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('caisse')
  const [catFilter,  setCatFilter]  = useState('')
  const [search,     setSearch]     = useState('')
  const [agentId,    setAgentId]    = useState('')
  const [agentInfo,  setAgentInfo]  = useState(null)
  const [panier,     setPanier]     = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [scanning,   setScanning]   = useState(false)
  const [artModal,   setArtModal]   = useState(false)
  const [editArt,    setEditArt]    = useState(null)
  const [delConfirm, setDelConfirm] = useState(null)
  const [reorganize,   setReorganize]  = useState(false)
  const [draggingId,   setDraggingId]  = useState(null)
  const [dragOverCat,  setDragOverCat] = useState(null)
  const [quickCatArt,  setQuickCatArt] = useState(null)
  const [renommerCat,  setRenommerCat]  = useState(null) // {oldKey, newLabel}
  const [newCatLabel,  setNewCatLabel]  = useState('')
  const [bonAgent,     setBonAgent]     = useState(null)
  const [analyses,     setAnalyses]     = useState(null)
  const [histSearch,  setHistSearch]  = useState('')
  const [histDate,    setHistDate]    = useState('')
  const [histMode,    setHistMode]    = useState('')
  const [analysesPeriode, setAnalysesPeriode] = useState('30j')
  const [analysesLoading, setAnalysesLoading] = useState(false)   // solde bon de caisse agent
  const [bonsAll,      setBonsAll]      = useState([])     // tous les bons (admin)
  const [showGererBons,setShowGererBons]= useState(false)
  const [modePaiement, setModePaiement] = useState(null)   // 'especes' | 'bon'
  const [showPayModal, setShowPayModal] = useState(false)
  const scannerInst = useRef(null)

  const load = useCallback(() => {
    Promise.allSettled([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({page_size:50}),
      boutiqueAPI.statsJour(),
      personnelAPI.list({page_size:200}),
    ]).then(([ra,rc,rs,rp]) => {
      if (ra.status==='fulfilled') setArticles(ra.value.data.results||ra.value.data||[])
      if (rc.status==='fulfilled') setConsos(rc.value.data.results||rc.value.data||[])
      if (rs.status==='fulfilled') setStatsJour(rs.value.data||{})
      if (rp.status==='fulfilled') setPersonnel(rp.value.data.results||rp.value.data||[])
      else console.warn('Personnel API unavailable in Boutique:', rp.reason?.message)
    }).catch(e=>console.error('Boutique load error:', e)).catch(()=>{}).finally(()=>setLoading(false))
  }, [])

  useEffect(()=>{load()},[load])
  useEffect(()=>{
    if((tab==='bons' || tab==='catalogue') && isAdmin) {
      boutiqueAPI.bons({annee:new Date().getFullYear()}).then(r=>{
        setBonsAll(r.data.results||r.data||[])
      }).catch(()=>{})
    }
  },[tab,isAdmin])
  useEffect(()=>{
    if(!agentId){setAgentInfo(null);setBonAgent(null);return}
    const p = personnel.find(x=>x.qr_code_string===agentId||String(x.id)===agentId||x.login_genere===agentId)||null
    setAgentInfo(p)
    if(p) {
      boutiqueAPI.soldePersonnel(p.id).then(r=>setBonAgent(r.data)).catch(()=>setBonAgent(null))
    } else {
      setBonAgent(null)
    }
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

  // CRUD
  const handleCreate = async (data) => {
    await boutiqueAPI.createArticle(data)
    load()
  }
  const handleEdit = async (data) => {
    await boutiqueAPI.updateArticle(editArt.id, data)
    load()
  }
  const handleDelete = async (a) => {
    setDelConfirm(null)
    try {
      await boutiqueAPI.deleteArticle(a.id)
      load()
    } catch(e) { alert(e.response?.data?.detail||'Impossible de supprimer') }
  }

  const addTo   = a => {setMsg(null);setPanier(p=>{const ex=p.find(x=>x.a.id===a.id);return ex?p.map(x=>x.a.id===a.id?{...x,q:x.q+1}:x):[...p,{a,q:1}]})}
  const decFrom = id=> setPanier(p=>{const ex=p.find(x=>x.a.id===id);return ex?.q>1?p.map(x=>x.a.id===id?{...x,q:x.q-1}:x):p.filter(x=>x.a.id!==id)})
  const totalP  = panier.reduce((s,x)=>s+x.a.prix*x.q,0)
  const qty     = a => panier.find(x=>x.a.id===a.id)?.q||0

  const valider = async (mode) => {
    if(!panier.length) return setMsg({type:'error',text:'Panier vide'})
    if(!mode) { setShowPayModal(true); return }
    if(mode==='bon' && !agentInfo) return setMsg({type:'error',text:'Scanner un agent pour payer par bon'})
    if(mode==='bon' && bonAgent && totalP > bonAgent.credit_restant)
      return setMsg({type:'error',text:`Solde insuffisant (${bonAgent.credit_restant.toLocaleString()} FCFA)`})
    setSubmitting(true)
    setMsg({type:'info',text:'⏳ Traitement...'})
    setShowPayModal(false)
    const BASE = (import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com')
    const token = localStorage.getItem('access_token')||''
    let allOk = true, lastError = ''
    const doPost = (body) => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/api/boutique/consommations/`)
      xhr.setRequestHeader('Content-Type','application/json')
      xhr.setRequestHeader('Authorization',`Bearer ${token}`)
      xhr.timeout = 30000
      xhr.onload = () => resolve({ok: xhr.status>=200&&xhr.status<300, status:xhr.status, body:xhr.responseText})
      xhr.onerror = () => reject(new Error('Réseau indisponible'))
      xhr.ontimeout = () => reject(new Error('Délai dépassé (30s)'))
      xhr.send(JSON.stringify(body))
    })
    for (const {a,q} of panier) {
      try {
        const resp = await doPost({article:a.id, personnel:agentInfo?.id||null, quantite:q, mode_paiement:mode})
        if(!resp.ok){
          try{const d=JSON.parse(resp.body);lastError=d.detail||`HTTP ${resp.status}`}
          catch{lastError=`HTTP ${resp.status}`}
          allOk=false; break
        }
      } catch(e) { lastError=e.message; allOk=false; break }
    }
    if(allOk){
      setMsg({type:'success',text:`✅ ${mode==='bon'?'Payé par bon':'Payé en espèces'} — ${totalP.toLocaleString()} FCFA`})
      setPanier([]); setAgentId(''); setAgentInfo(null); setBonAgent(null); setModePaiement(null); load()
      setTimeout(()=>setMsg(null),4000)
    } else {
      setMsg({type:'error',text:`❌ ${lastError}`})
    }
    setSubmitting(false)
  }

  // ── Drag & Drop réorganisation ──────────────────────────
  const handleDragStart = (e, artId) => {
    setDraggingId(artId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', artId)
  }
  const handleDragEnd = () => { setDraggingId(null); setDragOverCat(null) }
  const handleDragOver = (e, cat) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; setDragOverCat(cat) }
  const handleDrop = async (e, targetCat) => {
    e.preventDefault()
    const artId = parseInt(e.dataTransfer.getData('text/plain'))
    setDraggingId(null); setDragOverCat(null)
    if (!artId || !targetCat) return
    const art = articles.find(a => a.id === artId)
    if (!art || art.categorie === targetCat) return
    try {
      await boutiqueAPI.updateArticle(artId, { categorie: targetCat })
      setArticles(prev => prev.map(a => a.id===artId ? {...a, categorie:targetCat} : a))
    } catch(e) { alert('Erreur lors du déplacement') }
  }
  const handleQuickCat = async (artId, newCat) => {
    setQuickCatArt(null)
    const art = articles.find(a=>a.id===artId)
    if (!art || art.categorie===newCat) return
    try {
      await boutiqueAPI.updateArticle(artId, { categorie: newCat })
      setArticles(prev => prev.map(a => a.id===artId ? {...a, categorie:newCat} : a))
    } catch(e) { alert('Erreur') }
  }

  const inp = {width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}
  const arts = articles.filter(a=>(!catFilter||a.categorie===catFilter)&&(!search||a.nom.toLowerCase().includes(search.toLowerCase())))
  const byCat = arts.reduce((acc,a)=>({...acc,[a.categorie]:[...(acc[a.categorie]||[]),a]}),{})
  // Toutes les catégories dynamiques présentes
  const allCatsPresent = [...new Set(articles.map(a=>a.categorie))]
  const catOrder = ['gazeuse','jus','energie','eau','biere','vin_rouge','vin_blanc','vin_rose','champagne','spiritueux','liqueur','cafe','the',...allCatsPresent.filter(c=>!Object.keys(CAT_DEFAULTS).includes(c)),'autre']

  return (
    <div style={{padding:20,background:'#f8fafc',minHeight:'100dvh'}}>

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:'#1e3a8a',margin:0}}>🛒 Bar & Boutique</h2>
          <p style={{fontSize:12,color:'#64748b',margin:'3px 0 0'}}>
            {loading?'...':`${articles.length} articles · ${allCatsPresent.length} catégories · ${statsJour?.total||0} ventes aujourd'hui`}
          </p>
        </div>
        {isAdmin && tab === 'catalogue' && (
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setReorganize(!reorganize)}
              style={{background:reorganize?'#7c3aed':'#f5f3ff',color:reorganize?'#fff':'#7c3aed',
                border:`2px solid ${reorganize?'#7c3aed':'#c4b5fd'}`,padding:'9px 16px',borderRadius:10,
                cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
              {reorganize ? '✅ Terminer' : '↔️ Réorganiser'}
            </button>
            <button onClick={()=>{setEditArt(null);setArtModal(true)}}
              style={{background:'#1e3a8a',color:'#fff',border:'none',padding:'10px 20px',borderRadius:10,cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6}}>
              ➕ Nouvel article
            </button>
          </div>
        )}
      </div>

      {/* STATS */}
      {statsJour&&statsJour.total>0&&(
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

      {/* BANDEAU MODE RÉORGANISATION */}
      {reorganize && (
        <div style={{background:'linear-gradient(135deg,#5b21b6,#7c3aed)',color:'#fff',borderRadius:12,
          padding:'12px 18px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:22}}>↔️</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>Mode Réorganisation actif</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.8)'}}>
              Glissez un article vers une autre catégorie · Ou cliquez sur l'icône ↔️ de l'article
            </div>
          </div>
          <button onClick={()=>setReorganize(false)}
            style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',padding:'6px 14px',borderRadius:99,cursor:'pointer',fontSize:12,fontWeight:700}}>
            ✅ Terminer
          </button>
        </div>
      )}

      {/* TABS */}
      <div style={{display:'flex',borderBottom:'2px solid #e2e8f0',marginBottom:16,flexWrap:'wrap'}}>
        {[
          ['caisse','🛒 Caisse'],
          ['historique','📋 Historique'],
          ['catalogue','📦 Catalogue'],
          ...(isAdmin ? [['stock','📊 Gestion Stock'],['analyses','📈 Analyses'],['bons','🎫 Bons de Caisse']] : [])
        ].map(([k,l])=>(
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
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 310px',gap:16}}>
          <div>
            {/* Filtres */}
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14,alignItems:'center'}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
                style={{...inp,maxWidth:180,padding:'7px 12px',fontSize:12,width:'auto'}}/>
              <button onClick={()=>setCatFilter('')}
                style={{padding:'6px 13px',borderRadius:99,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
                  background:!catFilter?'#1e3a8a':'#fff',color:!catFilter?'#fff':'#475569',borderColor:!catFilter?'#1e3a8a':'#e2e8f0'}}>
                Tout
              </button>
              {catOrder.filter(k=>articles.some(a=>a.categorie===k)).map(k=>{
                const cfg=getCatCfg(k)
                return (
                  <button key={k} onClick={()=>setCatFilter(catFilter===k?'':k)}
                    style={{padding:'6px 12px',borderRadius:99,border:'2px solid',cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
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
              catOrder.filter(cat=>byCat[cat]?.length).map(cat=>{
                const cfg=getCatCfg(cat)
                const items=byCat[cat]
                return (
                  <div key={cat} style={{marginBottom:24}}>
                    {/* Zone drop pour drag & drop */}
                    <div
                      onDragOver={reorganize ? e=>handleDragOver(e,cat) : undefined}
                      onDrop={reorganize ? e=>handleDrop(e,cat) : undefined}
                      onDragLeave={()=>setDragOverCat(null)}
                      style={{
                        borderRadius:12, transition:'all .2s',
                        border: reorganize && dragOverCat===cat ? `3px dashed ${cfg.c}` : '3px solid transparent',
                        background: reorganize && dragOverCat===cat ? `${cfg.c}12` : 'transparent',
                        padding: reorganize ? 8 : 0,
                      }}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,
                        padding:'7px 14px',background:cfg.bg,borderRadius:10,borderLeft:`4px solid ${cfg.c}`}}>
                        <span style={{fontSize:20}}>{cfg.icon}</span>
                        <span style={{fontWeight:800,fontSize:13,color:cfg.c}}>{cfg.label}</span>
                        <span style={{fontSize:11,color:'#94a3b8',marginLeft:'auto'}}>{items.length} articles</span>
                        {reorganize && (
                          <span style={{fontSize:10,background:`${cfg.c}20`,color:cfg.c,padding:'2px 8px',borderRadius:99,fontWeight:600}}>
                            ← déposer ici
                          </span>
                        )}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(auto-fill,minmax(148px,1fr))',gap:12}}>
                        {items.map(a=>(
                          <div key={a.id}
                            draggable={reorganize}
                            onDragStart={reorganize ? e=>handleDragStart(e,a.id) : undefined}
                            onDragEnd={handleDragEnd}
                            style={{
                              opacity: draggingId===a.id ? .45 : 1,
                              transform: draggingId===a.id ? 'scale(.95)' : '',
                              transition:'all .15s',
                              cursor: reorganize ? 'grab' : 'default',
                            }}>
                            <ArticleCard a={a} qty={qty(a)} onAdd={reorganize ? ()=>{} : addTo}
/>
                          </div>
                        ))}
                      </div>
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
                  <div style={{marginTop:8,borderRadius:10,overflow:'hidden',border:'1px solid #86efac'}}>
                    <div style={{background:'#f0fdf4',padding:'8px 12px',display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:20}}>✅</span>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:'#166534'}}>{agentInfo.nom} {agentInfo.prenom}</div>
                        <div style={{fontSize:11,color:'#16a34a'}}>{agentInfo.societe}</div>
                      </div>
                    </div>
                    {/* Solde bon de caisse */}
                    {bonAgent && (
                      <div style={{background: bonAgent.credit_restant > 10000 ? '#fff' : '#fef2f2',
                        padding:'10px 12px',borderTop:'1px solid #e2e8f0'}}>
                        <div style={{fontSize:10,color:'#94a3b8',textTransform:'uppercase',letterSpacing:.5,marginBottom:5}}>
                          🎫 Bon de caisse {bonAgent.annee}
                        </div>
                        {/* Barre de progression */}
                        <div style={{background:'#e2e8f0',borderRadius:99,height:6,marginBottom:6,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:99,transition:'width .3s',
                            width:`${Math.max(2,100-bonAgent.pourcentage)}%`,
                            background: bonAgent.credit_restant > 30000 ? '#16a34a'
                              : bonAgent.credit_restant > 10000 ? '#f59e0b' : '#dc2626'
                          }}/>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                          <div>
                            <span style={{fontFamily:'monospace',fontSize:16,fontWeight:900,
                              color: bonAgent.credit_restant > 30000 ? '#16a34a'
                                : bonAgent.credit_restant > 10000 ? '#f59e0b' : '#dc2626'}}>
                              {parseInt(bonAgent.credit_restant).toLocaleString()}
                            </span>
                            <span style={{fontSize:9,color:'#94a3b8',marginLeft:3}}>FCFA restants</span>
                          </div>
                          <div style={{fontSize:10,color:'#94a3b8',textAlign:'right'}}>
                            Utilisé: {parseInt(bonAgent.credit_utilise).toLocaleString()} FCFA<br/>
                            <span style={{fontSize:9}}>({bonAgent.pourcentage}%)</span>
                          </div>
                        </div>
                        {/* Avertissement si panier dépasse le solde */}
                        {totalP > bonAgent.credit_restant && bonAgent.credit_restant > 0 && (
                          <div style={{marginTop:6,background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:7,
                            padding:'5px 8px',fontSize:10,color:'#dc2626',fontWeight:600}}>
                            ⚠️ Panier ({totalP.toLocaleString()} FCFA) dépasse le solde
                          </div>
                        )}
                        {bonAgent.credit_restant === 0 && (
                          <div style={{marginTop:6,background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:7,
                            padding:'5px 8px',fontSize:10,color:'#dc2626',fontWeight:700}}>
                            🚫 Bon épuisé — solde nul
                          </div>
                        )}
                      </div>
                    )}
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
                  <div style={{textAlign:'center',color:'#94a3b8',fontSize:12,padding:'24px 0'}}>Cliquez sur un article</div>
                ):(
                  <>
                    <div style={{maxHeight:260,overflowY:'auto',display:'flex',flexDirection:'column',gap:6,marginBottom:12}}>
                      {panier.map(({a,q})=>{
                        const url=getPhoto(a); const cfg=getCatCfg(a.categorie)
                        return (
                          <div key={a.id} style={{display:'flex',alignItems:'center',gap:8,background:'#f8fafc',borderRadius:10,padding:'6px 10px'}}>
                            <div style={{width:40,height:40,borderRadius:9,overflow:'hidden',background:cfg.bg,flexShrink:0}}>
                              {url?<img src={url} alt={a.nom} style={{width:'100%',height:'100%',objectFit:'contain',padding:3}} onError={e=>e.target.style.display='none'}/>
                                :<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{getEmoji(a.nom)}</div>}
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

                    {/* Sélection mode paiement */}
                    <div style={{marginBottom:8}}>
                      <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',
                        letterSpacing:.8,marginBottom:6}}>Mode de paiement</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                        <button onClick={()=>setModePaiement('especes')}
                          style={{padding:'10px 6px',borderRadius:9,border:`2px solid ${modePaiement==='especes'?'#16a34a':'#e2e8f0'}`,
                            background:modePaiement==='especes'?'#f0fdf4':'#fff',
                            cursor:'pointer',fontSize:12,fontWeight:700,
                            color:modePaiement==='especes'?'#16a34a':'#64748b'}}>
                          💵 Espèces
                        </button>
                        <button onClick={()=>setModePaiement('bon')}
                          disabled={!agentInfo}
                          title={!agentInfo?"Scanner un agent d'abord":"Payer par bon de caisse"}
                          style={{padding:'10px 6px',borderRadius:9,border:`2px solid ${modePaiement==='bon'?'#2563eb':'#e2e8f0'}`,
                            background:modePaiement==='bon'?'#eff6ff':!agentInfo?'#f8fafc':'#fff',
                            cursor:agentInfo?'pointer':'not-allowed',fontSize:12,fontWeight:700,
                            color:modePaiement==='bon'?'#2563eb':!agentInfo?'#cbd5e1':'#64748b',
                            opacity:!agentInfo?0.7:1}}>
                          🎫 Bon{bonAgent?` (${parseInt(bonAgent.credit_restant).toLocaleString()})` :''}
                        </button>
                      </div>
                    </div>

                    <button onClick={()=>valider(modePaiement)} disabled={submitting||!modePaiement}
                      style={{width:'100%',
                        background:submitting||!modePaiement?'#94a3b8':modePaiement==='bon'?'#1d4ed8':'#16a34a',
                        color:'#fff',border:'none',padding:'13px',borderRadius:10,
                        cursor:submitting||!modePaiement?'not-allowed':'pointer',fontSize:14,fontWeight:700}}>
                      {submitting?'⏳...'
                        :!modePaiement?'Choisir un mode de paiement'
                        :modePaiement==='especes'?`💵 Encaisser ${totalP.toLocaleString()} FCFA`
                        :`🎫 Débiter bon — ${totalP.toLocaleString()} FCFA`}
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
          {/* Filtres historique */}
          <div style={{display:'flex',gap:8,padding:'12px 16px',borderBottom:'1px solid #f1f5f9',flexWrap:'wrap',alignItems:'center'}}>
            <input value={histSearch} onChange={e=>setHistSearch(e.target.value)}
              placeholder="🔍 Rechercher agent, article..."
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'6px 10px',fontSize:12,flex:1,minWidth:160}}/>
            <input type="date" value={histDate} onChange={e=>setHistDate(e.target.value)}
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'6px 10px',fontSize:12}}/>
            <select value={histMode} onChange={e=>setHistMode(e.target.value)}
              style={{border:'1px solid #e2e8f0',borderRadius:8,padding:'6px 10px',fontSize:12}}>
              <option value="">Tous modes</option>
              <option value="especes">💵 Espèces</option>
              <option value="bon">🎫 Bon</option>
            </select>
            <button onClick={()=>{setHistSearch('');setHistDate('');setHistMode('')}}
              style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',fontSize:12,cursor:'pointer'}}>
              ✕ Reset
            </button>
            <button onClick={()=>{
              const cf = consos.filter(c => {
              if (histSearch && ![(c.personnel_nom||''),(c.article_nom||'')].some(v=>(v||'').toLowerCase().includes(histSearch.toLowerCase()))) return false
              if (histDate && (c.date_conso||'').slice(0,10) !== histDate) return false
              if (histMode && (c.mode_paiement||'especes') !== histMode) return false
              return true
            })
            const rows = cf.map(c=>[
                c.date_conso ? new Date(c.date_conso).toLocaleDateString('fr-FR') : '',
                new Date(c.date_conso||'').toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
                c.personnel_nom||'—',c.article_nom||'',c.quantite,c.montant,c.mode_paiement||'especes'
              ])
              const csv = [['Date','Heure','Agent','Article','Qté','Montant','Mode'],...rows].map(r=>r.join(';')).join('\n')
              const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href=url; a.download='historique_boutique.csv'; a.click()
            }} style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',fontSize:12,cursor:'pointer',fontWeight:700}}>
              📥 CSV
            </button>
          </div>
          {(() => {
            const consosFiltered = consos.filter(c => {
              if (histSearch && ![(c.personnel_nom||''),(c.article_nom||'')].some(v=>(v||'').toLowerCase().includes(histSearch.toLowerCase()))) return false
              if (histDate && (c.date_conso||'').slice(0,10) !== histDate) return false
              if (histMode && (c.mode_paiement||'especes') !== histMode) return false
              return true
            })
            return consosFiltered.length===0?(
              <div style={{padding:56,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:44,marginBottom:10}}>📋</div><div style={{fontWeight:700,color:'#64748b'}}>Aucune vente</div></div>
            ):(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'linear-gradient(135deg,#0f2447,#1e3a8a)'}}>
                {['Date','Heure','Agent','Article','Qté','Montant','Mode'].map(h=><th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:10.5,fontWeight:700,textTransform:'uppercase',color:'rgba(255,255,255,.85)',letterSpacing:.8}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {consosFiltered.map((c,i)=>(
                  <tr key={c.id} style={{borderTop:'1px solid #f1f5f9',background:i%2?'#fafafa':'#fff'}}>
                    <td style={{padding:'10px 14px',fontSize:11,color:'#64748b'}}>{c.date_conso?new Date(c.date_conso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):''}</td>
                    <td style={{padding:'10px 14px',fontFamily:'monospace',fontSize:11,color:'#64748b'}}>{new Date(c.date_conso||'').toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td style={{padding:'10px 14px',fontSize:12,fontWeight:600}}>{c.personnel_nom||'Anonyme'}</td>
                    <td style={{padding:'10px 14px',fontSize:12}}>{getEmoji(c.article_nom||'')} {c.article_nom}</td>
                    <td style={{padding:'10px 14px',fontFamily:'monospace',textAlign:'center'}}>{c.quantite}</td>
                    <td style={{padding:'10px 14px',fontWeight:800,color:'#1e3a8a'}}>{parseInt(c.montant||0).toLocaleString()} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )})()}
        </div>
      )}

      {/* ══ CATALOGUE ══ */}
      {tab==='catalogue'&&(
        <div>
          {catOrder.filter(cat=>articles.some(a=>a.categorie===cat)).map(cat=>{
            const cfg=getCatCfg(cat)
            const items=articles.filter(a=>a.categorie===cat)
            return (
              <div key={cat} style={{marginBottom:28}}>
                <div
                  onDragOver={reorganize ? e=>handleDragOver(e,cat) : undefined}
                  onDrop={reorganize ? e=>handleDrop(e,cat) : undefined}
                  onDragLeave={()=>setDragOverCat(null)}
                  style={{
                    borderRadius:12, transition:'all .2s',
                    border: reorganize && dragOverCat===cat ? `3px dashed ${cfg.c}` : '3px solid transparent',
                    background: reorganize && dragOverCat===cat ? `${cfg.c}10` : 'transparent',
                    padding: reorganize ? 6 : 0,
                  }}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,
                    padding:'10px 16px',background:cfg.bg,borderRadius:12,borderLeft:`5px solid ${cfg.c}`}}>
                    <span style={{fontSize:26}}>{cfg.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:16,color:cfg.c}}>{cfg.label}</div>
                      <div style={{fontSize:11,color:'#94a3b8'}}>{items.length} articles disponibles</div>
                    </div>
                    {isAdmin && !reorganize && (
                      <button onClick={()=>{setRenommerCat({oldKey:cat, oldLabel:cfg.label});setNewCatLabel(cfg.label)}}
                        style={{background:'transparent',border:`1px solid ${cfg.c}`,color:cfg.c,
                          padding:'3px 8px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:600}}>
                        ✏️ Renommer
                      </button>
                    )}
                    {reorganize && (
                      <span style={{fontSize:11,background:`${cfg.c}20`,color:cfg.c,padding:'3px 10px',borderRadius:99,fontWeight:700}}>
                        ← déposer ici
                      </span>
                    )}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:14}}>
                    {items.map(a=>(
                      <div key={a.id}
                        draggable={reorganize}
                        onDragStart={reorganize ? e=>handleDragStart(e,a.id) : undefined}
                        onDragEnd={handleDragEnd}
                        style={{
                          opacity: draggingId===a.id ? .45 : 1,
                          transform: draggingId===a.id ? 'scale(.95)rotate(2deg)' : '',
                          transition:'all .15s',
                          cursor: reorganize ? 'grab' : 'default',
                        }}>
                        <ArticleCard a={a} qty={qty(a)}
                          onAdd={()=>{ if(!reorganize){setTab('caisse');addTo(a)} }}/>
                        {/* ── Boutons admin : CATALOGUE UNIQUEMENT ── */}
                        {isAdmin && !reorganize && (
                          <div style={{display:'flex',gap:6,padding:'8px 4px 0'}}>
                            <button onClick={e=>{e.stopPropagation();setEditArt(a);setArtModal(true)}}
                              style={{flex:1,background:'#eff6ff',color:'#2563eb',border:'1.5px solid #bfdbfe',
                                padding:'8px 0',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
                                display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                              ✏️ Modifier
                            </button>

                            <button onClick={e=>{e.stopPropagation();setDelConfirm(a)}}
                              style={{flex:1,background:'#fef2f2',color:'#dc2626',border:'1.5px solid #fca5a5',
                                padding:'8px 0',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:'inherit',
                                display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                              🗑️ Suppr.
                            </button>
                          </div>
                        )}
                        {isAdmin && reorganize && (
                          <button onClick={e=>{e.stopPropagation();setQuickCatArt(a)}}
                            style={{width:'100%',background:'#f5f3ff',color:'#7c3aed',border:'1.5px solid #c4b5fd',
                              padding:'8px 0',borderRadius:9,cursor:'pointer',fontSize:12,fontWeight:700,
                              fontFamily:'inherit',marginTop:6,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                            ↔️ Changer catégorie
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab==='stock' && (
        <div style={{padding:'0 4px'}}>

          {/* ── HEADER avec KPIs ── */}
          {(() => {
            const totalArticles = articles.length
            const enRupture = articles.filter(a=>(a.stock||0)===0).length
            const faible    = articles.filter(a=>(a.stock||0)>0&&(a.stock||0)<=(a.stock_min||5)).length
            const valeurTot = articles.reduce((s,a)=>s+(a.stock||0)*(a.prix||0),0)
            const totalConso = consos?.length || articles.reduce((s,a)=>s+(a.total_vendu||0),0)
            return (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:12,marginBottom:20}}>
                {[
                  {icon:'📦',label:'Articles',val:totalArticles,    color:'#1e3a8a',bg:'#eff6ff'},
                  {icon:'🔴',label:'En rupture',val:enRupture,      color:'#dc2626',bg:'#fef2f2'},
                  {icon:'⚠️',label:'Stock faible',val:faible,       color:'#d97706',bg:'#fffbeb'},
                  {icon:'📉',label:'Consommés (mois)',val:totalConso,color:'#7c3aed',bg:'#f5f3ff'},
                  {icon:'💰',label:'Valeur stock',val:valeurTot.toLocaleString('fr-FR')+'F',color:'#059669',bg:'#f0fdf4'},
                ].map(k=>(
                  <div key={k.label} style={{background:k.bg,borderRadius:12,padding:'14px 16px',
                    borderLeft:`4px solid ${k.color}`,boxShadow:'0 1px 4px rgba(0,0,0,.05)'}}>
                    <div style={{fontSize:20,marginBottom:4}}>{k.icon}</div>
                    <div style={{fontSize:22,fontWeight:900,color:k.color,lineHeight:1}}>{k.val}</div>
                    <div style={{fontSize:11,color:'#64748b',fontWeight:600,marginTop:3}}>{k.label}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── BARRE d'outils ── */}
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            {/* Recherche */}
            <div style={{position:'relative',flex:1,minWidth:200}}>
              <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'#94a3b8'}}>🔍</span>
              <input
                value={stockFilter||''}
                onChange={e=>setStockFilter(e.target.value)}
                placeholder="Rechercher un article..."
                style={{width:'100%',paddingLeft:38,paddingRight:12,height:38,
                  border:'1.5px solid #e2e8f0',borderRadius:9,fontSize:13,outline:'none',background:'#fff'}}
              />
            </div>
            {/* Catégorie */}
            <select value={stockCatFilter||''} onChange={e=>setStockCatFilter(e.target.value)}
              style={{height:38,border:'1.5px solid #e2e8f0',borderRadius:9,padding:'0 12px',fontSize:13,outline:'none',background:'#fff'}}>
              <option value="">Toutes catégories</option>
              {[...new Set(articles.map(a=>a.categorie).filter(Boolean))].map(c=>(
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {/* Statut */}
            <select value={exclureAchatsInternes?'rupture':''} onChange={e=>setExclureAchatsInternes(e.target.value==='rupture')}
              style={{height:38,border:'1.5px solid #e2e8f0',borderRadius:9,padding:'0 12px',fontSize:13,outline:'none',background:'#fff'}}>
              <option value="">Tous les statuts</option>
              <option value="rupture">🔴 Rupture seulement</option>
            </select>
            {/* Ajout rapide */}
            <button onClick={()=>setStockModal({mode:'in',article:null})}
              style={{height:38,background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
                padding:'0 16px',cursor:'pointer',fontSize:13,fontWeight:700,display:'flex',
                alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
              ➕ Entrée stock
            </button>
          </div>

          {/* ── TABLEAU style Odoo/Shopify ── */}
          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.05)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead>
                <tr style={{background:'#f8fafc'}}>
                  {['Article','Catégorie','Stock actuel','Consommé','Seuil alerte','Valeur stock','Dernière mvt.','Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontWeight:700,
                      fontSize:11,color:'#6b7280',textTransform:'uppercase',letterSpacing:.5,
                      borderBottom:'2px solid #e5e7eb',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles
                  .filter(a => {
                    if (stockCatFilter && a.categorie !== stockCatFilter) return false
                    if (stockFilter && !a.nom?.toLowerCase().includes(stockFilter.toLowerCase())) return false
                    if (exclureAchatsInternes && (a.stock||0) > 0) return false
                    return true
                  })
                  .map((a, i) => {
                    const stock  = a.stock || 0
                    const seuil  = a.stock_min || 5
                    const conso  = a.total_vendu || a.consomme || 0
                    const valeur = stock * (a.prix || 0)
                    const statut = stock === 0 ? 'rupture' : stock <= seuil ? 'faible' : 'ok'
                    const cfg    = getCatCfg(a.categorie)
                    return (
                      <tr key={a.id} style={{borderBottom:'1px solid #f3f4f6',
                        background:i%2===0?'#fff':'#fafafa',transition:'background .12s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='#eff6ff'}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>

                        {/* Article */}
                        <td style={{padding:'12px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <span style={{fontSize:22}}>{cfg.icon}</span>
                            <div>
                              <div style={{fontWeight:700,color:'#111827',fontSize:13}}>{a.nom}</div>
                              <div style={{fontSize:11,color:'#94a3b8',fontFamily:'monospace'}}>REF-{a.id}</div>
                            </div>
                          </div>
                        </td>

                        {/* Catégorie */}
                        <td style={{padding:'12px 14px'}}>
                          <span style={{background:'#f3f4f6',color:'#374151',
                            padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:600}}>
                            {a.categorie||'—'}
                          </span>
                        </td>

                        {/* Stock actuel */}
                        <td style={{padding:'12px 14px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{
                              fontWeight:900,fontSize:18,
                              color: statut==='rupture'?'#dc2626':statut==='faible'?'#d97706':'#059669'
                            }}>
                              {stock}
                            </span>
                            <span style={{
                              fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:99,
                              background: statut==='rupture'?'#fee2e2':statut==='faible'?'#fef3c7':'#d1fae5',
                              color:      statut==='rupture'?'#dc2626':statut==='faible'?'#92400e':'#059669'
                            }}>
                              {statut==='rupture'?'RUPTURE':statut==='faible'?'FAIBLE':'OK'}
                            </span>
                          </div>
                          {/* Barre de stock */}
                          <div style={{marginTop:4,background:'#f3f4f6',borderRadius:99,height:4,width:80}}>
                            <div style={{
                              width:`${Math.min(100,Math.round(stock/(Math.max(stock,seuil*2)||1)*100))}%`,
                              height:'100%',borderRadius:99,
                              background: statut==='rupture'?'#dc2626':statut==='faible'?'#f59e0b':'#10b981',
                              transition:'width .4s'
                            }}/>
                          </div>
                        </td>

                        {/* Consommé */}
                        <td style={{padding:'12px 14px'}}>
                          <div style={{fontWeight:700,fontSize:16,color:'#7c3aed'}}>{conso}</div>
                          <div style={{fontSize:10,color:'#94a3b8'}}>unités / mois</div>
                        </td>

                        {/* Seuil alerte */}
                        <td style={{padding:'12px 14px',color:'#6b7280',fontWeight:600}}>{seuil}</td>

                        {/* Valeur stock */}
                        <td style={{padding:'12px 14px'}}>
                          <div style={{fontWeight:700,color:'#059669',fontFamily:'monospace'}}>
                            {valeur.toLocaleString('fr-FR')} F
                          </div>
                        </td>

                        {/* Dernière mvt */}
                        <td style={{padding:'12px 14px',color:'#94a3b8',fontSize:11}}>
                          {a.updated_at ? new Date(a.updated_at).toLocaleDateString('fr-FR') : '—'}
                        </td>

                        {/* Actions */}
                        <td style={{padding:'12px 14px'}}>
                          <div style={{display:'flex',gap:6}}>
                            <button onClick={()=>setStockModal({mode:'in',article:a})}
                              title="Entrée stock"
                              style={{background:'#d1fae5',color:'#059669',border:'none',borderRadius:7,
                                padding:'5px 10px',cursor:'pointer',fontSize:12,fontWeight:700}}>
                              ↑ In
                            </button>
                            <button onClick={()=>setStockModal({mode:'out',article:a})}
                              title="Sortie stock"
                              disabled={stock===0}
                              style={{background:stock===0?'#f3f4f6':'#fee2e2',
                                color:stock===0?'#d1d5db':'#dc2626',
                                border:'none',borderRadius:7,padding:'5px 10px',
                                cursor:stock===0?'not-allowed':'pointer',fontSize:12,fontWeight:700}}>
                              ↓ Out
                            </button>
                            <button onClick={()=>setStockModal({mode:'edit',article:a})}
                              title="Modifier"
                              style={{background:'#eff6ff',color:'#1e3a8a',border:'none',borderRadius:7,
                                padding:'5px 8px',cursor:'pointer',fontSize:12}}>
                              ✏️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              {/* Footer totaux */}
              <tfoot>
                <tr style={{background:'#f8fafc',borderTop:'2px solid #e5e7eb'}}>
                  <td colSpan={2} style={{padding:'10px 14px',fontWeight:700,fontSize:12,color:'#374151'}}>
                    TOTAUX ({articles.filter(a=>{
                      if(stockCatFilter&&a.categorie!==stockCatFilter)return false
                      if(stockFilter&&!a.nom?.toLowerCase().includes(stockFilter.toLowerCase()))return false
                      return true
                    }).length} articles)
                  </td>
                  <td style={{padding:'10px 14px',fontWeight:900,color:'#1e3a8a'}}>
                    {articles.reduce((s,a)=>s+(a.stock||0),0)} u.
                  </td>
                  <td style={{padding:'10px 14px',fontWeight:900,color:'#7c3aed'}}>
                    {articles.reduce((s,a)=>s+(a.total_vendu||a.consomme||0),0)} u.
                  </td>
                  <td colSpan={2} style={{padding:'10px 14px',fontWeight:900,color:'#059669'}}>
                    {articles.reduce((s,a)=>s+(a.stock||0)*(a.prix||0),0).toLocaleString('fr-FR')} F
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── RAPPORT DE CONSOMMATION ── */}
          <div style={{marginTop:20,background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',padding:20}}>
            <div style={{fontWeight:800,fontSize:15,color:'#1e3a8a',marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
              📊 Rapport de consommation
              <span style={{fontSize:11,color:'#94a3b8',fontWeight:500}}>Top articles consommés ce mois</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[...articles]
                .filter(a=>a.total_vendu||a.consomme)
                .sort((a,b)=>((b.total_vendu||b.consomme||0)-(a.total_vendu||a.consomme||0)))
                .slice(0,8)
                .map((a,i)=>{
                  const conso = a.total_vendu||a.consomme||0
                  const maxConso = articles.reduce((m,x)=>Math.max(m,x.total_vendu||x.consomme||0),1)
                  const cfg = getCatCfg(a.categorie)
                  return (
                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:24,height:24,borderRadius:6,background:'#f3f4f6',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:11,fontWeight:800,color:'#6b7280',flexShrink:0}}>
                        {i+1}
                      </div>
                      <span style={{fontSize:18,flexShrink:0}}>{cfg.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:'#111827',marginBottom:2}}>{a.nom}</div>
                        <div style={{background:'#f3f4f6',borderRadius:99,height:6,overflow:'hidden'}}>
                          <div style={{
                            width:`${Math.round(conso/maxConso*100)}%`,
                            height:'100%',borderRadius:99,
                            background:'linear-gradient(90deg,#7c3aed,#a78bfa)',
                            transition:'width .5s'
                          }}/>
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontWeight:900,fontSize:15,color:'#7c3aed'}}>{conso}</div>
                        <div style={{fontSize:10,color:'#94a3b8'}}>unités</div>
                      </div>
                    </div>
                  )
                })}
              {articles.every(a=>!(a.total_vendu||a.consomme)) && (
                <div style={{textAlign:'center',color:'#94a3b8',padding:20,fontSize:13}}>
                  Aucune consommation enregistrée ce mois
                </div>
              )}
            </div>
          </div>

        </div>
      {tab==='analyses' && (
        <AnalysesPanel
          periode={analysesPeriode}
          onPeriodeChange={setAnalysesPeriode}
          data={analyses}
          loading={analysesLoading}
          onLoad={async (p) => {
            setAnalysesLoading(true)
            try {
              const r = await boutiqueAPI.analyses({periode:p})
              const d = r.data
              setAnalyses({
                periode: d.periode||p, total_ca: d.total_ca||0, total_qte: d.total_qte||0,
                nb_transactions: d.nb_transactions||0, top_articles: d.top_articles||[],
                top_agents: d.top_agents||[], par_categorie: d.par_categorie||[], evolution: d.evolution||[]
              })
            } catch(e) {
              console.error('Analyses error:', e)
              setAnalyses({periode:p,total_ca:0,total_qte:0,nb_transactions:0,
                top_articles:[],top_agents:[],par_categorie:[],evolution:[]})
            } finally { setAnalysesLoading(false) }
          }}
        />
      )}

      {/* ══ ONGLET BONS DE CAISSE ══ */}
      {tab==='bons' && isAdmin && (
        <GererBonsPanel
          bons={bonsAll}
          personnel={personnel}
          annee={new Date().getFullYear()}
          onRefresh={()=>{
            boutiqueAPI.bons({annee:new Date().getFullYear()}).then(r=>{
              setBonsAll(r.data.results||r.data||[])
            }).catch(()=>{})
          }}
        />
      )}



      {/* ══ MODAL RENOMMER CATÉGORIE ══ */}
      {renommerCat && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:2100,padding:20}}
          onClick={e=>e.target===e.currentTarget&&setRenommerCat(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:400,
            overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#1e3a8a,#2563eb)',color:'#fff',
              padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>✏️ Renommer la catégorie</div>
                <div style={{fontSize:11,opacity:.8}}>Actuel: {renommerCat.oldLabel}</div>
              </div>
              <button onClick={()=>setRenommerCat(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20}}>
              <div style={{fontSize:12,color:'#64748b',marginBottom:8}}>
                Nouveau nom affiché (le code interne reste "{renommerCat.oldKey}")
              </div>
              <input value={newCatLabel} onChange={e=>setNewCatLabel(e.target.value)}
                placeholder="Nouveau nom de la catégorie..."
                style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,padding:'10px 12px',
                  fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              <div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>
                ⚠️ Le renommage est local à cette session. Pour persister, modifiez le code du site.
              </div>
              <div style={{display:'flex',gap:8,marginTop:14}}>
                <button onClick={()=>{
                  // Mettre à jour CAT_DEFAULTS localement via localStorage
                  const overrides = JSON.parse(localStorage.getItem('cat_labels')||'{}')
                  overrides[renommerCat.oldKey] = newCatLabel
                  localStorage.setItem('cat_labels', JSON.stringify(overrides))
                  setRenommerCat(null)
                  // Forcer re-render
                  window.location.reload()
                }}
                  style={{flex:1,background:'#1e3a8a',color:'#fff',border:'none',padding:'10px',
                    borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:'inherit'}}>
                  💾 Enregistrer (session)
                </button>
                <button onClick={()=>setRenommerCat(null)}
                  style={{flex:1,background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',
                    padding:'10px',borderRadius:9,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL GESTION STOCK ══ */}
      {stockModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:2100,padding:20}}
          onClick={e=>e.target===e.currentTarget&&setStockModal(null)}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:400,
            overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#16a34a,#15803d)',color:'#fff',
              padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>📦 Gestion du Stock</div>
                <div style={{fontSize:11,opacity:.8}}>{stockModal.nom} — Stock actuel: <b>{stockModal.stock}</b></div>
              </div>
              <button onClick={()=>setStockModal(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',
                  width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{display:'flex',gap:8}}>
                {[['add','➕ Entrée','#16a34a'],['subtract','➖ Sortie','#f97316'],['set','🔢 Ajuster','#1e3a8a']].map(([op,l,c])=>(
                  <button key={op} onClick={()=>setStockOp(op)}
                    style={{flex:1,padding:'8px 4px',borderRadius:9,cursor:'pointer',fontFamily:'inherit',
                      fontSize:11,fontWeight:700,border:'none',
                      background:stockOp===op?c:'#f8fafc',
                      color:stockOp===op?'#fff':'#64748b'}}>
                    {l}
                  </button>
                ))}
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>
                  QUANTITÉ
                </label>
                <input type="number" value={stockQte}
                  onChange={e=>setStockQte(parseInt(e.target.value)||0)}
                  min={0} style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,
                    padding:'10px 12px',fontSize:16,fontWeight:700,outline:'none',boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:4}}>
                  RAISON (optionnel)
                </label>
                <input value={stockRaison} onChange={e=>setStockRaison(e.target.value)}
                  placeholder="Livraison, inventaire, casse..."
                  style={{width:'100%',border:'2px solid #e2e8f0',borderRadius:9,
                    padding:'10px 12px',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>
              {stockQte>0 && (
                <div style={{background:'#f8fafc',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#64748b'}}>
                  Stock après opération:{' '}
                  <b style={{color:'#1e3a8a'}}>
                    {stockOp==='set' ? stockQte :
                     stockOp==='add' ? (stockModal.stock+stockQte) :
                     Math.max(0, stockModal.stock-stockQte)} unités
                  </b>
                </div>
              )}
              <button onClick={async()=>{
                try {
                  await boutiqueAPI.updateStock(stockModal.id,{operation:stockOp,quantite:stockQte,raison:stockRaison})
                  setStockModal(null)
                  // Rafraîchir les articles
                  boutiqueAPI.articles({page_size:200}).then(r=>setArticles(r.data.results||r.data||[]))
                } catch(e) { alert(e.response?.data?.error||'Erreur stock') }
              }}
                style={{background:'#16a34a',color:'#fff',border:'none',padding:12,
                  borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
                ✅ Confirmer la mise à jour du stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CHANGEMENT RAPIDE CATÉGORIE ══ */}
      {quickCatArt && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}
          onClick={e=>e.target===e.currentTarget&&setQuickCatArt(null)}>
          <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:440,overflow:'hidden',
            boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#5b21b6,#7c3aed)',color:'#fff',
              padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>↔️ Changer la catégorie</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,.7)',marginTop:2}}>
                  {quickCatArt.nom}
                </div>
              </div>
              <button onClick={()=>setQuickCatArt(null)}
                style={{background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:30,height:30,borderRadius:8,cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <div style={{padding:16}}>
              <div style={{fontSize:11,fontWeight:700,color:'#64748b',marginBottom:10,textTransform:'uppercase',letterSpacing:.8}}>
                Catégorie actuelle: <span style={{color:getCatCfg(quickCatArt.categorie).c}}>
                  {getCatCfg(quickCatArt.categorie).icon} {getCatCfg(quickCatArt.categorie).label}
                </span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {catOrder.map(k => {
                  const cfg = getCatCfg(k)
                  const isCurrent = k === quickCatArt.categorie
                  return (
                    <button key={k} onClick={()=>handleQuickCat(quickCatArt.id, k)}
                      disabled={isCurrent}
                      style={{
                        padding:'10px 12px', borderRadius:10, cursor:isCurrent?'default':'pointer',
                        border:`2px solid ${isCurrent?cfg.c:'#e2e8f0'}`,
                        background:isCurrent?`${cfg.c}15`:'#fff',
                        display:'flex',alignItems:'center',gap:8,
                        opacity:isCurrent?1:.85, fontFamily:'inherit',
                        transition:'all .15s',
                      }}
                      onMouseEnter={e=>{if(!isCurrent){e.currentTarget.style.borderColor=cfg.c;e.currentTarget.style.background=`${cfg.c}10`}}}
                      onMouseLeave={e=>{if(!isCurrent){e.currentTarget.style.borderColor='#e2e8f0';e.currentTarget.style.background='#fff'}}}>
                      <span style={{fontSize:18}}>{cfg.icon}</span>
                      <div style={{textAlign:'left'}}>
                        <div style={{fontSize:12,fontWeight:700,color:cfg.c}}>{cfg.label}</div>
                        {isCurrent && <div style={{fontSize:9,color:'#94a3b8'}}>catégorie actuelle</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
              <div style={{marginTop:12,textAlign:'center'}}>
                <button onClick={()=>setQuickCatArt(null)}
                  style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0',padding:'8px 24px',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:13}}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL CRÉER/MODIFIER ══ */}
      {artModal && (
        <ArticleModal
          article={editArt}
          categories={catOrder}
          onSave={editArt ? handleEdit : handleCreate}
          onClose={()=>{setArtModal(false);setEditArt(null)}}
        />
      )}

      {/* ══ CONFIRMATION SUPPRESSION ══ */}
      {delConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(15,36,71,.7)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,padding:20}}>
          <div style={{background:'#fff',borderRadius:18,width:'100%',maxWidth:380,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{background:'linear-gradient(135deg,#991b1b,#dc2626)',color:'#fff',padding:'14px 20px',fontWeight:700,fontSize:15}}>
              🗑️ Supprimer l'article
            </div>
            <div style={{padding:20}}>
              <div style={{fontSize:15,color:'#1e293b',marginBottom:6,fontWeight:600}}>{delConfirm.nom}</div>
              <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>
                Cette action est irréversible. L'article sera définitivement supprimé du catalogue.
              </div>
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>setDelConfirm(null)}
                  style={{flex:1,background:'#f8fafc',color:'#475569',border:'1px solid #e2e8f0',padding:12,borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:14}}>
                  Annuler
                </button>
                <button onClick={()=>handleDelete(delConfirm)}
                  style={{flex:1,background:'#dc2626',color:'#fff',border:'none',padding:12,borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700}}>
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
