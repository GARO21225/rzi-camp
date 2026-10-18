// Contrôle léger toutes les 5 s (/api/pulse/) : on ne recharge une page que si SA signature change.
// Son d'alerte quand une nouvelle notification arrive (déverrouillé par le premier geste de l'utilisateur).
import api from '../api'

const INTERVALLE_MS = 3000
let timer = null, derniere = null, audioCtx = null, abonnes = []
let sonActif = (() => { try { return localStorage.getItem('rzi_son_notif') !== '0' } catch { return true } })()

export const sonNotifActif = () => sonActif
export const activerSonNotif = (v) => { sonActif = !!v; try { localStorage.setItem('rzi_son_notif', v ? '1' : '0') } catch {} ; if (v) bip() }

const debloquerAudio = () => {
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!audioCtx) audioCtx = new AC()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch {}
}
if (typeof window !== 'undefined') {
  ;['pointerdown', 'keydown', 'touchstart', 'click'].forEach(ev => window.addEventListener(ev, debloquerAudio, { passive: true }))
}

export function bip() {
  try {
    debloquerAudio()
    if (!audioCtx || audioCtx.state !== 'running') return
    const t0 = audioCtx.currentTime
    ;[880, 1175, 880].forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + i * 0.22)
      g.gain.exponentialRampToValueAtTime(0.35, t0 + i * 0.22 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.2)
      o.connect(g); g.connect(audioCtx.destination)
      o.start(t0 + i * 0.22); o.stop(t0 + i * 0.22 + 0.21)
    })
    if (navigator.vibrate) navigator.vibrate([120, 60, 120])
  } catch {}
}

// Sirène d'urgence (alerte danger / sécurité) : deux tons alternés, plus longue et plus forte qu'un bip.
// Joue même si le son des notifications est coupé : c'est un signal de sécurité.
export function alarme() {
  try {
    debloquerAudio()
    if (!audioCtx || audioCtx.state !== 'running') return false
    const t0 = audioCtx.currentTime
    for (let i = 0; i < 6; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain()
      o.type = 'square'; o.frequency.value = i % 2 ? 660 : 960
      g.gain.setValueAtTime(0.0001, t0 + i * 0.3)
      g.gain.exponentialRampToValueAtTime(0.28, t0 + i * 0.3 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.3 + 0.28)
      o.connect(g); g.connect(audioCtx.destination)
      o.start(t0 + i * 0.3); o.stop(t0 + i * 0.3 + 0.29)
    }
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300])
    return true
  } catch { return false }
}
export const sonDebloque = () => { debloquerAudio(); return !!audioCtx && audioCtx.state === 'running' }

const sigs = (d) => ({
  notifs: JSON.stringify(d.notifs), alertes: d.alertes?.sig, demandes: d.demandes?.sig, incidents: d.incidents?.sig, plaintes: d.plaintes?.sig, resto: d.resto?.sig,
})

async function tick() {
  if (document.hidden || !localStorage.getItem('access_token')) return
  try {
    const { data } = await api.get('/api/pulse/')
    const s = sigs(data)
    if (derniere) {
      const changes = Object.keys(s).filter(k => s[k] !== derniere[k])
      if (changes.length) {
        if (changes.includes('notifs') && (data.notifs?.dernier || 0) > (derniere._dernier || 0) && sonActif) bip()
        abonnes.slice().forEach(a => { if (changes.some(c => a.domaines.includes(c))) { try { a.cb(data) } catch {} } })
      }
    }
    derniere = { ...s, _dernier: data.notifs?.dernier || 0 }
  } catch {}
}

export function demarrerPulse() {
  if (timer) return
  tick()
  timer = setInterval(tick, INTERVALLE_MS)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick() })
  // Le service worker signale un push reçu : on interroge tout de suite (le son part sans attendre le prochain cycle).
  try { navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'PUSH_RECU' || e.data?.type === 'NEW_EVENT') tick() }) } catch {}
}
export function arreterPulse() { clearInterval(timer); timer = null; derniere = null }

export function abonnerPulse(domaines, cb) {
  const a = { domaines, cb }
  abonnes.push(a)
  return () => { abonnes = abonnes.filter(x => x !== a) }
}
