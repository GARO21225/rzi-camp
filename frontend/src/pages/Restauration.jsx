import React, { useState, useEffect, useRef, useCallback } from 'react'
import { qr, personnel as personnelAPI } from '../api'
import { useStore } from '../store'

const REPAS = [
  { key:'petit_dejeuner', label:'🌅 Petit-déjeuner', color:'#f97316', time:'06:00–09:00' },
  { key:'dejeuner', label:'☀️ Déjeuner', color:'#2563eb', time:'12:00–14:00' },
  { key:'diner', label:'🌙 Dîner', color:'#7c3aed', time:'18:00–20:00' },
]

// ── QR Scanner isolé ──
function QRScanner({ onResult, color, onError }) {
  const [state, setState] = useState('idle')
  const scannerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stop()
    }
  }, [])

  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      try { scannerRef.current.clear() } catch {}
      scannerRef.current = null
    }
  }

  const start = async () => {
    setState('loading')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mountedRef.current) return
      const s = new Html5Qrcode('qr-box')
      scannerRef.current = s
      setState('scanning')
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (text) => {
          await stop()
          if (!mountedRef.current) return
          setState('done')
          onResult(text)
        },
        () => {}
      )
    } catch {
      if (!mountedRef.current) return
      setState('error')
      onError && onError()
    }
  }

  const doStop = async () => { await stop(); setState('idle') }

  return (
    <div>
      {(state === 'idle' || state === 'done') && (
        <button onClick={start}
          style={{ width:'100%', background:`${color}10`, border:`2px solid ${color}`,
            borderRadius:12, padding:'20px 16px', cursor:'pointer',
            display:'flex', flexDirection:'column', alignItems:'center', gap:8,
            color, fontWeight:700, fontSize:14 }}>
          <span style={{ fontSize:44 }}>📷</span>
          {state === 'done' ? '🔄 Scanner un autre' : 'Activer la caméra'}
          <span style={{ fontSize:11, fontWeight:400, color:'#64748b' }}>
            Cliquez pour scanner le QR du résident
          </span>
        </button>
      )}
      {state === 'loading' && (
        <div style={{ padding:'32px 16px', textAlign:'center', color:'#64748b', background:'#f8fafc', borderRadius:12 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📡</div>Démarrage caméra...
        </div>
      )}
      {state === 'error' && (
        <div style={{ padding:16, background:'rgba(220,38,38,.06)', border:'1px solid rgba(220,38,38,.2)', borderRadius:10, textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📵</div>
          <div style={{ fontSize:12, color:'#dc2626', fontWeight:600, marginBottom:10 }}>
            Caméra non disponible ou accès refusé
          </div>
          <button onClick={()=>setState('idle')} style={{ background:'#dc2626', color:'#fff', border:'none', padding:'7px 16px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>Réessayer</button>
        </div>
      )}
      {/* Always in DOM when scanning */}
      <div id="qr-box" style={{ display: state==='scanning' ? 'block' : 'none', borderRadius:10, overflow:'hidden', border:`2px solid ${color}` }}/>
      {state === 'scanning' && (
        <button onClick={doStop}
          style={{ width:'100%', marginTop:10, background:'rgba(220,38,38,.1)', color:'#dc2626', border:'1px solid rgba(220,38,38,.3)', padding:'8px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
          ✕ Arrêter
        </button>
      )}
    </div>
  )
}

// ── Sélection manuelle du personnel ──
function SelectionManuelle({ personnelList, typeRepas, color, onSuccess, onError }) {
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = personnelList.filter(p =>
    !search || `${p.nom} ${p.prenom} ${p.societe}`.toLowerCase().includes(search.toLowerCase())
  )

  const valider = async () => {
    if (!selected) return
    setLoading(true)
    try {
      const r = await qr.validerParPersonnel({ personnel_id: parseInt(selected), type_repas: typeRepas })
      onSuccess(r.data)
      setSelected('')
      setSearch('')
    } catch(e) {
      onError(e.response?.data?.erreur || 'Erreur')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:12, color:'#64748b', fontWeight:600 }}>
        🔍 Rechercher le résident
      </div>
      <input
        value={search}
        onChange={e=>setSearch(e.target.value)}
        placeholder="Nom, prénom, société..."
        style={{ background:'#f8fafc', border:'2px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', width:'100%' }}
      />
      <div style={{ maxHeight:220, overflowY:'auto', border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding:16, textAlign:'center', color:'#94a3b8', fontSize:12 }}>Aucun résultat</div>
        ) : filtered.map(p => (
          <div key={p.id}
            onClick={() => setSelected(p.id.toString())}
            style={{
              padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10,
              background: selected === p.id.toString() ? `${color}12` : '#fff',
              borderBottom:'1px solid #f1f5f9',
              borderLeft: selected === p.id.toString() ? `3px solid ${color}` : '3px solid transparent',
              transition:'.1s'
            }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
              {p.type_personnel === 'roxgold' ? '👷' : p.type_personnel === 'visiteur' ? '🧑' : '🏗️'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#1e3a8a' }}>{p.nom} {p.prenom}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{p.societe} · {p.numero}</div>
            </div>
            {selected === p.id.toString() && <span style={{ color, fontWeight:700 }}>✓</span>}
          </div>
        ))}
      </div>
      <button
        onClick={valider}
        disabled={!selected || loading}
        style={{ background: selected ? color : '#e2e8f0', color: selected ? '#fff' : '#94a3b8',
          border:'none', padding:'12px', borderRadius:10, cursor: selected ? 'pointer' : 'default',
          fontSize:14, fontWeight:700, transition:'.2s' }}>
        {loading ? '⏳ Validation...' : `✅ Valider ${REPAS.find(r=>r.key===typeRepas)?.label||''}`}
      </button>
    </div>
  )
}

export default function Restauration() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = ['admin'].includes(role) || user?.is_staff || user?.is_superuser
  const isResto = role === 'restauration'
  const canSeeAll = isAdmin || isResto

  const [typeRepas, setTypeRepas] = useState('dejeuner')
  const [repasLog, setRepasLog] = useState([])
  const [loadingRepas, setLoadingRepas] = useState(false)
  const [tab, setTab] = useState(canSeeAll ? 'valider' : 'mon_qr')
  const [mode, setMode] = useState('manuel') // 'qr' | 'manuel'
  const [scanMsg, setScanMsg] = useState(null)
  const [myQR, setMyQR] = useState(null)
  const [personnelList, setPersonnelList] = useState([])
  const [scanKey, setScanKey] = useState(0)
  const today = new Date().toISOString().slice(0,10)

  const loadRepas = useCallback(() => {
    setLoadingRepas(true)
    qr.repas({ page_size:300, type_repas:typeRepas })
      .then(r => setRepasLog(r.data.results||r.data||[]))
      .catch(() => setRepasLog([]))
      .finally(() => setLoadingRepas(false))
  }, [typeRepas])

  useEffect(() => {
    loadRepas()
    // Load all personnel for manual selection
    personnelAPI.list({ page_size:500 }).then(r => {
      const items = r.data.results||r.data||[]
      setPersonnelList(items)
      if (!canSeeAll) {
        const me = items.find(p => p.login_genere === user?.username || p.nom === user?.last_name)
        if (me) setMyQR(me)
        else if (items.length) setMyQR(items[0])
      }
    }).catch(()=>{})
  }, [typeRepas])

  const showResult = (ok, msg, sub='') => {
    setScanMsg({ ok, msg, sub })
    setTimeout(() => setScanMsg(null), 7000)
  }

  const handleQRScan = async (qrData) => {
    setScanMsg({ ok: null, msg: '⏳ Validation en cours...' })
    try {
      const r = await qr.scanner({ qr_data: qrData, type_repas: typeRepas })
      showResult(true, `✅ ${r.data.resident}`, `${r.data.type_repas_label} validé · ${r.data.societe||''}`)
      loadRepas()
    } catch(e) {
      showResult(false, `❌ ${e.response?.data?.erreur||'QR non reconnu'}`, 'Utilisez la sélection manuelle')
    }
  }

  const handleManualSuccess = (data) => {
    showResult(true, `✅ ${data.resident}`, `${data.type_repas_label} validé · ${data.societe||''}`)
    loadRepas()
  }

  const repas = REPAS.find(r=>r.key===typeRepas)
  const todayLog = repasLog.filter(r=>r.date_validation?.startsWith(today))

  return (
    <div style={{ padding:'16px' }}>
      <h2 style={{ fontSize:18, fontWeight:700, color:'#1e3a8a', marginBottom:4 }}>🍽️ Restauration</h2>
      <p style={{ fontSize:11, color:'#64748b', marginBottom:14 }}>
        {canSeeAll ? 'Validation repas · QR ou sélection · Historique' : 'Mon QR · Mes repas'}
      </p>

      {/* Sélecteur repas */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {REPAS.map(r=>(
          <button key={r.key} onClick={()=>{ setTypeRepas(r.key); setScanKey(k=>k+1) }}
            style={{ flex:1, padding:'9px 6px', borderRadius:10, border:`2px solid ${typeRepas===r.key?r.color:'#e2e8f0'}`,
              background:typeRepas===r.key?`${r.color}12`:'#fff', cursor:'pointer',
              color:typeRepas===r.key?r.color:'#64748b', fontWeight:600, fontSize:11 }}>
            {r.label}<br/><span style={{ fontSize:9, fontWeight:400 }}>{r.time}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:14, background:'#f8fafc', borderRadius:10, padding:4, border:'1px solid #e2e8f0' }}>
        {canSeeAll
          ? [['valider','✅ Valider repas'],["aujourd_hui","📋 Aujourd'hui"],['historique','📊 Historique']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'#1e3a8a':'#64748b',
                  boxShadow:tab===k?'0 1px 4px rgba(30,58,138,.08)':'none' }}>
                {l}
              </button>
            ))
          : [['mon_qr','📱 Mon QR'],['mes_repas','🍽️ Mes repas']].map(([k,l])=>(
              <button key={k} onClick={()=>{ setTab(k); if(k==='mes_repas') loadRepas() }}
                style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background:tab===k?'#fff':'transparent', color:tab===k?'#1e3a8a':'#64748b',
                  boxShadow:tab===k?'0 1px 4px rgba(30,58,138,.08)':'none' }}>
                {l}
              </button>
            ))
        }
      </div>

      {/* ── VALIDER ── */}
      {tab==='valider' && canSeeAll && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Panel gauche: mode de validation */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, boxShadow:'0 1px 4px rgba(30,58,138,.08)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#1e3a8a', marginBottom:4 }}>Valider un repas</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
              Choisissez le mode de validation
            </div>

            {/* Mode switcher */}
            <div style={{ display:'flex', gap:4, marginBottom:16, background:'#f8fafc', borderRadius:10, padding:4, border:'1px solid #e2e8f0' }}>
              <button onClick={()=>setMode('manuel')}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:mode==='manuel'?'#fff':'transparent',
                  color:mode==='manuel'?repas?.color:'#64748b',
                  boxShadow:mode==='manuel'?'0 1px 4px rgba(30,58,138,.08)':'none' }}>
                👆 Sélection liste
              </button>
              <button onClick={()=>setMode('qr')}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                  background:mode==='qr'?'#fff':'transparent',
                  color:mode==='qr'?repas?.color:'#64748b',
                  boxShadow:mode==='qr'?'0 1px 4px rgba(30,58,138,.08)':'none' }}>
                📷 Scanner QR
              </button>
            </div>

            {/* Mode manuel: sélection dans liste */}
            {mode === 'manuel' && (
              <SelectionManuelle
                personnelList={personnelList}
                typeRepas={typeRepas}
                color={repas?.color||'#2563eb'}
                onSuccess={handleManualSuccess}
                onError={(msg)=>showResult(false, `❌ ${msg}`)}
              />
            )}

            {/* Mode QR: caméra */}
            {mode === 'qr' && (
              <div>
                <div style={{ marginBottom:10, background:'rgba(37,99,235,.06)', border:'1px solid rgba(37,99,235,.15)', borderRadius:8, padding:'8px 12px', fontSize:11, color:'#2563eb' }}>
                  💡 Le résident montre son QR (depuis "Mon QR" dans Restauration)
                </div>
                <QRScanner
                  key={`qr-${scanKey}-${typeRepas}`}
                  onResult={handleQRScan}
                  color={repas?.color||'#2563eb'}
                  onError={()=>showResult(false, 'Caméra indisponible', 'Utilisez la sélection manuelle')}
                />
              </div>
            )}

            {/* Résultat scan/validation */}
            {scanMsg && (
              <div style={{ marginTop:12, background:scanMsg.ok===true?'rgba(22,163,74,.08)':scanMsg.ok===false?'rgba(220,38,38,.08)':'rgba(37,99,235,.06)',
                border:`1px solid ${scanMsg.ok===true?'rgba(22,163,74,.25)':scanMsg.ok===false?'rgba(220,38,38,.25)':'rgba(37,99,235,.2)'}`,
                borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                <div style={{ fontSize:28, marginBottom:6 }}>
                  {scanMsg.ok===true?'✅':scanMsg.ok===false?'❌':'⏳'}
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:scanMsg.ok===true?'#16a34a':scanMsg.ok===false?'#dc2626':'#2563eb' }}>
                  {scanMsg.msg}
                </div>
                {scanMsg.sub && <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{scanMsg.sub}</div>}
              </div>
            )}
          </div>

          {/* Panel droit: compteur du jour */}
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:18, boxShadow:'0 1px 4px rgba(30,58,138,.08)' }}>
            <div style={{ fontWeight:600, color:'#1e3a8a', marginBottom:6, fontSize:13 }}>
              {repas?.label} — {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}
            </div>
            <div style={{ fontFamily:'monospace', fontSize:52, fontWeight:700, color:repas?.color, textAlign:'center', marginBottom:4 }}>
              {todayLog.length}
            </div>
            <div style={{ textAlign:'center', fontSize:11, color:'#64748b', marginBottom:14 }}>repas validés aujourd'hui</div>
            <div style={{ maxHeight:230, overflowY:'auto', display:'flex', flexDirection:'column', gap:5 }}>
              {todayLog.map(r=>(
                <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'#f8fafc', borderRadius:8, fontSize:12 }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{r.resident||'—'}</div>
                    <div style={{ fontSize:10, color:'#94a3b8' }}>{r.residence||''}</div>
                  </div>
                  <span style={{ color:'#94a3b8', fontFamily:'monospace', fontSize:11 }}>
                    {r.date_validation&&new Date(r.date_validation).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              ))}
              {todayLog.length===0&&<div style={{textAlign:'center',color:'#94a3b8',fontSize:12,padding:20}}>Aucun repas validé</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── AUJOURD'HUI ── */}
      {tab==='aujourd_hui' && <RepasTable data={todayLog} title={`Repas du jour · ${repas?.label}`} loading={loadingRepas}/>}

      {/* ── HISTORIQUE ── */}
      {tab==='historique' && <RepasTable data={repasLog} title={`Historique · ${repas?.label}`} loading={loadingRepas} showDate/>}

      {/* ── MON QR ── */}
      {tab==='mon_qr' && (
        <div style={{ maxWidth:360, margin:'0 auto' }}>
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:14, padding:24, textAlign:'center', boxShadow:'0 1px 4px rgba(30,58,138,.08)' }}>
            <div style={{ fontWeight:700, fontSize:15, color:'#1e3a8a', marginBottom:4 }}>📱 Mon QR de déclaration</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:14 }}>
              Montrez ce QR au restaurant ou demandez une validation manuelle
            </div>
            {myQR?.qr_code_data
              ? <img src={`data:image/png;base64,${myQR.qr_code_data}`} alt="Mon QR"
                  style={{ width:220, height:220, borderRadius:12, border:'3px solid #e2e8f0', margin:'0 auto 14px', display:'block' }}/>
              : <div style={{ width:220, height:220, background:'#f8fafc', borderRadius:12, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', flexDirection:'column', gap:10 }}>
                  <div style={{ fontSize:44 }}>📱</div>
                  <div style={{ fontSize:12, textAlign:'center' }}>QR non disponible<br/>Contactez l'admin</div>
                </div>
            }
            {myQR && (
              <div style={{ background:'#f8fafc', borderRadius:10, padding:'10px 14px' }}>
                <div style={{ fontWeight:700, color:'#1e3a8a', fontSize:13 }}>{myQR.nom} {myQR.prenom}</div>
                <div style={{ color:'#64748b', fontSize:11 }}>{myQR.societe}</div>
                {myQR.qr_code_string && (
                  <div style={{ fontFamily:'monospace', fontSize:9, color:'#94a3b8', marginTop:6, wordBreak:'break-all', textAlign:'left' }}>
                    {myQR.qr_code_string}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={()=>setTab('mes_repas')}
            style={{ width:'100%', marginTop:12, background:'#1e3a8a', color:'#fff', border:'none', padding:'12px', borderRadius:10, cursor:'pointer', fontSize:13, fontWeight:700 }}>
            📋 Voir mes repas →
          </button>
        </div>
      )}

      {/* ── MES REPAS ── */}
      {tab==='mes_repas' && (
        <div>
          <div style={{ marginBottom:10, display:'flex', justifyContent:'flex-end' }}>
            <button onClick={loadRepas} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', color:'#1e3a8a', padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🔄 Actualiser
            </button>
          </div>
          <RepasTable data={repasLog} title={`Mes repas · ${repas?.label}`} loading={loadingRepas} showDate/>
        </div>
      )}
    </div>
  )
}

function RepasTable({ data, title, loading, showDate }) {
  const COLS = {
    petit_dejeuner:{ label:'🌅 Petit-déj', color:'#f97316' },
    dejeuner:{ label:'☀️ Déjeuner', color:'#2563eb' },
    diner:{ label:'🌙 Dîner', color:'#7c3aed' }
  }
  if (loading) return <div style={{ padding:32, textAlign:'center', color:'#64748b' }}>🔄 Chargement...</div>
  return (
    <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(30,58,138,.08)' }}>
      <div style={{ padding:'11px 16px', background:'#1e3a8a', color:'#fff', fontWeight:600, fontSize:13, display:'flex', justifyContent:'space-between' }}>
        <span>{title}</span>
        <span style={{ background:'rgba(255,255,255,.2)', padding:'2px 10px', borderRadius:20, fontSize:12 }}>{data.length}</span>
      </div>
      {data.length === 0
        ? <div style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>🍽️</div>Aucune donnée
          </div>
        : <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5, minWidth:380 }}>
            <thead><tr style={{ background:'#f8fafc' }}>
              {[showDate&&'Date','Heure','Résident','Résidence','Repas'].filter(Boolean).map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'#64748b', letterSpacing:1, textTransform:'uppercase', fontWeight:500 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.map((r,i)=>{
                const col = COLS[r.type_repas]
                const dt = r.date_validation ? new Date(r.date_validation) : null
                return (
                  <tr key={r.id} style={{ borderTop:'1px solid #f1f5f9', background: i%2 ? '#f8fafc' : '#fff' }}>
                    {showDate&&<td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>{dt?.toLocaleDateString('fr-FR')||'—'}</td>}
                    <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>{dt?.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})||'—'}</td>
                    <td style={{ padding:'8px 12px', fontWeight:700, color:'#1e3a8a' }}>{r.resident||'—'}</td>
                    <td style={{ padding:'8px 12px', fontSize:11, color:'#64748b' }}>{r.residence||'—'}</td>
                    <td style={{ padding:'8px 12px' }}>
                      {col
                        ? <span style={{ background:`${col.color}18`, color:col.color, padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600 }}>{col.label}</span>
                        : <span style={{ color:'#94a3b8', fontSize:11 }}>{r.type_repas_label||r.type_repas||'—'}</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      }
    </div>
  )
}
