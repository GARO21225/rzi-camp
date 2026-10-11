// Navigation du Centre de Mobilité : espaces (haut) + vues de l'espace actif (sous-onglets).
import { espacesVisibles, espaceDeVue } from '../utils/espaces'

const pastille = (n) => n > 0 && (
  <span style={{ position: 'absolute', top: -6, right: -6, background: '#DC2626', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 800,
    minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{n}</span>
)

/** badges : { vue: nombre } — ex. { validations: 3, organiser: 2 } */
export function MobilityNav({ view, setView, isAdmin, isMobile, badges = {} }) {
  const espaces = espacesVisibles(isAdmin)
  const actif = espaceDeVue(view)
  return (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(201,151,43,.05)', borderRadius: 10, padding: 4,
      flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', width: isMobile ? '100%' : 'auto', WebkitOverflowScrolling: 'touch' }}>
      {espaces.map(e => {
        const n = e.vues.reduce((s, v) => s + (badges[v[0]] || 0), 0)
        return (
          <button key={e.id} className={`mc-tab ${actif === e.id ? 'active' : ''}`} style={{ position: 'relative', flexShrink: 0 }}
            onClick={() => setView(actif === e.id ? view : e.vues[0][0])}>
            {e.label}{pastille(n)}
          </button>
        )
      })}
    </div>
  )
}

export function MobilitySubNav({ view, setView, isAdmin, badges = {} }) {
  const espace = espacesVisibles(isAdmin).find(e => e.id === espaceDeVue(view))
  if (!espace || espace.vues.length < 2) return null
  return (
    <div style={{ display: 'flex', gap: 6, margin: '0 0 14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {espace.vues.map(([v, l]) => (
        <button key={v} onClick={() => setView(v)}
          style={{ position: 'relative', flexShrink: 0, padding: '6px 14px', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            border: `1px solid ${view === v ? '#C9972B' : 'rgba(15,26,46,.12)'}`, background: view === v ? '#FFF8E6' : '#fff', color: view === v ? '#8A6410' : '#5B6472' }}>
          {l}{pastille(badges[v])}
        </button>
      ))}
    </div>
  )
}
