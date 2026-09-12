// Système de toast global — notifications non bloquantes, cohérentes avec
// le design de l'app, contrairement à alert()/confirm() natifs du
// navigateur qui interrompent brutalement et ne peuvent pas être stylés.
//
// Usage :
//   import { toast } from '../toast'
//   toast.success('Enregistré !')
//   toast.error('Erreur lors de la sauvegarde')
//   toast.info('Chargement en cours...')

const listeners = new Set()
let idCounter = 0

function emit(type, message, duree = 4000) {
  const id = ++idCounter
  const item = { id, type, message, duree }
  listeners.forEach(fn => fn(item))
  return id
}

export const toast = {
  success: (message, duree) => emit('success', message, duree),
  error:   (message, duree) => emit('error', message, duree ?? 6000),
  info:    (message, duree) => emit('info', message, duree),
  warning: (message, duree) => emit('warning', message, duree ?? 5000),
}

export function subscribeToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ── Confirmation — remplace window.confirm() natif (bloquant, non stylé) ──
// Usage : const ok = await confirmDialog('Supprimer cet élément ?')
const confirmListeners = new Set()
let confirmIdCounter = 0

export function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    const id = ++confirmIdCounter
    const item = {
      id, message, resolve,
      titre: options.titre || 'Confirmation',
      danger: options.danger !== false,
    }
    confirmListeners.forEach(fn => fn(item))
  })
}

export function subscribeConfirm(fn) {
  confirmListeners.add(fn)
  return () => confirmListeners.delete(fn)
}
