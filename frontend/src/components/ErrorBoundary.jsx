import React from 'react'

export class ErrorBoundary extends React.Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(e, i) { console.error('[RZI]', e, i) }
  render() {
    if (!this.state.error) return this.props.children
    const base = window.__API_BASE__ || 'non configuré'
    return (
      <div style={{ padding:24, background:'#fff5f5', border:'2px solid #dc2626', borderRadius:12, margin:16, fontFamily:'sans-serif' }}>
        <h3 style={{ color:'#dc2626', margin:'0 0 8px' }}>❌ Erreur page</h3>
        <code style={{ display:'block', background:'#fee2e2', padding:10, borderRadius:8, fontSize:12, marginBottom:12, whiteSpace:'pre-wrap' }}>
          {this.state.error.toString()}
        </code>
        <p style={{ fontSize:12, color:'#64748b', margin:'0 0 12px' }}>
          Backend: <b>{base}</b>
        </p>
        <button onClick={()=>this.setState({error:null})}
          style={{ background:'#dc2626', color:'#fff', border:'none', padding:'8px 16px', borderRadius:8, cursor:'pointer' }}>
          Réessayer
        </button>
      </div>
    )
  }
}
