import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Remplaçant direct de <select> : on peut TAPER pour filtrer/choisir (noms, chambres,
// véhicules…) ou ouvrir la liste. Mêmes enfants <option>, même onChange(e) avec
// e.target.value — on remplace simplement <select> par <SelectRecherche>.
//
// Liste déroulante maison (dropdown HTML/CSS), PAS <input list="..."> + <datalist> :
// datalist n'affiche aucune suggestion dans les WebView natives Android/iOS
// ("la liste déroulante ne prend pas").
//
// Deux pièges mobiles corrigés ici, découverts l'un après l'autre :
// 1) Le dropdown était en position:absolute, enfant normal du DOM. Or
//    SelectRecherche est presque toujours utilisé DANS un corps de modal en
//    overflowY:'auto' (formulaire Personnel, Résidences, MissionControl…) —
//    un overflow:auto/hidden sur un ancêtre DÉCOUPE tout descendant qui
//    dépasse, position:absolute ou pas. La liste était donc invisible ou
//    tronquée dans le volet scrollable, pas vraiment "choisissable". Fix :
//    on la sort du flux avec un portail (createPortal) vers document.body et
//    on la positionne en position:fixed à partir du rectangle réel du champ.
// 2) Sélection au clic : sur mobile, le blur du champ (qui ferme le clavier)
//    survient AVANT le click sur l'option si on ferme la liste directement
//    au blur — le tap semble ignoré. Fix : le blur programme une fermeture
//    différée (200ms) ; le mousedown/touchstart sur une option l'annule
//    avant qu'elle s'exécute, laissant le click suivant choisir la valeur.
const texte = (ch) => React.Children.toArray(ch).map(x => (x && typeof x === 'object' ? texte(x.props?.children) : String(x))).join('')

function aplatir(children, out = []) {
  React.Children.forEach(children, (c) => {
    if (!c || typeof c !== 'object') return
    if (c.type === React.Fragment || c.type === 'optgroup') aplatir(c.props.children, out)
    else if (c.type === 'option') out.push({ value: String(c.props.value ?? texte(c.props.children)), label: texte(c.props.children), disabled: !!c.props.disabled })
  })
  return out
}

// Props de mise en page à reporter sur le conteneur (pas sur le champ) pour que
// le composant occupe exactement la même place qu'avant dans les grilles/flex.
const CLES_MISE_EN_PAGE = ['width', 'maxWidth', 'minWidth', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'flex', 'flexGrow', 'flexShrink', 'flexBasis']

export default function SelectRecherche({ value, defaultValue, onChange, children, style, disabled, required, className, id, afficherIndisponibles }) {
  const options = aplatir(children)
  const controle = value !== undefined
  const [interne, setInterne] = useState(String(defaultValue ?? ''))
  const courant = controle ? String(value ?? '') : interne
  const choisie = options.find(o => o.value === courant && o.value !== '')
  const [txt, setTxt] = useState(choisie?.label || '')
  const [ouvert, setOuvert] = useState(false)
  const [rect, setRect] = useState(null)
  const focus = useRef(false)
  const inputRef = useRef(null)
  const timerFermeture = useRef(null)
  const vide = options.find(o => o.value === '')

  useEffect(() => { if (!focus.current) setTxt(choisie?.label || '') }, [courant, choisie?.label])

  // Position du dropdown (portail) recalculée tant qu'il est ouvert : au
  // défilement d'un ancêtre (capture:true, seul moyen de capter le scroll
  // d'un volet interne — il ne « bouillonne » pas jusqu'à window) et au
  // redimensionnement (rotation de l'écran, clavier qui s'ouvre/ferme).
  useEffect(() => {
    if (!ouvert) return
    const maj = () => { if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()) }
    maj()
    window.addEventListener('scroll', maj, true)
    window.addEventListener('resize', maj)
    return () => { window.removeEventListener('scroll', maj, true); window.removeEventListener('resize', maj) }
  }, [ouvert])

  useEffect(() => () => { if (timerFermeture.current) clearTimeout(timerFermeture.current) }, [])

  const annulerFermeture = () => { if (timerFermeture.current) { clearTimeout(timerFermeture.current); timerFermeture.current = null } }

  const emettre = (v) => {
    if (!controle) setInterne(v)
    onChange?.({ target: { value: v }, currentTarget: { value: v } })
  }

  const visibles = options.filter(o => o.value !== '' && (afficherIndisponibles || !o.disabled))
  const recherche = txt.trim().toLowerCase()
  const filtrees = recherche === '' ? visibles : visibles.filter(o => o.label.toLowerCase().includes(recherche))

  const choisir = (o) => {
    if (o.disabled) return
    annulerFermeture()
    setTxt(o.label)
    emettre(o.value)
    setOuvert(false)
  }

  const saisie = (e) => {
    const t = e.target.value
    setTxt(t)
    setOuvert(true)
    if (t === '') emettre('')
  }

  const sortie = () => {
    focus.current = false
    setOuvert(false)
    if (txt === '') { setTxt(''); return }
    if (choisie && txt === choisie.label) return
    const exact = visibles.find(o => o.label.toLowerCase() === recherche)
    if (exact) { setTxt(exact.label); emettre(exact.value); return }
    if (filtrees.length === 1) { setTxt(filtrees[0].label); emettre(filtrees[0].value) }
    else setTxt(choisie?.label || '')
  }

  // Le blur ferme la liste APRÈS un court délai, pas tout de suite : ça
  // laisse le temps au tap sur une option (dont le mousedown/touchstart
  // annule ce timer juste avant) d'aboutir au lieu d'être coupé court.
  const planifierSortie = () => { timerFermeture.current = setTimeout(sortie, 200) }

  const wrapStyle = { position: 'relative', width: '100%' }
  const inputStyle = { boxSizing: 'border-box', ...style, width: '100%' }
  if (style) for (const k of CLES_MISE_EN_PAGE) if (k in style) wrapStyle[k] = style[k]

  return (
    <div style={wrapStyle}>
      <input ref={inputRef} id={id} className={className} value={txt} disabled={disabled} required={required}
        placeholder={vide?.label || 'Taper pour rechercher…'} autoComplete="off"
        onFocus={(e) => { focus.current = true; setOuvert(true); e.target.select?.() }}
        onChange={saisie} onBlur={planifierSortie}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOuvert(false); e.target.blur() } }}
        style={inputStyle} />
      {ouvert && filtrees.length > 0 && rect && createPortal(
        <div role="listbox"
          onMouseDown={annulerFermeture} onTouchStart={annulerFermeture}
          style={{
            position: 'fixed', zIndex: 9999,
            top: rect.bottom + 4, left: rect.left, width: rect.width,
            background: '#fff', border: '1px solid rgba(15,26,46,.14)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(15,26,46,.18)', maxHeight: 220, overflowY: 'auto',
          }}>
          {filtrees.map(o => (
            <div key={o.value} role="option" aria-selected={o.value === courant}
              onClick={() => choisir(o)}
              style={{
                padding: '10px 14px', fontSize: 13.5, cursor: o.disabled ? 'not-allowed' : 'pointer',
                color: o.disabled ? 'var(--rzc-text-4,#8B95A1)' : 'var(--rzc-text,#0F1A2E)',
                background: o.value === courant ? 'var(--rzc-ore-gold-l,rgba(201,151,43,.12))' : 'transparent',
              }}>
              {o.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
