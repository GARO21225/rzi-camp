/**
 * ConfirmModal — remplace window.confirm (10 pages)
 * Plus beau, non-bloquant, stylé.
 * 
 * Usage:
 *   const [confirm, setConfirm] = useState(null)
 *   <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
 *   
 *   setConfirm({
 *     title: 'Supprimer ?',
 *     message: `Voulez-vous supprimer ${p.nom} ?`,
 *     confirmLabel: 'Supprimer',
 *     confirmColor: '#dc2626',
 *     onConfirm: () => handleDelete(p)
 *   })
 */
import React from 'react'

export default function ConfirmModal({ config, onClose }) {
  if (!config) return null

  const {
    title = 'Confirmer',
    message = 'Êtes-vous sûr ?',
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    confirmColor = '#dc2626',
    icon = '⚠️',
    onConfirm,
  } = config

  const handleConfirm = () => {
    onClose()
    onConfirm?.()
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{position:'fixed',inset:0,background:'rgba(15,36,71,.6)',backdropFilter:'blur(4px)',
        display:'flex',alignItems:'center',justifyContent:'center',zIndex:9000,padding:20}}
    >
      <div style={{background:'#fff',borderRadius:16,padding:28,maxWidth:400,width:'100%',
        boxShadow:'0 20px 60px rgba(0,0,0,.3)',textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>{icon}</div>
        <div style={{fontWeight:800,fontSize:17,color:'#1e293b',marginBottom:8}}>{title}</div>
        <div style={{fontSize:13,color:'#64748b',marginBottom:24,lineHeight:1.6}}>{message}</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button
            onClick={onClose}
            style={{background:'#f1f5f9',border:'none',borderRadius:10,padding:'10px 24px',
              cursor:'pointer',fontSize:13,fontWeight:600,color:'#64748b'}}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            style={{background:confirmColor,color:'#fff',border:'none',borderRadius:10,
              padding:'10px 24px',cursor:'pointer',fontSize:13,fontWeight:700}}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
