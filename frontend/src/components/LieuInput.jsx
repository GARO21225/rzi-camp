import React from 'react'
import { COORDS_DESTINATIONS } from '../data/coordsDestinations'

// Liste d'affichage (Title Case) derivee du catalogue de lieux connus -
// une seule source de verite partagee avec la carte (coordsDestinations.js),
// pour que "Camp Roxgold Sango" et toutes les autres options proposees ici
// correspondent TOUJOURS a un lieu que la carte sait localiser.
const toTitleCase = (s) => s.replace(/\b\w/g, c => c.toUpperCase())
export const LIEUX_CONNUS = Object.keys(COORDS_DESTINATIONS)
  .map(k => k === 'camp roxgold sango' ? 'Camp Roxgold Sango' : toTitleCase(k))
  .sort((a, b) => a === 'Camp Roxgold Sango' ? -1 : b === 'Camp Roxgold Sango' ? 1 : a.localeCompare(b))

const estConnu = (val) => {
  if (!val) return true // champ vide : pas d'erreur affichee, gere par le 'required' eventuel
  const v = val.trim().toLowerCase()
  return LIEUX_CONNUS.some(l => l.toLowerCase() === v)
}

let _uid = 0

/**
 * Champ lieu avec autocompletion stricte : on peut taper, une liste
 * deroulante suggere les lieux connus, mais si la valeur saisie ne
 * correspond a AUCUN lieu du catalogue au moment de quitter le champ,
 * une erreur claire s'affiche et onValidChange(false) est appele - a
 * l'appelant de bloquer la soumission tant que ce n'est pas corrige.
 */
export default function LieuInput({ value, onChange, placeholder, style, onValidChange }) {
  const [id] = React.useState(() => `lieux-connus-${++_uid}`)
  const [touched, setTouched] = React.useState(false)
  const valide = estConnu(value)

  React.useEffect(() => { onValidChange?.(valide) }, [valide])

  return (
    <div>
      <input list={id} value={value||''} onChange={e=>onChange(e.target.value)}
        onBlur={()=>setTouched(true)}
        placeholder={placeholder||'Sélectionner ou taper un lieu…'}
        style={{...style, borderColor: (touched && !valide) ? '#dc2626' : style?.borderColor}}/>
      <datalist id={id}>
        {LIEUX_CONNUS.map(l => <option key={l} value={l}/>)}
      </datalist>
      {touched && !valide && (
        <div style={{fontSize:10.5, color:'#dc2626', marginTop:3}}>
          ⚠️ Lieu inconnu du catalogue — sélectionnez une option de la liste plutôt que de taper librement.
        </div>
      )}
    </div>
  )
}
