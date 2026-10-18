import React, { useState, useEffect, useCallback } from 'react'
import { technicien as techAPI, incidents as incAPI, plaintes as plaintesAPI } from '../api'
import { toast, confirmDialog } from '../toast'
import { useSurPulse } from '../hooks/useSurPulse'
import PhotoCapture from './PhotoCapture'

const PRIO = { critique: '#dc2626', haute: '#f97316', moyenne: '#eab308', basse: '#64748b' }
const STATUT = {
  assigne: 'À traiter', en_cours: 'En cours', affectee: 'À traiter', prise_en_charge: 'Prise en charge', en_attente: 'En attente', reouverte: 'Rouverte',
}
const msg = (e) => e?.response?.data?.error || e?.response?.data?.detail || 'Action impossible'

const Kpi = ({ icone, libelle, valeur, couleur, suffixe }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', borderLeft: `4px solid ${couleur}` }}>
    <div style={{ fontSize: 11, color: '#64748b' }}>{icone} {libelle}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{valeur ?? '—'}{valeur != null && suffixe ? <span style={{ fontSize: 13, fontWeight: 600 }}> {suffixe}</span> : null}</div>
  </div>
)

const Pastille = ({ t }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${PRIO[t.priorite] || '#64748b'}20`, color: PRIO[t.priorite] || '#64748b' }}>{t.priorite}</span>
)

function LigneTache({ t, onOuvrir, actions }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 20 }}>{t.type === 'incident' ? '🔧' : '🧹'}</div>
      <div style={{ flex: 1, minWidth: 180, cursor: t.type === 'incident' && onOuvrir ? 'pointer' : 'default' }} onClick={() => t.type === 'incident' && onOuvrir?.(t.id)}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>#{t.id} · {t.titre}</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          📍 {t.residence}{t.bloc ? ` ${t.bloc}` : ''} · {STATUT[t.statut] || t.statut}{t.occupant ? ` · ${t.occupant}` : ''}{t.sla_depasse ? ' · ⏰ SLA dépassé' : ''}
        </div>
      </div>
      <Pastille t={t} />
      {actions}
    </div>
  )
}

const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

/** Mon tableau de bord : indicateurs clés + liste des tâches assignées (incidents Maintenance et plaintes). */
export function TableauTechnicien({ technicienId, onOuvrirIncident }) {
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState('')
  const [resoudre, setResoudre] = useState(null)
  const [texte, setTexte] = useState('')
  const [photoApres, setPhotoApres] = useState('')
  const charger = useCallback(() => techAPI.tableau(technicienId).then(r => { setD(r.data); setErreur('') }).catch(e => setErreur(msg(e))), [technicienId])
  useEffect(() => { charger() }, [charger])
  useSurPulse(['incidents', 'plaintes', 'notifs'], charger)

  const agir = async (fn, ok) => { try { await fn(); toast.success(ok); charger() } catch (e) { toast.error(msg(e)) } }
  if (erreur) return <div style={{ padding: 16, color: '#dc2626' }}>{erreur}</div>
  if (!d) return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>⏳ Chargement…</div>
  const k = d.kpi
  const taches = [...d.incidents, ...d.plaintes]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {technicienId && <div style={{ fontWeight: 700, color: '#0f172a' }}>Tableau de {d.technicien.nom}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <Kpi icone="📥" libelle="À traiter" valeur={k.a_traiter} couleur="#f97316" />
        <Kpi icone="⚙️" libelle="En cours" valeur={k.en_cours} couleur="#eab308" />
        <Kpi icone="⏸️" libelle="En attente" valeur={k.en_attente} couleur="#64748b" />
        <Kpi icone="🚨" libelle="Critiques" valeur={k.critiques} couleur="#dc2626" />
        <Kpi icone="⏰" libelle="SLA dépassé" valeur={k.sla_depasse} couleur="#b91c1c" />
        <Kpi icone="✅" libelle="Résolus (7 j)" valeur={k.resolus_7j} couleur="#16a34a" />
        <Kpi icone="📊" libelle="Résolus (30 j)" valeur={k.resolus_30j} couleur="#15803d" />
        <Kpi icone="⏱️" libelle="Temps moyen" valeur={k.temps_moyen_h} suffixe="h" couleur="#2563eb" />
        <Kpi icone="🎯" libelle="SLA respecté" valeur={k.taux_sla_pct} suffixe="%" couleur="#7c3aed" />
      </div>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>Mes tâches ({taches.length})</div>
      {taches.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>Aucune tâche assignée 🎉</div>}
      {d.incidents.map(t => <LigneTache key={`i${t.id}`} t={t} onOuvrir={onOuvrirIncident} actions={onOuvrirIncident && (
        <button style={btn(t.statut === 'en_cours' ? '#16a34a' : '#eab308')} onClick={() => onOuvrirIncident(t.id)}>
          {t.statut === 'en_cours' ? '✅ Terminer' : '⚙️ Traiter'}
        </button>
      )} />)}
      {d.plaintes.map(t => (
        <LigneTache key={`p${t.id}`} t={t} actions={!technicienId && (
          <div style={{ display: 'flex', gap: 6 }}>
            {t.statut === 'affectee' && <button style={btn('#2563eb')} onClick={() => agir(() => plaintesAPI.prendreEnCharge(t.id), 'Plainte prise en charge')}>Prendre en charge</button>}
            {['prise_en_charge', 'en_attente'].includes(t.statut) && <button style={btn('#eab308')} onClick={() => agir(() => plaintesAPI.demarrer(t.id), 'Intervention démarrée')}>Démarrer</button>}
            {['prise_en_charge', 'en_cours', 'en_attente', 'reouverte'].includes(t.statut) && <button style={btn('#16a34a')} onClick={() => { setResoudre(t); setTexte(''); setPhotoApres('') }}>Résoudre</button>}
          </div>
        )} />
      ))}
      {resoudre && (
        <div onClick={() => setResoudre(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>✅ Résoudre la plainte #{resoudre.id}</div>
            <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={4} placeholder="Action réalisée…" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #cbd5e1', padding: 8, fontFamily: 'inherit', marginBottom: 10 }} />
            <PhotoCapture label="Photo après intervention" requis value={photoApres} onChange={setPhotoApres} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{ ...btn('#94a3b8'), flex: 1 }} onClick={() => setResoudre(null)}>Annuler</button>
              <button style={{ ...btn('#16a34a'), flex: 1 }} disabled={!texte.trim() || !photoApres} onClick={() => { const t = resoudre; setResoudre(null); agir(() => plaintesAPI.resoudre(t.id, { action_resolution: texte.trim(), photo_resolution_base64: photoApres }), 'Plainte résolue') }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Liste des assignations en 2 blocs : administrateurs en haut, techniciens en bas. Réassigner / retirer (admin). */
export function AssignationsPanel({ onOuvrirIncident }) {
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState('')
  const [cible, setCible] = useState({}) // clé tâche -> id du nouveau responsable
  const charger = useCallback(() => techAPI.assignations().then(r => { setD(r.data); setErreur('') }).catch(e => setErreur(msg(e))), [])
  useEffect(() => { charger() }, [charger])
  useSurPulse(['incidents', 'plaintes'], charger)
  if (erreur) return <div style={{ padding: 16, color: '#dc2626' }}>{erreur}</div>
  if (!d) return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>⏳ Chargement…</div>

  const tous = [...d.admins, ...d.techniciens]
  const cle = (t) => `${t.type}${t.id}`
  const reassigner = async (t) => {
    const vers = cible[cle(t)]
    if (!vers) return
    try {
      if (t.type === 'incident') await incAPI.assigner(t.id, { technicien_id: vers })
      else await plaintesAPI.affecter(t.id, { affecte_a: vers })
      toast.success('Tâche réassignée'); setCible(c => ({ ...c, [cle(t)]: '' })); charger()
    } catch (e) { toast.error(msg(e)) }
  }
  const retirer = async (t) => {
    if (!(await confirmDialog(`Retirer l'assignation de « ${t.titre} » ?`))) return
    try { await (t.type === 'incident' ? incAPI.retirer(t.id) : plaintesAPI.retirer(t.id)); toast.success('Assignation retirée'); charger() } catch (e) { toast.error(msg(e)) }
  }
  const bloc = (titre, personnes, couleur) => (
    <div>
      <div style={{ fontWeight: 800, fontSize: 14, color: couleur, margin: '4px 0 8px' }}>{titre} ({personnes.length})</div>
      {personnes.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12, padding: 8 }}>Personne</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {personnes.map(p => (
          <div key={p.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>👤 {p.nom} <span style={{ fontWeight: 500, color: '#64748b', fontSize: 11 }}>· {p.nb_incidents} incident(s) · {p.nb_plaintes} plainte(s)</span></div>
            {p.taches.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>Aucune tâche</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.taches.map(t => (
                <LigneTache key={cle(t)} t={t} onOuvrir={onOuvrirIncident} actions={
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={cible[cle(t)] || ''} onChange={e => setCible(c => ({ ...c, [cle(t)]: e.target.value }))} style={{ padding: 6, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, maxWidth: 160 }}>
                      <option value="">Réassigner à…</option>
                      <optgroup label="Administrateurs">{d.admins.filter(a => a.id !== p.id).map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>
                      <optgroup label="Techniciens">{d.techniciens.filter(a => a.id !== p.id).map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}</optgroup>
                    </select>
                    <button style={btn('#2563eb')} disabled={!cible[cle(t)]} onClick={() => reassigner(t)}>🔁</button>
                    <button style={btn('#dc2626')} onClick={() => retirer(t)} title="Retirer l'assignation">✖ Retirer</button>
                  </div>} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {tous.length === 0 && <div style={{ color: '#94a3b8' }}>Aucun responsable.</div>}
      {bloc('🛡️ Administrateurs', d.admins, '#1e3a8a')}
      {bloc('👷 Techniciens', d.techniciens, '#c2410c')}
    </div>
  )
}
