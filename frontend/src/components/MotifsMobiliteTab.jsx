import React, { useEffect, useState } from 'react'
import { parametres } from '../api'
import { toast } from '../toast'
import { MOTIFS_DEFAUT, parseMotifs, libelleMotif } from '../hooks/useMotifsMobilite'

// Paramétrage → 🧭 Motifs mobilité : liste proposée dans « Motif / Objet » du Centre de mobilité
export default function MotifsMobiliteTab({ isAdmin }) {
  const [motifs, setMotifs] = useState([])
  const [nouveau, setNouveau] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    parametres.list().then(r => {
      const p = (r.data || []).find(x => x.cle === 'mobilite_motifs')
      setMotifs(parseMotifs(p?.valeur))
    }).catch(() => setMotifs(MOTIFS_DEFAUT))
  }, [])

  const ajouter = () => {
    const m = nouveau.trim().replace(/,/g, ' ')
    if (!m) return
    if (motifs.some(x => x.toLowerCase() === m.toLowerCase())) { toast.error('Ce motif existe déjà'); return }
    setMotifs([...motifs, m]); setNouveau('')
  }
  const enregistrer = async () => {
    if (!motifs.length) { toast.error('Au moins un motif est requis'); return }
    setSaving(true)
    try {
      await parametres.save([{ cle: 'mobilite_motifs', valeur: motifs.join(','), description: 'Centre de mobilité — motifs de déplacement proposés (séparés par des virgules)' }])
      toast.success('Motifs enregistrés')
    } catch (e) { toast.error(e.response?.data?.detail || 'Enregistrement impossible (admin requis)') }
    setSaving(false)
  }
  const deplacer = (i, d) => {
    const j = i + d
    if (j < 0 || j >= motifs.length) return
    const c = [...motifs]; [c[i], c[j]] = [c[j], c[i]]; setMotifs(c)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:560 }}>
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 16px', fontSize:12.5, color:'#1e40af' }}>
        ℹ️ Motifs proposés dans « Motif / Objet » à la création d'un convoi ou d'un voyage individuel (Centre de mobilité).
      </div>
      {isAdmin && (
        <div style={{ display:'flex', gap:8 }}>
          <input value={nouveau} onChange={e=>setNouveau(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') ajouter() }} placeholder="Nouveau motif (ex: Rotation, Mission, Décès famille…)"
            style={{ flex:1, border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px', fontSize:13 }} />
          <button onClick={ajouter} disabled={!nouveau.trim()} style={{ background:'#C9972B', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, cursor:'pointer' }}>➕ Ajouter</button>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {motifs.map((m, i) => (
          <div key={m} style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 12px' }}>
            <span style={{ flex:1, fontWeight:600, fontSize:13 }}>{libelleMotif(m)}</span>
            {isAdmin && (<>
              <button title="Monter" onClick={()=>deplacer(i,-1)} style={{ border:'none', background:'#f1f5f9', borderRadius:6, cursor:'pointer' }}>↑</button>
              <button title="Descendre" onClick={()=>deplacer(i,1)} style={{ border:'none', background:'#f1f5f9', borderRadius:6, cursor:'pointer' }}>↓</button>
              <button title="Retirer" onClick={()=>setMotifs(motifs.filter(x=>x!==m))} style={{ border:'none', background:'#fef2f2', color:'#dc2626', borderRadius:6, cursor:'pointer' }}>🗑️</button>
            </>)}
          </div>
        ))}
      </div>
      {isAdmin && <button onClick={enregistrer} disabled={saving} style={{ background:'#0F2A5C', color:'#fff', border:'none', borderRadius:9, padding:'11px', fontWeight:700, cursor:'pointer' }}>{saving ? '⏳…' : '💾 Enregistrer les motifs'}</button>}
    </div>
  )
}
