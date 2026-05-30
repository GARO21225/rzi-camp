/**
 * Boutique POS — Caisse simplifiée avec historique
 * Fonctionne desktop ET mobile
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { boutique as boutiqueAPI, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

export default function BoutiquePOS() {
  const { user } = useStore()
  const isAdmin = !!(user?.is_staff || user?.is_superuser)

  const [waking,     setWaking]     = useState(false)
  const [articles,   setArticles]   = useState([])
  const [consos,     setConsos]     = useState([])
  const [personnel,  setPersonnel]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('caisse')
  const [panier,     setPanier]     = useState([])
  const [agentId,    setAgentId]    = useState('')
  const [agentInfo,  setAgentInfo]  = useState(null)
  const [bonAgent,   setBonAgent]   = useState(null)
  const [modePay,    setModePay]    = useState(null) // 'especes' | 'bon'
  const [catFilter,  setCatFilter]  = useState('')
  const [search,     setSearch]     = useState('')
  const [scanning,   setScanning]   = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [statsJour,  setStatsJour]  = useState({total:0, montant:0})
  const scannerRef = useRef(null)

  const load = useCallback(async () => {
    setWaking(true)
    try {
      const [ra, rc, rp] = await Promise.all([
        boutiqueAPI.articles(),
        boutiqueAPI.consommations({ page_size: 100 }),
        personnelAPI.list({ page_size: 200 }),
      ])
      const arts = ra.data.results || ra.data || []
      const cons = rc.data.results || rc.data || []
      setArticles(arts)
      setConsos(cons)
      setPersonnel(rp.data.results || rp.data || [])
      // Stats du jour
      const today = new Date().toISOString().slice(0, 10)
      const todayCons = cons.filter(c => c.date_conso?.slice(0, 10) === today)
      setStatsJour({
        total: todayCons.length,
        montant: todayCons.reduce((s, c) => s + parseInt(c.montant || 0), 0)
      })
    } catch(e) { console.error(e) }
    finally { setLoading(false); setWaking(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!agentId) { setAgentInfo(null); setBonAgent(null); return }
    const p = personnel.find(x =>
      x.qr_code_string === agentId || String(x.id) === agentId || x.login_genere === agentId
    ) || null
    setAgentInfo(p)
    if (p) boutiqueAPI.soldePersonnel(p.id).then(r => setBonAgent(r.data)).catch(() => setBonAgent(null))
  }, [agentId, personnel])

  const startScan = async () => {
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const sc = new Html5Qrcode('qr_pos')
      scannerRef.current = sc
      await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: 200 },
        text => { setAgentId(text); stopScan() }, () => {})
    } catch { setScanning(false) }
  }
  const stopScan = () => {
    setScanning(false)
    scannerRef.current?.stop().catch(() => {})
    scannerRef.current = null
  }

  const addTo   = a => setPanier(p => { const ex = p.find(x => x.a.id === a.id); return ex ? p.map(x => x.a.id === a.id ? {...x, q: x.q+1} : x) : [...p, {a, q:1}] })
  const decFrom = id => setPanier(p => { const ex = p.find(x => x.a.id === id); return ex?.q > 1 ? p.map(x => x.a.id === id ? {...x, q: x.q-1} : x) : p.filter(x => x.a.id !== id) })
  const total   = panier.reduce((s, x) => s + x.a.prix * x.q, 0)

  const valider = async () => {
    if (!panier.length) return setMsg({ type: 'error', text: 'Panier vide' })
    if (!modePay) return setMsg({ type: 'error', text: 'Choisir un mode de paiement' })
    if (modePay === 'bon' && !agentInfo) return setMsg({ type: 'error', text: 'Scanner un agent pour payer par bon' })
    if (modePay === 'bon' && bonAgent && total > bonAgent.credit_restant)
      return setMsg({ type: 'error', text: `Solde insuffisant — ${bonAgent.credit_restant.toLocaleString()} FCFA` })
    
    setSubmitting(true)
    setMsg({ type: 'info', text: '⏳ Traitement...' })
    
    const BASE = (import.meta?.env?.VITE_API_URL || window.location.origin.replace('frontend','backend')).replace(/\/+$/,'')
    const token = localStorage.getItem('access_token') || ''
    
    let allOk = true
    let lastError = ''
    
    for (const { a, q } of panier) {
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 25000)
        const resp = await fetch(`${BASE}/api/boutique/consommations/`, {
          method: 'POST',
          signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ article: a.id, personnel: agentInfo?.id || null, quantite: q, mode_paiement: modePay })
        })
        clearTimeout(timer)
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          lastError = errData.detail || errData.debug || `Erreur ${resp.status}`
          allOk = false
          break
        }
      } catch(e) {
        lastError = e.name === 'AbortError' ? 'Délai dépassé (25s)' : e.message
        allOk = false
        break
      }
    }
    
    if (allOk) {
      setMsg({ type: 'success', text: `✅ ${modePay === 'bon' ? 'Payé par bon' : 'Espèces'} — ${total.toLocaleString()} FCFA` })
      setPanier([]); setAgentId(''); setAgentInfo(null); setBonAgent(null); setModePay(null)
      load()
      setTimeout(() => setMsg(null), 4000)
    } else {
      setMsg({ type: 'error', text: `❌ Erreur: ${lastError}` })
    }
    setSubmitting(false)
  }

  const cats = [...new Set(articles.filter(a => a.actif).map(a => a.categorie))]
  const filtered = articles.filter(a => {
    if (!a.actif) return false
    if (catFilter && a.categorie !== catFilter) return false
    if (search && !a.nom.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const inp = { border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 12px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: '0 auto', fontFamily: 'inherit' }}>

      {/* Banner réveil serveur */}
      {waking && (
        <div style={{ background:'#f59e0b', color:'#fff', padding:'8px 16px',
          borderRadius:10, marginBottom:12, fontSize:12, fontWeight:700,
          display:'flex', alignItems:'center', gap:8 }}>
          ⏳ Connexion au serveur en cours (peut prendre ~30s la 1ère fois)...
        </div>
      )}

      {/* Header stats */}
      <div style={{ background: 'linear-gradient(135deg,#0f2447,#1e3a8a)', borderRadius: 16, padding: '16px 20px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>🛒 Bar & Boutique — Caisse</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            ['🧾 Ventes aujourd\'hui', statsJour.total, '#f0a500'],
            ['💰 CA du jour', `${statsJour.montant.toLocaleString()} FCFA`, '#4ade80'],
            ['📦 Articles dispo', articles.filter(a=>a.actif).length, '#93c5fd'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 16 }}>
        {[['caisse', '🛒 Caisse'], ['historique', '📋 Historique']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '9px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
              background: 'transparent', color: tab === k ? '#1e3a8a' : '#64748b',
              borderBottom: `3px solid ${tab === k ? '#1e3a8a' : 'transparent'}`, marginBottom: -2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* ══ CAISSE ══ */}
      {tab === 'caisse' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>

          {/* Grille articles */}
          <div>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
                style={{ ...inp, maxWidth: 180, width: 'auto', padding: '7px 12px', fontSize: 12 }} />
              <button onClick={() => setCatFilter('')}
                style={{ padding: '6px 12px', borderRadius: 99, border: '2px solid', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: !catFilter ? '#1e3a8a' : '#fff', color: !catFilter ? '#fff' : '#475569',
                  borderColor: !catFilter ? '#1e3a8a' : '#e2e8f0' }}>Tout</button>
              {cats.map(c => (
                <button key={c} onClick={() => setCatFilter(catFilter === c ? '' : c)}
                  style={{ padding: '6px 12px', borderRadius: 99, border: '2px solid #e2e8f0', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, background: catFilter === c ? '#1e3a8a' : '#fff',
                    color: catFilter === c ? '#fff' : '#475569', borderColor: catFilter === c ? '#1e3a8a' : '#e2e8f0' }}>
                  {c}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, fontSize: 36 }}>⏳</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                {filtered.map(a => {
                  const inCart = panier.find(x => x.a.id === a.id)
                  return (
                    <button key={a.id} onClick={() => addTo(a)}
                      style={{ background: '#fff', border: `2px solid ${inCart ? '#1e3a8a' : '#e2e8f0'}`,
                        borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        position: 'relative', boxShadow: inCart ? '0 0 0 3px #1e3a8a30' : '0 1px 4px rgba(0,0,0,.06)' }}>
                      {inCart && (
                        <div style={{ position: 'absolute', top: -7, right: -7, background: '#1e3a8a', color: '#fff',
                          borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{inCart.q}</div>
                      )}
                      <div style={{ fontSize: 28, marginBottom: 6, textAlign: 'center' }}>🛒</div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nom}</div>
                      <div style={{ fontWeight: 900, color: '#1e3a8a', fontSize: 13, fontFamily: 'monospace' }}>
                        {parseInt(a.prix).toLocaleString()} <span style={{ fontSize: 9, color: '#94a3b8' }}>FCFA</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Stock: {a.stock}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Panneau droite: agent + panier */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Agent */}
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#0f2447,#1e3a8a)', color: '#fff', fontWeight: 700, fontSize: 12 }}>
                👤 Agent (optionnel)
              </div>
              <div style={{ padding: 12 }}>
                <button onClick={scanning ? stopScan : startScan}
                  style={{ width: '100%', background: scanning ? '#dc2626' : '#1e3a8a', color: '#fff', border: 'none',
                    padding: 9, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  {scanning ? '⏹ Arrêter' : '📷 Scanner QR'}
                </button>
                {scanning && <div id="qr_pos" style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8 }} />}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={agentId} onChange={e => setAgentId(e.target.value)} placeholder="Login ou ID..."
                    style={{ ...inp, fontSize: 12, padding: '7px 10px' }} />
                  {agentId && <button onClick={() => { setAgentId(''); setAgentInfo(null); setBonAgent(null) }}
                    style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', cursor: 'pointer' }}>✕</button>}
                </div>
                {agentInfo && (
                  <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#166534' }}>{agentInfo.prenom} {agentInfo.nom}</div>
                    {bonAgent && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>🎫 Bon de caisse</div>
                        <div style={{ background: '#e2e8f0', borderRadius: 99, height: 5, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: `${Math.max(2, 100 - bonAgent.pourcentage)}%`, borderRadius: 99,
                            background: bonAgent.credit_restant > 30000 ? '#16a34a' : bonAgent.credit_restant > 10000 ? '#f59e0b' : '#dc2626' }} />
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: '#1e3a8a', fontFamily: 'monospace' }}>
                          {parseInt(bonAgent.credit_restant).toLocaleString()} FCFA
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Panier */}
            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <div style={{ padding: '10px 14px', background: 'linear-gradient(135deg,#0f2447,#1e3a8a)', color: '#fff',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>🛒 Panier ({panier.length})</span>
                {panier.length > 0 && <button onClick={() => setPanier([])}
                  style={{ background: 'rgba(220,38,38,.4)', border: 'none', color: '#fff', padding: '2px 8px', borderRadius: 99, cursor: 'pointer', fontSize: 11 }}>Vider</button>}
              </div>
              <div style={{ padding: 12 }}>
                {panier.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: '16px 0' }}>Cliquez sur un article</div>
                ) : (
                  <>
                    <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {panier.map(({ a, q }) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', borderRadius: 8, padding: '5px 8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nom}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{parseInt(a.prix).toLocaleString()} × {q}</div>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 12, color: '#1e3a8a', flexShrink: 0 }}>{(a.prix * q).toLocaleString()}</div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button onClick={() => decFrom(a.id)} style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 13 }}>-</button>
                            <button onClick={() => addTo(a)} style={{ width: 20, height: 20, borderRadius: 5, border: 'none', background: '#1e3a8a', color: '#fff', cursor: 'pointer', fontWeight: 900, fontSize: 13 }}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div style={{ background: 'linear-gradient(135deg,#0f2447,#1e3a8a)', borderRadius: 10, padding: '10px 14px',
                      marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 12 }}>TOTAL</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: '#f0a500' }}>{total.toLocaleString()} <span style={{ fontSize: 10 }}>FCFA</span></span>
                    </div>

                    {/* Mode paiement */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 5 }}>Mode de paiement</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <button onClick={() => setModePay('especes')}
                          style={{ padding: '9px 4px', borderRadius: 8, border: `2px solid ${modePay === 'especes' ? '#16a34a' : '#e2e8f0'}`,
                            background: modePay === 'especes' ? '#f0fdf4' : '#fff', cursor: 'pointer',
                            fontSize: 12, fontWeight: 700, color: modePay === 'especes' ? '#16a34a' : '#64748b' }}>
                          💵 Espèces
                        </button>
                        <button onClick={() => agentInfo && setModePay('bon')}
                          disabled={!agentInfo}
                          title={!agentInfo ? 'Scanner un agent d\'abord' : 'Payer par bon de caisse'}
                          style={{ padding: '9px 4px', borderRadius: 8, border: `2px solid ${modePay === 'bon' ? '#2563eb' : '#e2e8f0'}`,
                            background: modePay === 'bon' ? '#eff6ff' : !agentInfo ? '#f8fafc' : '#fff',
                            cursor: agentInfo ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700,
                            color: modePay === 'bon' ? '#2563eb' : !agentInfo ? '#cbd5e1' : '#64748b', opacity: !agentInfo ? .6 : 1 }}>
                          🎫 Bon{bonAgent ? ` (${parseInt(bonAgent.credit_restant).toLocaleString()})` : ''}
                        </button>
                      </div>
                    </div>

                    {msg && <div style={{ padding: '7px 10px', borderRadius: 7, marginBottom: 8, fontSize: 11, fontWeight: 600,
                      background: msg.type === 'success' ? '#f0fdf4' : msg.type === 'info' ? '#eff6ff' : '#fef2f2',
                      color: msg.type === 'success' ? '#166534' : msg.type === 'info' ? '#1d4ed8' : '#991b1b',
                      border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : msg.type === 'info' ? '#bfdbfe' : '#fecaca'}` }}>{msg.text}</div>}

                    <button onClick={valider} disabled={submitting || !modePay}
                      style={{ width: '100%', background: submitting || !modePay ? '#94a3b8' : modePay === 'bon' ? '#1d4ed8' : '#16a34a',
                        color: '#fff', border: 'none', padding: 12, borderRadius: 9,
                        cursor: submitting || !modePay ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
                      {submitting ? '⏳...'
                        : !modePay ? 'Choisir un mode de paiement'
                        : modePay === 'especes' ? `💵 Encaisser ${total.toLocaleString()} FCFA`
                        : `🎫 Débiter bon — ${total.toLocaleString()} FCFA`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ HISTORIQUE ══ */}
      {tab === 'historique' && (
        <div>
          {/* Stats résumé */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['🧾 Ventes aujourd\'hui', statsJour.total, '#1e3a8a'],
              ['💰 CA du jour', `${statsJour.montant.toLocaleString()} FCFA`, '#16a34a'],
              ['🎫 Par bon', consos.filter(c => c.mode_paiement === 'bon').length, '#7c3aed'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', borderTop: `3px solid ${c}`, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 3 }}>{l}</div>
              </div>
            ))}
          </div>

          {consos.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 700, color: '#64748b' }}>Aucune vente enregistrée</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0f2447,#1e3a8a)' }}>
                    {['Heure', 'Agent', 'Article', 'Qté', 'Montant', 'Mode'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700,
                        textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', letterSpacing: .8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consos.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                        {new Date(c.date_conso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>{c.personnel_nom || 'Anonyme'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>🛒 {c.article_nom}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', textAlign: 'center' }}>{c.quantite}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#1e3a8a' }}>{parseInt(c.montant || 0).toLocaleString()} FCFA</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: c.mode_paiement === 'bon' ? '#eff6ff' : '#f0fdf4',
                          color: c.mode_paiement === 'bon' ? '#2563eb' : '#16a34a',
                          border: `1px solid ${c.mode_paiement === 'bon' ? '#bfdbfe' : '#bbf7d0'}`,
                          borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                          {c.mode_paiement === 'bon' ? '🎫 Bon' : '💵 Espèces'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
