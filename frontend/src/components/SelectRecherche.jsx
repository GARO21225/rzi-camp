import React, { useEffect, useRef, useState } from 'react'

// Remplaçant direct de <select> : on peut TAPER pour filtrer/choisir (noms, chambres,
// véhicules…) ou ouvrir la liste. Mêmes enfants <option>, même onChange(e) avec
// e.target.value — on remplace simplement <select> par <SelectRecherche>.
//
// Liste déroulante maison (dropdown positionné en CSS), PAS <input list="..."> +
// <datalist> : datalist n'affiche aucune suggestion dans les WebView natives
// Android/iOS (Capacitor) — en pratique, taper dans le champ ne proposait rien
// et il était impossible de choisir une valeur sur mobile ("la liste déroulante
// ne prend pas"). Le dropdown ci-dessous est du HTML/CSS simple, donc fiable
// partout. Sélection au onPointerDown (pas onClick) : il se déclenche AVANT le
// onBlur du champ, donc le tapotement d'une option est bien pris en compte au
// lieu d'être annulé par la fermeture de la liste au blur.
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
  const focus = useRef(false)
  const vide = options.find(o => o.value === '')

  useEffect(() => { if (!focus.current) setTxt(choisie?.label || '') }, [courant, choisie?.label])

  const emettre = (v) => {
    if (!controle) setInterne(v)
    onChange?.({ target: { value: v }, currentTarget: { value: v } })
  }

  const visibles = options.filter(o => o.value !== '' && (afficherIndisponibles || !o.disabled))
  const recherche = txt.trim().toLowerCase()
  const filtrees = recherche === '' ? visibles : visibles.filter(o => o.label.toLowerCase().includes(recherche))

  const choisir = (o) => {
    if (o.disabled) return
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

  const wrapStyle = { position: 'relative', width: '100%' }
  const inputStyle = { boxSizing: 'border-box', ...style, width: '100%' }
  if (style) for (const k of CLES_MISE_EN_PAGE) if (k in style) wrapStyle[k] = style[k]

  return (
    <div style={wrapStyle}>
      <input id={id} className={className} value={txt} disabled={disabled} required={required}
        placeholder={vide?.label || 'Taper pour rechercher…'} autoComplete="off"
        onFocus={(e) => { focus.current = true; setOuvert(true); e.target.select?.() }}
        onChange={saisie} onBlur={sortie}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOuvert(false); e.target.blur() } }}
        style={inputStyle} />
      {ouvert && filtrees.length > 0 && (
        <div role="listbox" style={{
          position: 'absolute', zIndex: 1400, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1px solid rgba(15,26,46,.14)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(15,26,46,.18)', maxHeight: 220, overflowY: 'auto',
        }}>
          {filtrees.map(o => (
            <div key={o.value} role="option" aria-selected={o.value === courant}
              // onPointerDown + preventDefault (pas onClick) : empêche le champ de
              // perdre le focus avant la sélection — sinon le onBlur (sortie) se
              // déclenche en premier sur mobile et referme la liste sans choisir.
              onPointerDown={(e) => { e.preventDefault(); choisir(o) }}
              style={{
                padding: '10px 14px', fontSize: 13.5, cursor: o.disabled ? 'not-allowed' : 'pointer',
                color: o.disabled ? 'var(--rzc-text-4,#8B95A1)' : 'var(--rzc-text,#0F1A2E)',
                background: o.value === courant ? 'var(--rzc-ore-gold-l,rgba(201,151,43,.12))' : 'transparent',
              }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
