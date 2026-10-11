import { C, ST_CFG } from '../utils/theme'
import { toISO } from '../utils/format'
import { StatusBadge } from './ui'

// ── Gantt Bar ───────────────────────────────────────────────────────
export function GanttBar({ voyage, days, onClick }) {
  const cfg = ST_CFG[voyage.statut] || ST_CFG.planifie
  const dep = voyage.date_depart || ''
  const ret = voyage.date_retour_prevue || dep
  return (
    <tr style={{borderBottom:`1px solid ${C.border}`}}
      onMouseEnter={e=>e.currentTarget.style.background='rgba(201,151,43,.04)'}
      onMouseLeave={e=>e.currentTarget.style.background=''}>
      <td style={{padding:'7px 12px',minWidth:160,maxWidth:180,
        position:'sticky',left:0,background:C.panel,zIndex:1}}>
        <div style={{fontWeight:600,fontSize:12,color:C.text,
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {voyage.personnel_nom || voyage.personnel__nom || '—'}
        </div>
        <div style={{fontSize:9,color:C.muted,marginTop:1}}>
          {voyage.vehicule || voyage.destination || '—'}
        </div>
      </td>
      {days.map((day,i)=>{
        const iso = toISO(day)
        const isOn = iso >= dep && iso <= ret
        const isDep = iso === dep
        const isRet = iso === ret
        const isTod = iso === toISO(new Date())
        return (
          <td key={i} style={{padding:0,width:32,minWidth:32,
            background:isTod?'rgba(201,151,43,.06)':'transparent',
            borderLeft:`1px solid ${isTod?C.accent+'40':C.border}`}}>
            {isOn ? (
              <div onClick={()=>onClick(voyage)}
                style={{
                  height:26,margin:'2px 1px',
                  background: isDep||isRet ? cfg.c : cfg.c+'20',
                  borderRadius: isDep ? '5px 0 0 5px' : isRet ? '0 5px 5px 0' : 0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  cursor:'pointer',fontSize:11,fontWeight:700,
                  color: isDep||isRet ? '#fff' : cfg.c,
                  boxShadow: isDep ? `0 0 6px ${cfg.c}60` : 'none',
                }}>
                {isDep ? '↗' : isRet ? '↙' : ''}
              </div>
            ) : <div style={{height:26,margin:'2px 1px'}}/>}
          </td>
        )
      })}
      <td style={{padding:'7px 10px',whiteSpace:'nowrap'}}>
        <StatusBadge statut={voyage.statut} allerSeul={voyage.trajet_aller_seul}/>
      </td>
    </tr>
  )
}

// ════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════════════
