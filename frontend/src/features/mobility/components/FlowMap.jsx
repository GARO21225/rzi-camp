import { C } from '../utils/theme'
import { Badge } from './ui'

export function FlowMap({ stats }) {
  const dep = stats.planifies || 0
  const en  = stats.en_voyage || 0
  const ret = stats.retours   || 0
  return (
    <div style={{position:'relative',height:180}}>
      <svg viewBox="0 0 320 180" style={{width:'100%',height:'100%'}} aria-label="Carte flux rotations">
        <defs>
          <filter id="glow-gold"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="glow-green"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* Villes */}
        {/* Abidjan */}
        <circle cx="40" cy="90" r="12" fill="rgba(201,151,43,.12)" stroke="#e0b04d" strokeWidth="1.5" filter="url(#glow-gold)"/>
        <circle cx="40" cy="90" r="4" fill="#e0b04d"/>
        <text x="40" y="114" textAnchor="middle" fontSize="8" fill={C.muted} fontFamily="JetBrains Mono" letterSpacing="0.5">ABIDJAN</text>

        {/* Camp */}
        <circle cx="200" cy="70" r="16" fill="rgba(201,151,43,.2)" stroke="#e0b04d" strokeWidth="2" filter="url(#glow-gold)"/>
        <circle cx="200" cy="70" r="5" fill="#e0b04d"/>
        <circle cx="200" cy="70" r="20" fill="none" stroke="rgba(201,151,43,.25)" strokeWidth="1">
          <animate attributeName="r" values="16;24;16" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".5;0;.5" dur="2.5s" repeatCount="indefinite"/>
        </circle>
        <text x="200" y="54" textAnchor="middle" fontSize="9" fill={C.accent} fontFamily="JetBrains Mono" fontWeight="700">CAMP</text>

        {/* Mine */}
        <circle cx="280" cy="130" r="10" fill="rgba(251,191,36,.12)" stroke={C.amber} strokeWidth="1.5"/>
        <circle cx="280" cy="130" r="3" fill={C.amber}/>
        <text x="280" y="150" textAnchor="middle" fontSize="8" fill={C.muted} fontFamily="JetBrains Mono" letterSpacing="0.5">MINE</text>

        {/* Aéroport */}
        <circle cx="60" cy="30" r="8" fill="rgba(34,211,238,.1)" stroke={C.cyan} strokeWidth="1.2"/>
        <circle cx="60" cy="30" r="2.5" fill={C.cyan}/>
        <text x="60" y="18" textAnchor="middle" fontSize="7" fill={C.muted} fontFamily="JetBrains Mono">AÉROPORT</text>

        {/* Flux Abidjan → Camp */}
        <path d="M 52 90 Q 120 55 188 70" stroke="rgba(201,151,43,.2)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
        {dep > 0 && <>
          <circle r="3.5" fill={C.accent} opacity=".9" filter="url(#glow-gold)">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M 52 90 Q 120 55 188 70"/>
          </circle>
          <circle r="3.5" fill={C.accent} opacity=".5">
            <animateMotion dur="2.8s" begin="1.4s" repeatCount="indefinite" path="M 52 90 Q 120 55 188 70"/>
          </circle>
        </>}
        {/* Badge départs */}
        <rect x="88" y="56" width="36" height="14" rx="3" fill="rgba(201,151,43,.15)" stroke="rgba(201,151,43,.3)" strokeWidth="0.5"/>
        <text x="106" y="66" textAnchor="middle" fontSize="8" fill={C.accent} fontFamily="JetBrains Mono" fontWeight="700">{dep} dép.</text>

        {/* Flux Camp → Mine */}
        <path d="M 210 78 Q 250 90 272 128" stroke="rgba(251,191,36,.15)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
        {en > 0 && <circle r="3" fill={C.amber} opacity=".85">
          <animateMotion dur="3.5s" repeatCount="indefinite" path="M 210 78 Q 250 90 272 128"/>
        </circle>}

        {/* Flux Retour Camp → Abidjan */}
        <path d="M 188 76 Q 120 80 52 96" stroke="rgba(52,211,153,.12)" strokeWidth="1" fill="none" strokeDasharray="3 4"/>
        {ret > 0 && <circle r="2.5" fill={C.green} opacity=".8">
          <animateMotion dur="3.8s" begin="1.5s" repeatCount="indefinite" path="M 188 76 Q 120 80 52 96"/>
        </circle>}

        {/* Aéroport → Camp */}
        <path d="M 66 32 Q 130 28 188 65" stroke="rgba(34,211,238,.12)" strokeWidth="1" fill="none" strokeDasharray="3 5"/>
        <circle r="2.5" fill={C.cyan} opacity=".7">
          <animateMotion dur="4.5s" begin="2s" repeatCount="indefinite" path="M 66 32 Q 130 28 188 65"/>
        </circle>
      </svg>

      {/* Stats overlay */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,
        display:'flex',gap:8,justifyContent:'center'}}>
        {[{l:'Départs',v:dep,c:C.accent},{l:'En route',v:en,c:C.amber},{l:'Retours',v:ret,c:C.green}].map(k=>(
          <div key={k.l} style={{background:`${k.c}12`,border:`0.5px solid ${k.c}30`,
            borderRadius:6,padding:'5px 10px',textAlign:'center',minWidth:60}}>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:16,fontWeight:700,color:k.c}}>{k.v}</div>
            <div style={{fontSize:8,color:C.muted,textTransform:'uppercase',letterSpacing:.5}}>{k.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Seat Map ────────────────────────────────────────────────────────
