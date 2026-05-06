import React, { useState, useEffect, useRef } from 'react'
import { qr } from '../api'
import { useStore } from '../store'

export default function Restauration() {
  const { user } = useStore()
  const [token, setToken] = useState(null)
  const [seconds, setSeconds] = useState(45)
  const [used, setUsed] = useState(false)
  const [repas, setRepas] = useState([])
  const [log, setLog] = useState([])
  const [residence, setResidence] = useState('A3')
  const [resident, setResident] = useState('')
  const timerRef = useRef(null)

  const loadRepas = () => qr.repas({ page_size: 10 }).then(r => setRepas(r.data.results || r.data))
  useEffect(() => { loadRepas() }, [])

  const generer = async () => {
    if (!resident) return alert('Nom du résident obligatoire')
    clearInterval(timerRef.current)
    setUsed(false)
    setSeconds(45)
    const r = await qr.generer({ residence, resident, duree: 45 })
    setToken(r.data.token)
    timerRef.current = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(timerRef.current); setToken(null); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const scanner = async () => {
    if (!token || seconds <= 0) return
    if (used) {
      setLog(l => [{ time: new Date().toTimeString().slice(0,5), msg:'🚨 FRAUDE — Double scan refusé!', ok:false }, ...l])
      return
    }
    try {
      const r = await qr.scanner({ token, device_id: navigator.userAgent.slice(0,50) })
      setUsed(true)
      clearInterval(timerRef.current)
      setLog(l => [{ time: new Date().toTimeString().slice(0,5), msg:`✅ Repas validé — ${r.data.resident} (${r.data.residence})`, ok:true }, ...l])
      loadRepas()
    } catch (e) {
      const msg = e.response?.data?.erreur || 'Erreur'
      setLog(l => [{ time: new Date().toTimeString().slice(0,5), msg:`❌ ${msg}`, ok:false }, ...l])
    }
  }

  const timerColor = seconds > 15 ? 'var(--accent)' : seconds > 5 ? 'var(--maintenance)' : 'var(--occupe)'

  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>🍽️ Module Restauration — Anti-Fraude</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:20 }}>QR dynamique HMAC · Expiration 45s · Double-scan bloqué</p>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div>
          <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:12, padding:24, textAlign:'center' }}>
            <div style={{ width:140, height:140, background:'#fff', borderRadius:8, margin:'0 auto 16px',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:60 }}>
              {used ? '✅' : token && seconds > 0 ? '🔲' : '🍴'}
            </div>
            <div style={{ fontFamily:'monospace', fontSize:32, fontWeight:700, color: used ? 'var(--libre)' : timerColor }}>
              {used ? '✓' : seconds}
            </div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:12 }}>
              {used ? 'Repas validé' : token ? 'secondes restantes' : 'En attente'}
            </div>
            {token && !used && (
              <div style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-dim)', marginBottom:12 }}>
                TOKEN: {token.slice(0,12)}...
              </div>
            )}
            <div style={{ marginBottom:12, display:'flex', flexDirection:'column', gap:8 }}>
              <input value={resident} onChange={e=>setResident(e.target.value)} placeholder="Nom du résident"
                style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
              <input value={residence} onChange={e=>setResidence(e.target.value)} placeholder="Résidence (ex: A3)"
                style={{ background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:7, fontSize:13, outline:'none', fontFamily:'inherit' }}/>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              <button onClick={generer} style={{ background:'var(--accent)', color:'#000', border:'none', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>Générer QR</button>
              <button onClick={scanner} disabled={!token || seconds <= 0}
                style={{ background:'rgba(239,68,68,.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,.3)', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                📱 Scanner
              </button>
            </div>
          </div>

          {/* Security info */}
          <div style={{ marginTop:16, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:14, fontSize:12 }}>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-dim)', letterSpacing:2, marginBottom:8 }}>SÉCURITÉ ACTIVE</div>
            {['✅ Token HMAC-SHA256 signé','✅ Anti double-scan activé','✅ Expiration automatique 45s','✅ Validation serveur obligatoire'].map(s => (
              <div key={s} style={{ marginBottom:4 }}>{s}</div>
            ))}
          </div>

          {/* Logs */}
          {log.length > 0 && (
            <div style={{ marginTop:12 }}>
              {log.slice(0,5).map((l,i) => (
                <div key={i} style={{ background: l.ok ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
                  border:`1px solid ${l.ok ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                  borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:6 }}>
                  <span style={{ fontFamily:'monospace', fontSize:10, color:'var(--text-dim)', marginRight:8 }}>{l.time}</span>
                  {l.msg}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:600 }}>📋 Journal des repas</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--surface2)' }}>
                {['Heure','Résident','Résidence'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {repas.map(r => (
                <tr key={r.id} style={{ borderTop:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 12px', fontFamily:'monospace', fontSize:11 }}>
                    {new Date(r.date_validation).toTimeString().slice(0,5)}
                  </td>
                  <td style={{ padding:'8px 12px' }}>{r.resident}</td>
                  <td style={{ padding:'8px 12px', fontFamily:'monospace', fontWeight:700 }}>{r.residence}</td>
                </tr>
              ))}
              {repas.length === 0 && <tr><td colSpan={3} style={{ padding:20, textAlign:'center', color:'var(--text-dim)' }}>Aucun repas enregistré</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
