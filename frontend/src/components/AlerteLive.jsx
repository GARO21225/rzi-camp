import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertes as alertesAPI, evenements as evtAPI } from '../api'
import { useSurPulse } from '../hooks/useSurPulse'
import { alarme, bip, sonDebloque } from '../utils/pulse'

// Alertes campus (danger/attention) et événements d'urgence : bannière plein écran
// + sirène répétée tant que l'utilisateur n'a pas accusé réception. Tourne pour TOUT
// compte connecté (y compris sans fiche personnel), alimenté par le pulse de 5 s.
const CLE = 'rzi_urgences_vues'
const lireVues = () => { try { return JSON.parse(localStorage.getItem(CLE) || '[]') } catch { return [] } }
const ecrireVues = (v) => { try { localStorage.setItem(CLE, JSON.stringify(v.slice(-60))) } catch {} }

const STYLE = {
  danger:  { bg: '#b91c1c', accent: '#fecaca', icone: '🚨', titre: 'ALERTE URGENTE' },
  warning: { bg: '#b45309', accent: '#fde68a', icone: '⚠️', titre: 'ATTENTION' },
  info:    { bg: '#1d4ed8', accent: '#bfdbfe', icone: 'ℹ️', titre: 'INFORMATION' },
  success: { bg: '#15803d', accent: '#bbf7d0', icone: '✅', titre: 'TOUT EST OK' },
}

export default function AlerteLive() {
  const navigate = useNavigate()
  const [file, setFile] = useState([])          // urgences non acquittées
  const [muet, setMuet] = useState(false)       // navigateur : son pas encore autorisé
  const premiere = useRef(true)

  const verifier = useCallback(async () => {
    try {
      const [a, e] = await Promise.all([
        alertesAPI.list().then(r => r.data.results || r.data || []).catch(() => []),
        evtAPI.list({ page_size: 20 }).then(r => r.data.results || r.data || []).catch(() => []),
      ])
      const items = [
        ...a.map(x => ({ cle: `a${x.id}`, type: x.type_alerte, titre: STYLE[x.type_alerte]?.titre || 'ALERTE', message: x.message, lien: '/evenements' })),
        ...e.filter(x => ['alerte', 'securite'].includes(x.type_event) && ['planifie', 'en_cours'].includes(x.statut)
                         && Date.now() - new Date(x.date_creation || x.date_debut).getTime() < 24 * 3600 * 1000)
            .map(x => ({ cle: `e${x.id}`, type: x.type_event === 'alerte' ? 'danger' : 'warning', titre: x.type_event === 'alerte' ? 'ALERTE' : 'SÉCURITÉ', message: `${x.titre}${x.lieu ? ' — ' + x.lieu : ''}`, lien: '/evenements' })),
      ]
      const vues = lireVues()
      setFile(items.filter(i => !vues.includes(i.cle)))
    } catch {}
  }, [])

  useEffect(() => { const t = setTimeout(verifier, 1500); return () => clearTimeout(t) }, [verifier])
  useSurPulse(['alertes'], verifier)

  const urgente = file.find(i => i.type === 'danger') || file[0]

  // Sirène toutes les 4 s tant qu'une alerte danger n'est pas acquittée ; simple bip pour le reste.
  useEffect(() => {
    if (!urgente) return
    let ok = true
    const jouer = () => { ok = urgente.type === 'danger' ? alarme() : (bip(), true); setMuet(!ok) }
    jouer()
    if (urgente.type !== 'danger') return
    const id = setInterval(jouer, 4000)
    return () => clearInterval(id)
  }, [urgente?.cle])

  if (!urgente) return null
  const st = STYLE[urgente.type] || STYLE.info
  const acquitter = () => {
    ecrireVues([...lireVues(), ...file.map(i => i.cle)])
    setFile([])
  }

  return (
    <div role="alertdialog" aria-live="assertive" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15,23,42,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style>{`@keyframes rziPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.55)}50%{box-shadow:0 0 0 18px rgba(255,255,255,0)}}`}</style>
      <div style={{ width: 'min(560px, 100%)', background: st.bg, color: '#fff', borderRadius: 20, padding: '26px 24px', boxShadow: '0 24px 70px rgba(0,0,0,.5)', textAlign: 'center', animation: urgente.type === 'danger' ? 'rziPulse 1.4s infinite' : 'none' }}>
        <div style={{ fontSize: 54, lineHeight: 1 }}>{st.icone}</div>
        <div style={{ marginTop: 10, fontSize: 13, letterSpacing: 2, fontWeight: 800, color: st.accent }}>{urgente.titre}</div>
        <div style={{ marginTop: 10, fontSize: 21, fontWeight: 800, lineHeight: 1.3, wordBreak: 'break-word' }}>{urgente.message}</div>
        {file.length > 1 && <div style={{ marginTop: 10, fontSize: 12.5, color: st.accent }}>+ {file.length - 1} autre(s) alerte(s)</div>}
        {muet && (
          <button onClick={() => { sonDebloque(); urgente.type === 'danger' ? alarme() : bip(); setMuet(false) }}
            style={{ marginTop: 14, background: 'rgba(255,255,255,.2)', color: '#fff', border: '1px solid rgba(255,255,255,.5)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontWeight: 700 }}>
            🔊 Activer le son
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
          <button onClick={acquitter} style={{ background: '#fff', color: st.bg, border: 'none', borderRadius: 12, padding: '12px 22px', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}>J'ai compris</button>
          <button onClick={() => { acquitter(); navigate(urgente.lien) }} style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,.7)', borderRadius: 12, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Voir le détail</button>
        </div>
      </div>
    </div>
  )
}
