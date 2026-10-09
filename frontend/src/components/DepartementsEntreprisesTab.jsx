import React, { useEffect, useState } from 'react'
import { departementsAPI, entreprisesAPI } from '../api'
import { toast, confirmDialog } from '../toast'

const inp = { border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px', fontSize:13, boxSizing:'border-box' }
const btn = (bg, color='#fff') => ({ background:bg, color, border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12.5, fontWeight:700 })
const tbl = { width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:560 }
const th = { textAlign:'left', padding:'10px 12px', background:'#0F2A5C', color:'#fff', fontSize:11.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'.4px' }
const td = { padding:'7px 12px', borderBottom:'1px solid #e2e8f0', verticalAlign:'middle' }
const pastille = (ok) => ({ background: ok ? '#dcfce7' : '#f1f5f9', color: ok ? '#15803d' : '#64748b', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700 })
const msgErr = (e) => e.response?.data?.error || Object.values(e.response?.data || {}).flat().join(' ') || 'Erreur'

// Paramétrage → Départements & sous-traitants : alimente les listes déroulantes de la fiche
// Personnel (employé Roxgold / visiteur → département ; sous-traitant → entreprise, rattachée
// à un département de ROXGOLD ou à une entreprise mère comme MOTA).
export default function DepartementsEntreprisesTab({ isAdmin }) {
  const [deps, setDeps] = useState([])
  const [ents, setEnts] = useState([])
  const [nouveauDep, setNouveauDep] = useState('')
  const [nouvelleEnt, setNouvelleEnt] = useState({ nom:'', parent:'roxgold', dep:'' })
  const [nomsDep, setNomsDep] = useState({})   // renommages de départements non enregistrés
  const [brouillons, setBrouillons] = useState({})   // modifications non enregistrées par entreprise

  const charger = () => {
    departementsAPI.list().then(r => setDeps(r.data?.results || r.data || [])).catch(() => {})
    entreprisesAPI.list().then(r => setEnts(r.data?.results || r.data || [])).catch(() => {})
  }
  useEffect(charger, [])

  // « Rattachée à » : ROXGOLD (→ il faut alors préciser le département) ou une entreprise mère (ex. MOTA ENGIL)
  const meres = ents.filter(x => x.actif && !x.entreprise_mere && !x.departement)   // entreprises sans département (ex. MOTA)
  const etatInitial = (e) => ({ nom:e.nom, parent: e.entreprise_mere ? `e:${e.entreprise_mere}` : (e.departement ? 'roxgold' : 'aucune'), dep: e.departement ? String(e.departement) : '' })
  const etat = (e) => brouillons[e.id] || etatInitial(e)
  const modifie = (e) => { const b = brouillons[e.id]; if (!b) return false; const i = etatInitial(e); return b.nom !== i.nom || b.parent !== i.parent || b.dep !== i.dep }
  const majBrouillon = (e, patch) => setBrouillons(b => ({ ...b, [e.id]: { ...etat(e), ...patch } }))
  const payloadRattache = (parent, dep) => parent === 'roxgold'
    ? { departement: Number(dep), entreprise_mere: null }
    : parent === 'aucune' ? { departement: null, entreprise_mere: null }
    : { entreprise_mere: Number(parent.slice(2)), departement: null }
  const rattacheOk = (parent, dep) => parent !== 'roxgold' || !!dep

  const agir = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); charger() } catch (e) { toast.error(msgErr(e)) } }
  const enregistrer = (e) => {
    const b = etat(e)
    if (!b.nom.trim()) return toast.error('Nom requis.')
    if (!rattacheOk(b.parent, b.dep)) return toast.error('Entreprise ROXGOLD : choisis le département.')
    agir(() => entreprisesAPI.update(e.id, { nom:b.nom.trim(), ...payloadRattache(b.parent, b.dep) })
      .then(() => setBrouillons(x => { const n = { ...x }; delete n[e.id]; return n })), 'Modifications enregistrées')
  }

  const selectParent = (valeur, onChange, disabled, excl) => (
    <select value={valeur} disabled={disabled} style={{ ...inp, padding:'5px 8px', width:'100%', minWidth:150 }} onChange={ev => onChange(ev.target.value)}>
      <option value="roxgold">ROXGOLD</option>
      {valeur === 'aucune' && <option value="aucune">— Entreprise principale (sans département)</option>}
      {meres.filter(m => m.id !== excl).map(m => <option key={m.id} value={`e:${m.id}`}>{m.nom}</option>)}
    </select>
  )
  const selectDep = (valeur, onChange, disabled) => (
    <select value={valeur} disabled={disabled} style={{ ...inp, padding:'5px 8px', width:'100%', minWidth:150 }} onChange={ev => onChange(ev.target.value)}>
      <option value="">— Département —</option>
      {deps.filter(d => d.actif || String(d.id) === valeur).map(d => <option key={d.id} value={String(d.id)}>{d.nom}</option>)}
    </select>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 16px', fontSize:12.5, color:'#1e40af' }}>
        ℹ️ Tout employé ROXGOLD appartient à un <b>département</b> ; un visiteur est rattaché à un département ; un <b>sous-traitant</b> est rattaché à une entreprise : <b>ROXGOLD</b> (on précise alors le département) ou <b>MOTA</b> (MOTA n'a pas de département). Ces listes alimentent la fiche Personnel.
      </div>

      <section>
        <div style={{ fontWeight:700, fontSize:15, color:'#0F2A5C', marginBottom:10 }}>🏢 Départements ROXGOLD ({deps.filter(d=>d.actif).length})</div>
        {isAdmin && (
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <input value={nouveauDep} onChange={e=>setNouveauDep(e.target.value)} placeholder="Nouveau département" style={{ ...inp, flex:1, minWidth:180 }}
              onKeyDown={e => { if (e.key === 'Enter' && nouveauDep.trim()) agir(() => departementsAPI.create({ nom:nouveauDep.trim(), ordre: deps.length + 1 }).then(() => setNouveauDep('')), 'Département ajouté') }} />
            <button disabled={!nouveauDep.trim()} style={btn('#C9972B')}
              onClick={() => agir(() => departementsAPI.create({ nom:nouveauDep.trim(), ordre: deps.length + 1 }).then(() => setNouveauDep('')), 'Département ajouté')}>➕ Ajouter</button>
          </div>
        )}
        <div style={{ overflowX:'auto', border:'1px solid #e2e8f0', borderRadius:10 }}>
          <table style={tbl}>
            <thead><tr>
              <th style={{ ...th, width:44 }}>#</th><th style={th}>Département</th>
              <th style={{ ...th, textAlign:'center' }}>Sous-traitants</th><th style={{ ...th, textAlign:'center' }}>Personnel actif</th>
              <th style={{ ...th, textAlign:'center' }}>Statut</th>{isAdmin && <th style={{ ...th, textAlign:'right' }}>Actions</th>}
            </tr></thead>
            <tbody>
              {deps.map((d, i) => (
                <tr key={d.id} style={{ opacity:d.actif ? 1 : .55, background: i % 2 ? '#f8fafc' : '#fff' }}>
                  <td style={{ ...td, color:'#94a3b8' }}>{i + 1}</td>
                  <td style={td}>
                    <input value={nomsDep[d.id] ?? d.nom} disabled={!isAdmin} style={{ ...inp, width:'100%', padding:'5px 8px', fontWeight:600 }}
                      onChange={e => setNomsDep(n => ({ ...n, [d.id]: e.target.value }))} />
                  </td>
                  <td style={{ ...td, textAlign:'center' }}>{ents.filter(x => x.departement_effectif_nom === d.nom).length}</td>
                  <td style={{ ...td, textAlign:'center' }}>{d.nb_personnel}</td>
                  <td style={{ ...td, textAlign:'center' }}><span style={pastille(d.actif)}>{d.actif ? 'Actif' : 'Inactif'}</span></td>
                  {isAdmin && (
                    <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
                      {(() => { const v = (nomsDep[d.id] ?? d.nom).trim(); const dirty = nomsDep[d.id] !== undefined && v && v !== d.nom
                        return <><button title="Enregistrer le nom" disabled={!dirty} style={{ ...btn(dirty ? '#16a34a' : '#e2e8f0', dirty ? '#fff' : '#94a3b8'), cursor: dirty ? 'pointer' : 'default' }}
                          onClick={() => agir(() => departementsAPI.update(d.id, { nom:v }).then(() => setNomsDep(n => { const m = { ...n }; delete m[d.id]; return m })), 'Renommé (fiches mises à jour)')}>💾 Enregistrer</button>{' '}</> })()}
                      <button title={d.actif ? 'Désactiver' : 'Réactiver'} style={btn(d.actif ? '#f1f5f9' : '#dcfce7', '#334155')} onClick={() => agir(() => departementsAPI.update(d.id, { actif: !d.actif }))}>{d.actif ? '⏸' : '▶'}</button>{' '}
                      <button title="Supprimer" style={btn('#fef2f2', '#dc2626')}
                        onClick={async () => { if (await confirmDialog(`Supprimer le département « ${d.nom} » ?`)) agir(() => departementsAPI.delete(d.id), 'Supprimé') }}>🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
              {deps.length === 0 && <tr><td style={{ ...td, color:'#94a3b8' }} colSpan={6}>Aucun département.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div style={{ fontWeight:700, fontSize:15, color:'#0F2A5C', marginBottom:10 }}>🏗️ Sous-traitants ({ents.filter(e=>e.actif).length})</div>
        {isAdmin && (
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <input value={nouvelleEnt.nom} onChange={e=>setNouvelleEnt(n=>({...n, nom:e.target.value}))} placeholder="Nom de l'entreprise" style={{ ...inp, flex:1, minWidth:180 }} />
            <div style={{ minWidth:160 }}>{selectParent(nouvelleEnt.parent, v => setNouvelleEnt(n => ({ ...n, parent:v })), false, null)}</div>
            {nouvelleEnt.parent === 'roxgold' && <div style={{ minWidth:170 }}>{selectDep(nouvelleEnt.dep, v => setNouvelleEnt(n => ({ ...n, dep:v })), false)}</div>}
            <button disabled={!nouvelleEnt.nom.trim() || !rattacheOk(nouvelleEnt.parent, nouvelleEnt.dep)} style={btn('#C9972B')}
              onClick={() => agir(() => entreprisesAPI.create({ nom:nouvelleEnt.nom.trim(), ...payloadRattache(nouvelleEnt.parent, nouvelleEnt.dep) }).then(() => setNouvelleEnt({ nom:'', parent:'roxgold', dep:'' })), 'Sous-traitant ajouté')}>➕ Ajouter</button>
          </div>
        )}
        <div style={{ overflowX:'auto', border:'1px solid #e2e8f0', borderRadius:10 }}>
          <table style={tbl}>
            <thead><tr>
              <th style={{ ...th, width:44 }}>#</th><th style={th}>Entreprise</th><th style={th}>Rattachée à</th>
              <th style={th}>Département (si ROXGOLD)</th><th style={{ ...th, textAlign:'center' }}>Statut</th>
              {isAdmin && <th style={{ ...th, textAlign:'right' }}>Actions</th>}
            </tr></thead>
            <tbody>
              {ents.map((x, i) => { const b = etat(x); const dirty = modifie(x); return (
                <tr key={x.id} style={{ opacity:x.actif ? 1 : .55, background: dirty ? '#fffbeb' : (i % 2 ? '#f8fafc' : '#fff') }}>
                  <td style={{ ...td, color:'#94a3b8' }}>{i + 1}</td>
                  <td style={td}><input value={b.nom} disabled={!isAdmin} onChange={e => majBrouillon(x, { nom:e.target.value })} style={{ ...inp, width:'100%', padding:'5px 8px', fontWeight:600 }} /></td>
                  <td style={td}>{selectParent(b.parent, v => majBrouillon(x, { parent:v, dep: v === 'roxgold' ? b.dep : '' }), !isAdmin, x.id)}</td>
                  <td style={td}>{b.parent === 'roxgold'
                    ? selectDep(b.dep, v => majBrouillon(x, { dep:v }), !isAdmin)
                    : <span style={{ color:'#64748b', fontSize:12 }}>→ {x.departement_effectif_nom || '—'}</span>}</td>
                  <td style={{ ...td, textAlign:'center' }}><span style={pastille(x.actif)}>{x.actif ? 'Actif' : 'Inactif'}</span></td>
                  {isAdmin && (
                    <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
                      <button title="Enregistrer les modifications" disabled={!dirty} style={{ ...btn(dirty ? '#16a34a' : '#e2e8f0', dirty ? '#fff' : '#94a3b8'), cursor: dirty ? 'pointer' : 'default' }} onClick={() => enregistrer(x)}>💾 Enregistrer</button>{' '}
                      {dirty && <button title="Annuler" style={btn('#f1f5f9', '#334155')} onClick={() => setBrouillons(bb => { const n = { ...bb }; delete n[x.id]; return n })}>↩</button>}{' '}
                      <button title={x.actif ? 'Désactiver' : 'Réactiver'} style={btn(x.actif ? '#f1f5f9' : '#dcfce7', '#334155')} onClick={() => agir(() => entreprisesAPI.update(x.id, { actif: !x.actif }))}>{x.actif ? '⏸' : '▶'}</button>{' '}
                      <button title="Supprimer" style={btn('#fef2f2', '#dc2626')}
                        onClick={async () => { if (await confirmDialog(`Supprimer « ${x.nom} » ?`)) agir(() => entreprisesAPI.delete(x.id), 'Supprimé') }}>🗑️</button>
                    </td>
                  )}
                </tr>
              )})}
              {ents.length === 0 && <tr><td style={{ ...td, color:'#94a3b8' }} colSpan={6}>Aucun sous-traitant.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
