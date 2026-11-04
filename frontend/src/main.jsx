import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './theme.css'
import { initI18n, i18nPret } from './i18n'

initI18n()

// Application installée (Capacitor) : l'écran de démarrage reste affiché jusqu'à ce
// que la première page soit vraiment dessinée (capacitor.config.ts : launchAutoHide
// false). Avant, il disparaissait au bout de 0,8 s quoi qu'il arrive : écran vide,
// puis page construite par à-coups (et en anglais, le français d'abord).
const masquerDemarrage = (() => {
  let fait = false
  return () => {
    if (fait || !window.Capacitor?.isNativePlatform?.()) return
    fait = true
    import('@capacitor/splash-screen').then(m => m.SplashScreen.hide({ fadeOutDuration: 250 })).catch(() => {})
  }
})()
// Filet de sécurité : jamais plus de 5 s d'écran de démarrage, même si la page plante.
setTimeout(masquerDemarrage, 5000)


ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

// Deux images plus tard la première page est peinte ; on attend aussi la langue.
i18nPret().then(() => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(masquerDemarrage, 150))))
