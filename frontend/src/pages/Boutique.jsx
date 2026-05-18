import React, { useState, useEffect } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const CAT_COLORS = {
  boisson:   { bg:'#dbeafe', color:'#1d4ed8', icon:'🥤' },
  snack:     { bg:'#fef3c7', color:'#92400e', icon:'🍿' },
  hygiene:   { bg:'#dcfce7', color:'#166534', icon:'🧼' },
  cigarette: { bg:'#f3f4f6', color:'#374151', icon:'🚬' },
  autre:     { bg:'#ede9fe', color:'#5b21b6', icon:'📦' },
}

export default function Boutique() {
  const { user } = useStore()
  const isAdmin = user?.is_staff || user?.is_superuser || user?.profile?.role === 'admin'

  const [articles,    setArticles]    = useState([])
  const [consos,      setConsos]      = useState([])
  const [personnel,   setPersonnel]   = useState([])
  const [statsJour,   setStatsJour]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('caisse')
  const [form,        setForm]        = useState({ personnel:'', article:'', quantite:1, notes:'' })
  const [submitting,  setSubmitting]  = useState(false)
  const [msg,         setMsg]         = useState(null)
  const [artModal,    setArtModal]    = useState(false)
  const [artForm,     setArtForm]     = useState({ nom:'', categorie:'boisson', prix:0, stock:0, unite:'pièce' })

  const load = () => {
    setLoading(true)
    Promise.all([
      boutiqueAPI.articles(),
      boutiqueAPI.consommations({ page_size:50 }),
      boutiqueAPI.statsJour(),
      personnelAPI.list({ page_size:200 }),
    ]).then(([ra, rc, rs, rp]) => {
      setArticles(ra.data.results || ra.data || [])
      setConsos(rc.data.results || rc.data || [])
      setStatsJour(rs.data)
      setPersonnel(rp.data.results || rp.data || [])
    }).catch(()=>{}).finally(()=>setLoading(false))
  }
  useEffect(()=>{ load() }, [])

  const selectedArticle = articles.find(a => a.id === parseInt(form.article))
  const totalSelect = selectedArticle ? (selectedArticle.prix * form.quantite) : 0

  const submitConso = async () => {
    if (!form.article) return setMsg({type:'error', text:'Sélectionnez un article'})
    setSubmitting(true); setMsg(null)
    try {
      await boutiqueAPI.addConso({
        article:   parseInt(form.article),
        personnel: form.personnel ? parseInt(form.personnel) : null,
        quantite:  parseInt(form.quantite),
        notes:     form.notes,
      })
      setMsg({type:'success', text:`✅ Consommation enregistrée — ${totalSelect.toLocaleString()} FCFA`})
      setForm(f => ({...f, article:'', quantite:1, notes:''}))
      load()
    } catch(e) { setMsg({type:'error', text:e.response?.data?.detail||'Erreur'}) }
    finally { setSubmitting(false) }
  }

  const createArticle = async () => {
    try {
      await boutiqueAPI.createArticle(artForm)
      setArtModal(false)
      load()
    } catch(e) { alert(e.response?.data?.detail||'Erreur') }
  }

  const inp = { width:'100%', border:'2px solid #e2e8f0', borderRadius:9, padding:'10px 12px', fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }

  return (
    <div style={{ padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a8a', margin:0 }}>🛒 Bar & Boutique</h2>
          <p style={{ fontSize:12, color:'#64748b', margin:'4px 0 0' }}>Gestion des consommations · Articles · Statistiques</p>
        </div>
        {isAdmin && (
          <button onClick={()=>setArtModal(true)}
            style={{ background:'#1e3a8a', color:'#fff', border:'none', padding:'9px 18px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            + Nouvel article
          </button>
        )}
      </div>

      {/* Stats du jour */}
      {statsJour && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:18 }}>
          {[
            ['Consommations', statsJour.total, '🛒', '#2563eb'],
            ['Chiffre du jour', `${(statsJour.montant||0).toLocaleString()} FCFA`, '💰', '#16a34a'],
            ['Articles actifs', articles.length, '📦', '#7c3aed'],
          ].map(([l,v,ic,c]) => (
            <div key={l} style={{ background:'#fff', border:'1px solid #e2e8f0', borderTop:`3px solid ${c}`, borderRadius:12, padding:'14px 16px' }}>
              <div style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:'#94a3b8', textTransform:'uppercase', letterSpacing:1, marginTop:4 }}>{ic} {l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {[['caisse','🛒 Caisse'],['historique','📋 Historique'],['catalogue','📦 Catalogue']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)}
            style={{ padding:'8px 16px', borderRadius:10, border:'1px solid', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:'inherit',
              background:tab===k?'#1e3a8a':'#fff', color:tab===k?'#fff':'#475569', borderColor:tab===k?'#1e3a8a':'#e2e8f0' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── CAISSE ── */}
      {tab === 'caisse' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* Formulaire */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20 }}>
            <h3 style={{ fontWeight:700, color:'#1e3a8a', marginBottom:16, fontSize:15 }}>Nouvelle consommation</h3>
            {msg && (
              <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:14, fontSize:13, fontWeight:600,
                background:msg.type==='success'?'#f0fdf4':'#fef2f2',
                color:msg.type==='success'?'#166534':'#991b1b',
                border:`1px solid ${msg.type==='success'?'#bbf7d0':'#fecaca'}`}}>
                {msg.text}
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>
                  Agent (optionnel)
                </label>
                <select value={form.personnel} onChange={e=>setForm({...form,personnel:e.target.value})} style={inp}>
                  <option value="">-- Client anonyme --</option>
                  {personnel.map(p=><option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>
                  Article *
                </label>
                <select value={form.article} onChange={e=>setForm({...form,article:e.target.value})} style={inp}>
                  <option value="">Sélectionner un article…</option>
                  {Object.entries(articles.reduce((a,art)=>{
                    const c=art.categorie; if(!a[c]) a[c]=[];a[c].push(art);return a;
                  },{})).map(([cat,arts])=>(
                    <optgroup key={cat} label={`${CAT_COLORS[cat]?.icon||'📦'} ${cat.charAt(0).toUpperCase()+cat.slice(1)}`}>
                      {arts.map(a=><option key={a.id} value={a.id}>{a.nom} — {parseInt(a.prix).toLocaleString()} FCFA</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', marginBottom:5, textTransform:'uppercase' }}>
                  Quantité
                </label>
                <input type="number" min={1} value={form.quantite} onChange={e=>setForm({...form,quantite:Math.max(1,parseInt(e.target.value)||1)})} style={inp}/>
              </div>

              {/* Montant */}
              {selectedArticle && (
                <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:10, padding:'12px 14px' }}>
                  <div style={{ fontSize:11, color:'#0369a1', fontWeight:700, marginBottom:4 }}>Récapitulatif</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span>{selectedArticle.nom} × {form.quantite}</span>
                    <span style={{ fontWeight:800, fontSize:16, color:'#1e3a8a' }}>{totalSelect.toLocaleString()} FCFA</span>
                  </div>
                </div>
              )}

              <button onClick={submitConso} disabled={submitting || !form.article}
                style={{ background:submitting||!form.article?'#94a3b8':'#1e3a8a', color:'#fff', border:'none', padding:13, borderRadius:10, cursor:'pointer', fontSize:15, fontWeight:700 }}>
                {submitting ? '⏳ Enregistrement…' : '✅ Valider la consommation'}
              </button>
            </div>
          </div>

          {/* Articles rapides */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:20 }}>
            <h3 style={{ fontWeight:700, color:'#1e3a8a', marginBottom:14, fontSize:15 }}>Articles disponibles</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:400, overflowY:'auto' }}>
              {articles.map(a => {
                const cat = CAT_COLORS[a.categorie] || CAT_COLORS.autre
                return (
                  <div key={a.id}
                    onClick={()=>setForm(f=>({...f, article: String(a.id)}))}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', borderRadius:10,
                      background: form.article===String(a.id) ? '#eff6ff' : '#f8fafc',
                      border: `1.5px solid ${form.article===String(a.id) ? '#2563eb' : '#f1f5f9'}`,
                      cursor:'pointer', transition:'.15s' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:cat.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:'#1e293b' }}>{a.nom}</div>
                      <div style={{ fontSize:11, color:'#94a3b8' }}>{a.unite}</div>
                    </div>
                    <div style={{ fontWeight:800, color:'#1e3a8a', fontSize:13, flexShrink:0 }}>
                      {parseInt(a.prix).toLocaleString()} FCFA
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIQUE ── */}
      {tab === 'historique' && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, overflow:'hidden' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:500 }}>
              <thead>
                <tr style={{ background:'linear-gradient(135deg, #0f2447, #1e3a8a)' }}>
                  {['Heure','Agent','Article','Qté','Montant','Validé par'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:10.5, fontWeight:700, letterSpacing:.8, textTransform:'uppercase', color:'rgba(255,255,255,.85)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {consos.map((c,i)=>(
                  <tr key={c.id} style={{ borderTop:'1px solid #f1f5f9', background:i%2?'#fafafa':'#fff' }}>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>
                      {new Date(c.date_conso).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600 }}>{c.personnel_nom||'—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12 }}>{c.article_nom}</td>
                    <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12 }}>{c.quantite}</td>
                    <td style={{ padding:'10px 14px', fontWeight:700, color:'#1e3a8a' }}>{parseInt(c.montant).toLocaleString()} FCFA</td>
                    <td style={{ padding:'10px 14px', fontSize:11, color:'#94a3b8' }}>{c.valide_par_nom||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CATALOGUE ── */}
      {tab === 'catalogue' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
          {articles.map(a=>{
            const cat = CAT_COLORS[a.categorie]||CAT_COLORS.autre
            return (
              <div key={a.id} style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:16, boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ width:48, height:48, borderRadius:12, background:cat.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, marginBottom:10 }}>
                  {cat.icon}
                </div>
                <div style={{ fontWeight:700, fontSize:13, color:'#1e293b', marginBottom:4 }}>{a.nom}</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginBottom:8 }}>{a.unite}</div>
                <div style={{ fontWeight:800, color:'#1e3a8a', fontSize:15 }}>{parseInt(a.prix).toLocaleString()} FCFA</div>
                {a.stock > 0 && <div style={{ fontSize:10, color:'#16a34a', marginTop:4 }}>Stock: {a.stock}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal créer article */}
      {artModal && isAdmin && (
        <div style={{ position:'fixed',inset:0,background:'rgba(15,36,71,.65)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setArtModal(false)}>
          <div style={{ background:'#fff',borderRadius:16,width:'100%',maxWidth:400,overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(135deg,#0f2447,#1e3a8a)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{ fontWeight:700,fontSize:15 }}>+ Nouvel article</span>
              <button onClick={()=>setArtModal(false)} style={{ background:'rgba(255,255,255,.2)',border:'none',color:'#fff',width:28,height:28,borderRadius:8,cursor:'pointer',fontSize:16 }}>✕</button>
            </div>
            <div style={{ padding:20,display:'flex',flexDirection:'column',gap:12 }}>
              {[['Nom *','nom','text'],['Prix (FCFA) *','prix','number'],['Stock','stock','number'],['Unité','unite','text']].map(([l,f,t])=>(
                <div key={f}>
                  <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase' }}>{l}</label>
                  <input type={t} value={artForm[f]||''} onChange={e=>setArtForm({...artForm,[f]:e.target.value})} style={inp}/>
                </div>
              ))}
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#64748b',marginBottom:5,textTransform:'uppercase' }}>Catégorie</label>
                <select value={artForm.categorie} onChange={e=>setArtForm({...artForm,categorie:e.target.value})} style={inp}>
                  {[['boisson','Boisson'],['snack','Snack'],['hygiene','Hygiène'],['cigarette','Cigarette'],['autre','Autre']].map(([v,l])=>(
                    <option key={v} value={v}>{l}</option>
                  ))}
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
