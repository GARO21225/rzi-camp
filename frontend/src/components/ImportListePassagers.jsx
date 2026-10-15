import React, { useMemo, useState } from 'react'

// Import d'une liste de passagers dans un convoi : on choisit sur QUOI on cherche
// (téléphone, matricule, email, nom), on colle ou charge la liste, chaque ligne est
// recherchée dans la liste du personnel puis on valide ce qu'on ajoute.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const normTel = (v) => String(v || '').replace(/\D/g, '').replace(/^225/, '').slice(-9)

const CLES = {
  telephone: { label: 'Téléphone / WhatsApp', exemple: '0701234567', cherche: (p, v) => !!normTel(v) && (normTel(p.telephone) === normTel(v) || normTel(p.numero_whatsapp) === normTel(v) || normTel(p.telephone_2) === normTel(v)), tel: true },
  matricule: { label: 'Matricule', exemple: 'a001', cherche: (p, v) => !!norm(v) && norm(p.numero) === norm(v) },
  email:     { label: 'Email', exemple: 'prenom.nom@exemple.com', cherche: (p, v) => !!norm(v) && norm(p.email) === norm(v) },
  nom:       { label: 'Nom complet (Nom Prénom)', exemple: 'KOUAME Edgar', cherche: (p, v) => !!norm(v) && [`${p.nom} ${p.prenom}`, `${p.prenom} ${p.nom}`].map(norm).includes(norm(v)) },
}

const parserLignes = (texte, cle) => {
  const lignes = String(texte || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lignes.length) return []
  const sep = (l) => (l.includes(';') ? ';' : l.includes('\t') ? '\t' : ',')
  const entetes = lignes[0].split(sep(lignes[0])).map(norm)
  const aEntete = entetes.some(h => ['telephone', 'tel', 'matricule', 'email', 'nom', 'whatsapp', 'numero'].includes(h))
  let col = 0
  if (aEntete) {
    const cibles = { telephone: ['telephone', 'tel', 'whatsapp', 'numero_whatsapp'], matricule: ['matricule', 'numero'], email: ['email', 'mail'], nom: ['nom', 'nom complet', 'nom_complet'] }[cle]
    const i = entetes.findIndex(h => cibles.includes(h))
    col = i >= 0 ? i : 0
  }
  return (aEntete ? lignes.slice(1) : lignes).flatMap(l => {
    // une valeur par ligne ; en mode « nom » la virgule peut séparer plusieurs noms collés sur une ligne
    const parts = (cle === 'nom' && !aEntete) ? [l] : (aEntete ? [l.split(sep(l))[col]] : l.split(/[;,]+/))
    return parts.map(x => (x || '').trim().replace(/^"|"$/g, '')).filter(Boolean)
  })
}

export default function ImportListePassagers({ convoi, personnel, dejaIds, libres, onClose, onAjouter, enCours }) {
  const [cle, setCle] = useState('telephone')
  const [texte, setTexte] = useState('')
  const [exclus, setExclus] = useState({})   // lignes décochées
  const valeurs = useMemo(() => parserLignes(texte, cle), [texte, cle])

  const lignes = useMemo(() => {
    const vus = new Set()
    return valeurs.map((v, i) => {
      const trouves = personnel.filter(p => CLES[cle].cherche(p, v))
      let statut = 'ok'
      const p = trouves[0] || null
      if (!trouves.length) statut = 'introuvable'
      else if (trouves.length > 1) statut = 'ambigu'
      else if (dejaIds.includes(p.id)) statut = 'deja'
      else if (vus.has(p.id)) statut = 'doublon'
      if (statut === 'ok') vus.add(p.id)
      return { i, v, p, statut, candidats: trouves }
    })
  }, [valeurs, cle, personnel, dejaIds])

  const cochables = lignes.filter(l => l.statut === 'ok')
  const retenus = cochables.filter(l => !exclus[l.i])
  const depasse = retenus.length - libres

  const telechargerModele = () => {
    const ex = personnel.slice(0, 2).map(p => ({ telephone: p.telephone || p.numero_whatsapp, matricule: p.numero, email: p.email, nom: `${p.nom} ${p.prenom}` }[cle])).filter(Boolean)
    const exemples = ex.length ? ex : [CLES[cle].exemple]
    const csv = '﻿' + [cle, ...exemples].join('\r\n') + '\r\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `modele_passagers_${cle}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const chargerFichier = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const lecteur = new FileReader()
    lecteur.onload = () => { setTexte(String(lecteur.result || '')); setExclus({}) }
    lecteur.readAsText(f)
    e.target.value = ''
  }

  const BADGE = {
    ok:          ['#16a34a', '✓ Trouvé'],
    deja:        ['#64748b', 'Déjà dans ce convoi'],
    doublon:     ['#64748b', 'Doublon dans la liste'],
    introuvable: ['#dc2626', '✗ Introuvable dans le personnel'],
    ambigu:      ['#d97706', '⚠ Plusieurs personnes'],
  }
  const inp = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', color: '#0f172a', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 20px', background: '#0F2A5C', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>📋 Importer une liste — {convoi?.vehicule || convoi?.rotation_id}</div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', width: 28, height: 28, fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Chercher dans le personnel par
              <select value={cle} onChange={e => { setCle(e.target.value); setExclus({}) }} style={{ ...inp, display: 'block', marginTop: 4, minWidth: 220 }}>
                {Object.entries(CLES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={telechargerModele} style={{ ...inp, background: '#f1f5f9', cursor: 'pointer', fontWeight: 700 }}>⬇️ Télécharger le modèle</button>
            <label style={{ ...inp, background: '#f1f5f9', cursor: 'pointer', fontWeight: 700 }}>📂 Charger un fichier (.csv / .txt)
              <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={chargerFichier} style={{ display: 'none' }} />
            </label>
          </div>
          <textarea value={texte} onChange={e => { setTexte(e.target.value); setExclus({}) }} rows={5}
            placeholder={`Colle la liste ici : un(e) ${CLES[cle].label.toLowerCase()} par ligne\n(ex. ${CLES[cle].exemple})`}
            style={{ ...inp, width: '100%', fontFamily: 'monospace', resize: 'vertical' }} />

          {lignes.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead><tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '6px 8px', width: 30 }}></th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Saisi</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Personne trouvée</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Résultat</th>
                  </tr></thead>
                  <tbody>
                    {lignes.map(l => (
                      <tr key={l.i} style={{ borderTop: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '5px 8px' }}>
                          {l.statut === 'ok' && <input type="checkbox" checked={!exclus[l.i]} onChange={e => setExclus(x => ({ ...x, [l.i]: !e.target.checked }))} />}
                        </td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{l.v}</td>
                        <td style={{ padding: '5px 8px' }}>
                          {l.p ? <><b>{l.p.nom} {l.p.prenom}</b> <span style={{ color: '#64748b' }}>· {l.p.societe || '—'}</span></> : '—'}
                          {l.statut === 'ambigu' && <div style={{ color: '#d97706', fontSize: 11 }}>{l.candidats.map(c => `${c.nom} ${c.prenom}`).join(' / ')}</div>}
                        </td>
                        <td style={{ padding: '5px 8px', color: BADGE[l.statut][0], fontWeight: 700 }}>{BADGE[l.statut][1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: depasse > 0 ? '#dc2626' : '#475569' }}>
            {lignes.length > 0 && <>{retenus.length} à ajouter · {lignes.filter(l => l.statut === 'introuvable').length} introuvable(s) · {libres} place(s) libre(s) dans le convoi{depasse > 0 ? ` — ${depasse} en trop : décoche des lignes` : ''}</>}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ ...inp, background: '#f1f5f9', cursor: 'pointer', fontWeight: 700 }}>Annuler</button>
            <button disabled={!retenus.length || depasse > 0 || enCours} onClick={() => onAjouter(retenus.map(l => l.p))}
              style={{ ...inp, border: 'none', background: (!retenus.length || depasse > 0 || enCours) ? '#cbd5e1' : '#C9972B', color: '#fff', fontWeight: 800, cursor: (!retenus.length || depasse > 0 || enCours) ? 'not-allowed' : 'pointer' }}>
              {enCours ? '⏳ Ajout…' : `➕ Ajouter ${retenus.length} passager(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
