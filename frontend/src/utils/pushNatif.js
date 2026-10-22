// Push NATIF (FCM) pour l'app compilée Capacitor Android/iOS — distinct de utils/push.js (Web Push,
// PWA/navigateur, désactivé exprès sur plateforme native car un WebView fermé ne reçoit rien via le
// Push API web). Import dynamique du plugin : ce fichier doit rester sans effet sur le build web
// (pas de WebPlugin natif chargé) et ne JAMAIS faire planter l'app si le plugin ou les credentials
// serveur (FCM_SERVICE_ACCOUNT_JSON) ne sont pas encore configurés.
import { pushAPI } from '../api'

export const pushNatifSupporte = () => !!window.Capacitor?.isNativePlatform?.()

let brancheEcoute = false

// Demande la permission système puis enregistre l'appareil auprès de Firebase (register()) ; le jeton
// FCM arrive de façon asynchrone via l'événement 'registration', jamais en retour direct de register().
export async function activerPushNatif() {
  if (!pushNatifSupporte()) return false
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const { Capacitor } = await import('@capacitor/core')
  let etat = await PushNotifications.checkPermissions()
  if (etat.receive !== 'granted') etat = await PushNotifications.requestPermissions()
  if (etat.receive !== 'granted') return false

  if (!brancheEcoute) {
    brancheEcoute = true
    PushNotifications.addListener('registration', (jeton) => {
      const plateforme = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
      pushAPI.enregistrerTokenNatif(jeton.value, plateforme).catch(() => {})
    })
    PushNotifications.addListener('registrationError', (err) => {
      console.warn('push natif — enregistrement refusé par la plateforme', err)
    })
    // Notification reçue app ouverte au premier plan : le système ne l'affiche pas lui-même dans ce cas,
    // contrairement à l'app en arrière-plan/fermée (où android/iOS gèrent l'alerte sans code ici).
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action.notification?.data?.url
      if (url) window.location.href = url
    })
  }
  await PushNotifications.register()
  return true
}
