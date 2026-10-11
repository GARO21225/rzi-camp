import { useEffect, useState } from 'react'
import { C, ST_CFG } from '../utils/theme'

// ── Micro composants UI ─────────────────────────────────────────────
export function Panel({ children, style={}, glow=false }) {
  return (
    <div style={{
      background: C.panel,
      border: `0.5px solid ${glow ? C.glow : C.border}`,
      borderRadius: 12,
      position: 'relative',
      overflow: 'hidden',
      ...style
    }}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${glow?C.glow:C.border},transparent)`}}/>
      {children}
    </div>
  )
}

export function Label({ children, style={} }) {
  return (
    <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,fontWeight:600,
      letterSpacing:1.5,textTransform:'uppercase',color:C.muted,
      marginBottom:8,display:'flex',alignItems:'center',gap:6,...style}}>
      <span style={{display:'inline-block',width:3,height:10,
        background:C.accent,borderRadius:2,flexShrink:0}}/>
      {children}
    </div>
  )
}

export function Kpi({ icon, label, value, color=C.accent, sub, glow=false }) {
  return (
    <Panel glow={glow} style={{padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <Label>{label}</Label>
          <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:30,
            fontWeight:700,color,lineHeight:1}}>{value}</div>
          {sub && <div style={{fontSize:10,color:C.muted,marginTop:4}}>{sub}</div>}
        </div>
        <div style={{fontSize:22,opacity:.6}}>{icon}</div>
      </div>
    </Panel>
  )
}

export function Badge({ children, color=C.accent, small=false }) {
  return (
    <span style={{
      background: color + '18', color,
      border: `0.5px solid ${color}40`,
      padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 99,
      fontSize: small ? 9 : 10,
      fontWeight: 700,
      letterSpacing: .3,
      display:'inline-flex', alignItems:'center', gap:3,
      whiteSpace:'nowrap',
    }}>{children}</span>
  )
}

export function StatusBadge({ statut, allerSeul=false }) {
  const cfg = ST_CFG[statut] || ST_CFG.planifie
  // BUG REEL CORRIGE ICI : "Retour camp" ne veut rien dire pour un trajet
  // ALLER SEUL (trajet_aller_seul) - il n'y a justement pas de retour dans
  // ce cas (voir Voyage.revenir(), qui saute la restitution de chambre),
  // le meme statut "retour" signifie simplement "arrivé à destination".
  const label = (statut==='retour' && allerSeul) ? 'Arrivé' : cfg.l
  return <Badge color={cfg.c}>{label}</Badge>
}

export function LiveDot({ color=C.green }) {
  return (
    <span style={{width:6,height:6,borderRadius:'50%',background:color,
      display:'inline-block',flexShrink:0,
      boxShadow:`0 0 6px ${color}`,
      animation:'mcPulse 1.4s ease-in-out infinite'}}/>
  )
}

// ── Clock ───────────────────────────────────────────────────────────
export function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const day = n.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})
      const time = [n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':')
      setT(`${day} · ${time}`)
    }
    tick(); const iv = setInterval(tick,1000); return ()=>clearInterval(iv)
  },[])
  return <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:12,color:C.text,letterSpacing:1}}>{t}</span>
}

// ── Vue calendrier — départs/retours du mois, façon agence de voyage ──
