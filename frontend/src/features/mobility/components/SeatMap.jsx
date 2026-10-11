import { C } from '../utils/theme'

export function SeatMap({ total=15, passagers=[], onBook, canBook=true }) {
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
      {Array.from({length:total},(_,i)=>{
        const p = passagers[i]
        return (
          <div key={i}
            onClick={()=>!p && canBook && onBook && onBook(i)}
            title={p ? `${p.personnel__nom||''} ${p.personnel__prenom||''}` : 'Siège libre'}
            style={{
              width:24,height:24,borderRadius:5,
              background: p ? `${C.accent}22` : 'transparent',
              border: `1.5px solid ${p ? C.accent : C.border}`,
              cursor: !p && canBook ? 'pointer' : 'default',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:8,fontWeight:700,
              color: p ? C.accent : C.muted,
              transition:'all .15s',
            }}
            onMouseEnter={e=>!p&&canBook&&(e.currentTarget.style.borderColor=C.green,e.currentTarget.style.background=`${C.green}15`)}
            onMouseLeave={e=>!p&&(e.currentTarget.style.borderColor=C.border,e.currentTarget.style.background='transparent')}>
            {p ? '●' : '○'}
          </div>
        )
      })}
    </div>
  )
}
