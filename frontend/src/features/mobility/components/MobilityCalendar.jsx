import { C } from '../utils/theme'
import { toISO } from '../utils/format'
import { Panel } from './ui'

export function VueCalendrierMC({ voyages, mois, setMois, onSelect }) {
  const annee = mois.getFullYear(), moisIdx = mois.getMonth()
  const premierJour = new Date(annee, moisIdx, 1)
  const nbJours = new Date(annee, moisIdx + 1, 0).getDate()
  const decalage = (premierJour.getDay() + 6) % 7

  const parJour = {}
  voyages.forEach(v => {
    if (v.date_depart) { parJour[v.date_depart] = parJour[v.date_depart] || { departs: [], retours: [] }; parJour[v.date_depart].departs.push(v) }
    if (v.date_retour_prevue) { parJour[v.date_retour_prevue] = parJour[v.date_retour_prevue] || { departs: [], retours: [] }; parJour[v.date_retour_prevue].retours.push(v) }
  })

  const cases = []
  for (let i = 0; i < decalage; i++) cases.push(null)
  for (let j = 1; j <= nbJours; j++) cases.push(j)
  const fmtDate = (j) => `${annee}-${String(moisIdx+1).padStart(2,'0')}-${String(j).padStart(2,'0')}`

  return (
    <Panel style={{padding:18}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <button className="mc-btn" onClick={()=>setMois(new Date(annee,moisIdx-1,1))}>←</button>
        <div style={{fontFamily:'JetBrains Mono,monospace',fontWeight:700,fontSize:14,color:C.accent,textTransform:'capitalize'}}>
          {mois.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}
        </div>
        <button className="mc-btn" onClick={()=>setMois(new Date(annee,moisIdx+1,1))}>→</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',marginBottom:6}}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j=><div key={j} style={{textAlign:'center'}}>{j}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
        {cases.map((j,i) => {
          if (!j) return <div key={i}/>
          const dateStr = fmtDate(j)
          const info = parJour[dateStr]
          const isToday = dateStr === toISO(new Date())
          return (
            <div key={i} style={{minHeight:68,border:`1px solid ${isToday?C.accent:C.border}`,borderRadius:8,padding:4,fontSize:10,background:isToday?`${C.accent}0a`:C.panel}}>
              <div style={{fontWeight:700,color:isToday?C.accent:C.muted,marginBottom:2}}>{j}</div>
              {info?.departs.slice(0,2).map(v=>(
                <div key={'d'+v.id} onClick={()=>onSelect(v)} title={`Départ — ${v.personnel_nom||''}`}
                  style={{background:`${C.orange||'#f97316'}18`,color:C.orange||'#c2410c',borderRadius:4,padding:'1px 4px',marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  🧳 {v.personnel_nom||v.destination}
                </div>
              ))}
              {info?.retours.slice(0,2).map(v=>(
                <div key={'r'+v.id} onClick={()=>onSelect(v)} title={`Retour — ${v.personnel_nom||''}`}
                  style={{background:`${C.green}18`,color:C.green,borderRadius:4,padding:'1px 4px',marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  🏠 {v.personnel_nom||v.destination}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ── Flow SVG animé ──────────────────────────────────────────────────
