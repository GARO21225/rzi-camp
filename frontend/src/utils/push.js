// Web Push côté navigateur : abonnement de l'appareil + envoi au serveur.
import { pushAPI } from '../api'

export const pushSupporte = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const cleEnBytes = (b64) => {
  const s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

// Abonne cet appareil (demande la permission si besoin) puis enregistre l'abonnement côté serveur.
export async function activerPush({ test = false } = {}) {
  if (!pushSupporte()) throw new Error('non_supporte')
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('refuse')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { data } = await pushAPI.cle()
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnBytes(data.cle) })
  }
  await pushAPI.abonner(sub.toJSON())
  if (test) await pushAPI.test().catch(() => {})
  return true
}

// Appareil déjà autorisé : ré-enregistre silencieusement l'abonnement (changement de compte, base réinitialisée…).
export async function resynchroniserPush() {
  if (!pushSupporte() || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) { await pushAPI.abonner(sub.toJSON()); return true }
  } catch { /* best effort */ }
  return false
}
