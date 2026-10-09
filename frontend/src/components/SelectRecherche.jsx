import React, { useEffect, useId, useRef, useState } from 'react'

// Remplaçant direct de <select> : on peut TAPER pour filtrer/choisir (noms, chambres,
// véhicules…) ou ouvrir la liste. Mêmes enfants <option>, même onChange(e) avec
// e.target.value — on remplace simplement <select> par <SelectRecherche>.
const texte = (ch) => React.Children.toArray(ch).map(x => (x && typeof x === 'object' ? texte(x.props?.children) : String(x))).join('')

function aplatir(children, out = []) {
  React.Children.forEach(children, (c) => {
    if (!c || typeof c !== 'object') return
    if (c.type === React.Fragment || c.type === 'optgroup') aplatir(c.props.children, out)
    else if (c.type === 'option') out.push({ value: String(c.props.value ?? texte(c.props.children)), label: texte(c.props.children), disabled: !!c.props.disabled })
  })
  return out
}

export default function SelectRecherche({ value, defaultValue, onChange, children, style, disabled, required, className, id }) {
  const uid = useId()
  const options = aplatir(children)
  const controle = value !== undefined
  const [interne, setInterne] = useState(String(defaultValue ?? ''))
  const courant = controle ? String(value ?? '') : interne
  const choisie = options.find(o => o.value === courant && o.value !== '')
  const [txt, setTxt] = useState(choisie?.label || '')
  const focus = useRef(false)
  const vide = options.find(o => o.value === '')

  useEffect(() => { if (!focus.current) setTxt(choisie?.label || '') }, [courant, choisie?.label])

  const emettre = (v) => {
    if (!controle) setInterne(v)
    onChange?.({ target: { value: v }, currentTarget: { value: v } })
  }
  const saisie = (e) => {
    const t = e.target.value
    setTxt(t)
    if (t === '') { emettre(''); return }
    const exact = options.find(o => o.value !== '' && !o.disabled && o.label === t)
    if (exact) emettre(exact.value)
  }
  const sortie = () => {
    focus.current = false
    if (txt === '') { setTxt(''); return }
    if (choisie && txt === choisie.label) return
    const t = txt.trim().toLowerCase()
    const cand = options.filter(o => o.value !== '' && !o.disabled && o.label.toLowerCase().includes(t))
    if (cand.length === 1) { setTxt(cand[0].label); emettre(cand[0].value) }
    else setTxt(choisie?.label || '')
  }
  return (
    <>
      <input id={id} className={className} list={uid} value={txt} disabled={disabled} required={required}
        placeholder={vide?.label || 'Taper pour rechercher…'} autoComplete="off"
        onFocus={(e) => { focus.current = true; e.target.select?.() }} onChange={saisie} onBlur={sortie}
        style={{ boxSizing: 'border-box', ...style }} />
      <datalist id={uid}>
        {options.filter(o => o.value !== '' && !o.disabled).map(o => <option key={o.value} value={o.label} />)}
      </datalist>
    </>
  )
}
