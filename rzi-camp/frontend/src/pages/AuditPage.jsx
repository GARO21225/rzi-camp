import React, { useEffect, useState } from 'react'
import { audit } from '../api'

export default function AuditPage() {
  const [data, setData] = useState([])
  useEffect(() => { audit.list({ page_size:50 }).then(r => setData(r.data.results || r.data)) }, [])
  return (
    <div style={{ padding:20 }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>📋 Audit Trail Global</h2>
      <p style={{ fontSize:13, color:'var(--text-dim)', marginBottom:20 }}>Toutes les actions tracées · Niveau bancaire · django-simple-history</p>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ background:'var(--surface2)' }}>
              {['Horodatage','Utilisateur','Action','Module','Détail','IP'].map(h => (
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:10, fontFamily:'monospace', color:'var(--text-dim)', letterSpacing:1, textTransform:'uppercase', fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(a => (
              <tr key={a.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'var(--text-dim)' }}>{new Date(a.timestamp).toLocaleString('fr-FR')}</td>
                <td style={{ padding:'10px 12px', fontWeight:600 }}>{a.utilisateur_nom}</td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>{a.action}</td>
                <td style={{ padding:'10px 12px' }}>{a.module}</td>
                <td style={{ padding:'10px 12px', color:'var(--text-dim)', fontSize:11 }}>{a.detail}</td>
                <td style={{ padding:'10px 12px', fontFamily:'monospace', fontSize:10, color:'var(--text-dim)' }}>{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
