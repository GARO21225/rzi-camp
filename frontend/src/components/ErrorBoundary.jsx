import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('RZI Camp Error:', error, info)
    this.setState({ info })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#fff0f0', border: '2px solid #dc2626', borderRadius: 12, margin: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
            ❌ Erreur dans cette page
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#7f1d1d', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            API: {window.__API_BASE__ || 'non défini'}<br/>
            Backend: {window.BACKEND_URL || 'non configuré'}
          </div>
          <button onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 12, background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
