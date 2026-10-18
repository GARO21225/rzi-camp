import { useRef, useState } from 'react'
import { toast } from '../toast'
import { compressImage } from '../utils/photo'

// Photo obligatoire/optionnelle : caméra sur mobile, fichier sur ordinateur. value = base64 (sans préfixe).
export default function PhotoCapture({ value, onChange, label, requis = false }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  const choisir = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return toast.error('Photo trop lourde (15 Mo max)')
    setBusy(true)
    try { onChange(await compressImage(f)) } catch { toast.error('Photo illisible') }
    setBusy(false)
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
        {label} {requis && <span style={{ color: '#dc2626' }}>* obligatoire</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" capture="environment" onChange={choisir} style={{ display: 'none' }} />
      {value ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={`data:image/jpeg;base64,${value}`} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 10, border: '2px solid #D4A017', display: 'block' }} />
          <button type="button" onClick={() => onChange('')} aria-label="Retirer la photo"
            style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, border: 'none', background: 'rgba(8,27,61,.85)', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy}
          style={{ width: '100%', padding: '16px 12px', borderRadius: 12, border: `2px dashed ${requis ? '#D4A017' : '#cbd5e1'}`, background: '#F3F5F9', color: '#0F2A5C', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {busy ? '⏳ Traitement…' : '📷 Prendre / choisir une photo'}
        </button>
      )}
    </div>
  )
}
