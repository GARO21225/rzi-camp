import React from 'react'

/** Isole une carte Leaflet : si elle plante (point invalide, couche retirée pendant
 *  une animation...), seul ce bloc affiche un message — pas toute l'application. */
export default class MapSafe extends React.Component {
  constructor(props) { super(props); this.state = { erreur: null, essai: 0 } }
  static getDerivedStateFromError(erreur) { return { erreur } }
  componentDidCatch(erreur, info) { console.error('[MapSafe]', erreur, info?.componentStack) }
  render() {
    if (this.state.erreur) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          🗺️ La carte n'a pas pu s'afficher.
          <div><button onClick={() => this.setState({ erreur: null, essai: this.state.essai + 1 })}
            style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1e3a8a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Réessayer</button></div>
        </div>
      )
    }
    return <React.Fragment key={this.state.essai}>{this.props.children}</React.Fragment>
  }
}

export const coordValide = (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])
export const trajetValide = (pts) => (Array.isArray(pts) ? pts.filter(coordValide) : [])
