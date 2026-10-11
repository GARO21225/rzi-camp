import React, { useEffect, useState } from 'react'
import { batiments, itinerairesModeles } from '../api'
import { toast, confirmDialog } from '../toast'
import { villesDescente, joursPour, libelleJours, messageJour } from '../utils/itineraires'

// « Il part — libérer la chambre » pour le compte d'un résident : on demande l'itinéraire, OÙ IL DESCEND
// (nécessaire au JMP et au suivi) et SA DATE DE RETOUR, comme dans le formulaire du résident lui-même.
export default function DepartResidentForm({ batimentId, onDone, onCancel }) {
  const [itineraires, setItineraires] = useState([])
  const [itineraireId, setItineraireId] = useState('')
  const [destination, setDestination] = useState('')
  const [dateRetour, setDateRetour] = useState('')
  const [perso, setPerso] = useState(false)
  const [immat, setImmat] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    itinerairesModeles.list().then(r => {
      const actifs = (r.data?.results || r.data || []).filter(i => i.actif !== false)
      const depuisCamp = actifs.filter(i => /camp|sango/i.test(i.origine || ''))
      setItineraires(actifs)
      const liste = depuisCamp.length ? depuisCamp : actifs
      const defaut = liste.find(i => /^camp$/i.test((i.origine || '').trim()) && /^abidjan$/i.test((i.destination || '').trim())) || liste[0]
      if (defaut) { setItineraireId(String(defaut.id)); const v = villesDescente(defaut); setDestination(v[v.length - 1] || '') }
    }).catch(() => {})
  }, [])

  const proposes = (() => { const d = itineraires.filter(i => /camp|sango/i.test(i.origine || '')); return d.length ? d : itineraires })()
  const itin = itineraires.find(i => String(i.id) === itineraireId) || null
  const villes = villesDescente(itin)
  const joursRetour = itin ? joursPour(itineraires, destination || itin.destination, itin.origine) : null
  const avertissement = itin && dateRetour ? messageJour(itineraires, destination || itin.destination, itin.origine, dateRetour) : null

  const envoyer = async (forcer = false) => {
    setBusy(true)
    try {
      await batiments.confirmerDepart(batimentId, {
        action: 'confirme', itineraire_id: itin?.id, destination, date_retour: dateRetour,
        vehicule_personnel: perso, ...(perso && immat.trim() ? { immatriculation: immat.trim() } : {}),
        ...(forcer ? { forcer_jour: true } : {}),
      })
      toast.success('Départ enregistré — chambre libérée.')
      onDone && onDone()
    } catch (e) {
      const d = e.response?.data || {}
      if (d.code === 'jour_non_autorise' && d.forcable && await confirmDialog(`${d.error}\n\nForcer quand même ?`)) return envoyer(true)
      toast.error(d.error || 'Erreur')
    } finally { setBusy(false) }
  }

  const inp = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box' }
  const lab = { fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 3 }
  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10 }}>
        <label style={lab}>Itinéraire
          <select value={itineraireId} onChange={e => { setItineraireId(e.target.value); const v = villesDescente(itineraires.find(i => String(i.id) === e.target.value)); setDestination(d => v.includes(d) ? d : (v[v.length - 1] || '')) }} style={inp}>
            {proposes.map(i => <option key={i.id} value={i.id}>{i.nom}</option>)}
          </select>
        </label>
        <label style={lab}>Il descend à *
          <select value={destination} onChange={e => setDestination(e.target.value)} style={inp}>
            {villes.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={lab}>Il revient le *
          <input type="date" value={dateRetour} onChange={e => setDateRetour(e.target.value)} style={inp} />
          {joursRetour && <span style={{ fontWeight: 400, color: '#64748b' }}>Retours : {libelleJours(joursRetour)}</span>}
        </label>
      </div>
      {avertissement && <div style={{ color: '#b45309', fontSize: 11.5, marginTop: 6 }}>⚠️ {avertissement}</div>}
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginTop: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={perso} onChange={e => setPerso(e.target.checked)} /> Véhicule personnel
        {perso && <input value={immat} onChange={e => setImmat(e.target.value)} placeholder="Immatriculation" style={{ ...inp, width: 160, marginLeft: 6 }} />}
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button disabled={busy || !dateRetour || !destination} onClick={() => envoyer(false)}
          style={{ background: (busy || !dateRetour || !destination) ? '#94a3b8' : '#16A34A', color: '#fff', border: 'none', borderRadius: 99, padding: '6px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          {busy ? '⏳…' : '✅ Confirmer le départ'}
        </button>
        <button onClick={onCancel} style={{ background: '#f1f5f9', border: 'none', borderRadius: 99, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Annuler</button>
      </div>
    </div>
  )
}
