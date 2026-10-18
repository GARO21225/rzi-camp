// Bandeau « Activer les notifications » : sans cet abonnement, un téléphone ne reçoit rien (ni son, ni alerte)
// quand l'application est fermée ou en arrière-plan.
import React, { useState, useEffect } from 'react'
import { pushSupporte, activerPush, resynchroniserPush } from '../utils/push'
import { toast } from '../toast'

const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const installee = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export default function PushActivation() {
  const [etat, setEtat] = useState('cache')  // cache | proposer | refuse | ios
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    if (window.Capacitor?.isNativePlatform?.()) return   // app native : pas de Web Push (ni message « écran d'accueil » sur iPhone)
    let masque = false
    try { masque = Date.now() < Number(localStorage.getItem('rzi_push_masque') || 0) } catch { /* ignore */ }
    if (!pushSupporte()) { if (estIOS() && !installee() && !masque) setEtat('ios'); return }
    if (Notification.permission === 'granted') { resynchroniserPush(); return }
    if (masque) return
    setEtat(Notification.permission === 'denied' ? 'refuse' : 'proposer')
  }, [])

  const activer = async () => {
    setEnvoi(true)
    try { await activerPush({ test: true }); setEtat('cache'); toast.success('🔔 Notifications activées — un test arrive') }
    catch (e) { if (e.message === 'refuse') setEtat('refuse'); else toast.error('Activation impossible sur cet appareil') }
    setEnvoi(false)
  }
  const plusTard = () => { try { localStorage.setItem('rzi_push_masque', String(Date.now() + 3 * 864e5)) } catch { /* ignore */ } ; setEtat('cache') }

  if (etat === 'cache') return null
  const base = { position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 9000, maxWidth: 520, margin: '0 auto',
    background: '#0f2a5c', color: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 12px 32px rgba(15,23,42,.4)', display: 'flex', gap: 12, alignItems: 'center', border: '1px solid rgba(201,151,43,.5)' }
  const msg = etat === 'ios'
    ? "Sur iPhone : touchez Partager puis « Sur l'écran d'accueil », ouvrez l'app depuis l'icône, puis activez les notifications."
    : etat === 'refuse'
      ? "Notifications bloquées : autorisez-les dans les réglages du navigateur / de l'application pour recevoir sons et alertes."
      : 'Recevez les événements et alertes du camp avec le son, même application fermée.'
  return (
    <div role="dialog" aria-label="Activer les notifications" style={base}>
      <div style={{ fontSize: 26 }}>🔔</div>
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.4 }}>{msg}</div>
      {etat === 'proposer' && <button disabled={envoi} onClick={activer} style={{ background: '#c9972b', color: '#0f2a5c', border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12.5 }}>{envoi ? '…' : 'Activer'}</button>}
      <button onClick={plusTard} aria-label="Fermer" style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: 18, cursor: 'pointer' }}>×</button>
    </div>
  )
}
