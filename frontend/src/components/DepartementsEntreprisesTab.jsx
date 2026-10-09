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
  const [nouvelleEnt, setNouvelleEnt] = useState({ nom:'', rattache:'' })

  const charger = () => {
    departementsAPI.list().then(r => setDeps(r.data?.results || r.data || [])).catch(() => {})
    entreprisesAPI.list().then(r => setEnts(r.data?.results || r.data || [])).catch(() => {})
  }
  useEffect(charger, [])

  // valeur de la liste « Rattaché à » : "d:<id>" (département) ou "e:<id>" (entreprise mère)
  const valeurRattache = (e) => e.entreprise_mere ? `e:${e.entreprise_mere}` : (e.departement ? `d:${e.departement}` : '')
  const payloadRattache = (v) => v.startsWith('e:') ? { entreprise_mere: Number(v.slice(2)), departement: null } : { departement: Number(v.slice(2)), entreprise_mere: null }

  const agir = async (fn, ok) => { try { await fn(); if (ok) toast.success(ok); charger() } catch (e) { toast.error(msgErr(e)) } }

  const optionsRattache = (exclureId) => (<>
    <optgroup label="Département ROXGOLD">
      {deps.filter(d => d.actif).map(d => <option key={`d${d.id}`} value={`d:${d.id}`}>{d.nom}</option>)}
    </optgroup>
    <optgroup label="Sous-traitant de… (entreprise mère)">
      {ents.filter(x => x.actif && x.id !== exclureId && !x.entreprise_mere).map(x => <option key={`e${x.id}`} value={`e:${x.id}`}>{x.nom}</option>)}
    </optgroup>
  </>)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'12px 16px', fontSize:12.5, color:'#1e40af' }}>
        ℹ️ Tout employé ROXGOLD appartient à un <b>département</b> ; un visiteur est rattaché à un département ; un <b>sous-traitant</b> dépend soit d'un département de ROXGOLD, soit de MOTA (ou d'une autre entreprise mère). Ces listes alimentent la fiche Personnel.
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
                    <input defaultValue={d.nom} disabled={!isAdmin} style={{ ...inp, width:'100%', padding:'5px 8px', fontWeight:600 }}
                      onBlur={e => { const v = e.target.value.trim(); if (v && v !== d.nom) agir(() => departementsAPI.update(d.id, { nom:v }), 'Renommé (fiches mises à jour)'); else e.target.value = d.nom }} />
                  </td>
                  <td style={{ ...td, textAlign:'center' }}>{ents.filter(x => x.departement_effectif_nom === d.nom).length}</td>
                  <td style={{ ...td, textAlign:'center' }}>{d.nb_personnel}</td>
                  <td style={{ ...td, textAlign:'center' }}><span style={pastille(d.actif)}>{d.actif ? 'Actif' : 'Inactif'}</span></td>
                  {isAdmin && (
                    <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
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
            <select value={nouvelleEnt.rattache} onChange={e=>setNouvelleEnt(n=>({...n, rattache:e.target.value}))} style={{ ...inp, minWidth:220 }}>
              <option value="">— Rattachée à… —</option>
              {optionsRattache(null)}
            </select>
            <button disabled={!nouvelleEnt.nom.trim() || !nouvelleEnt.rattache} style={btn('#C9972B')}
              onClick={() => agir(() => entreprisesAPI.create({ nom:nouvelleEnt.nom.trim(), ...payloadRattache(nouvelleEnt.rattache) }).then(() => setNouvelleEnt({ nom:'', rattache:'' })), 'Sous-traitant ajouté')}>➕ Ajouter</button>
          </div>
        )}
        <div style={{ overflowX:'auto', border:'1px solid #e2e8f0', borderRadius:10 }}>
          <table style={tbl}>
            <thead><tr>
              <th style={{ ...th, width:44 }}>#</th><th style={th}>Entreprise</th><th style={th}>Rattachée à</th>
              <th style={th}>Département ROXGOLD</th><th style={{ ...th, textAlign:'center' }}>Statut</th>
              {isAdmin && <th style={{ ...th, textAlign:'right' }}>Actions</th>}
            </tr></thead>
            <tbody>
              {ents.map((x, i) => (
                <tr key={x.id} style={{ opacity:x.actif ? 1 : .55, background: i % 2 ? '#f8fafc' : '#fff' }}>
                  <td style={{ ...td, color:'#94a3b8' }}>{i + 1}</td>
                  <td style={td}>
                    <input defaultValue={x.nom} disabled={!isAdmin} style={{ ...inp, width:'100%', padding:'5px 8px', fontWeight:600 }}
                      onBlur={e => { const v = e.target.value.trim(); if (v && v !== x.nom) agir(() => entreprisesAPI.update(x.id, { nom:v }), 'Renommé (fiches mises à jour)'); else e.target.value = x.nom }} />
                  </td>
                  <td style={td}>
                    <select value={valeurRattache(x)} disabled={!isAdmin} style={{ ...inp, padding:'5px 8px', width:'100%', minWidth:180 }}
                      onChange={e => agir(() => entreprisesAPI.update(x.id, payloadRattache(e.target.value)))}>
                      {optionsRattache(x.id)}
                    </select>
                  </td>
                  <td style={{ ...td, fontWeight:600, color:'#0F2A5C' }}>{x.departement_effectif_nom || '—'}</td>
                  <td style={{ ...td, textAlign:'center' }}><span style={pastille(x.actif)}>{x.actif ? 'Actif' : 'Inactif'}</span></td>
                  {isAdmin && (
                    <td style={{ ...td, textAlign:'right', whiteSpace:'nowrap' }}>
                      <button title={x.actif ? 'Désactiver' : 'Réactiver'} style={btn(x.actif ? '#f1f5f9' : '#dcfce7', '#334155')} onClick={() => agir(() => entreprisesAPI.update(x.id, { actif: !x.actif }))}>{x.actif ? '⏸' : '▶'}</button>{' '}
                      <button title="Supprimer" style={btn('#fef2f2', '#dc2626')}
                        onClick={async () => { if (await confirmDialog(`Supprimer « ${x.nom} » ?`)) agir(() => entreprisesAPI.delete(x.id), 'Supprimé') }}>🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
              {ents.length === 0 && <tr><td style={{ ...td, color:'#94a3b8' }} colSpan={6}>Aucun sous-traitant.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
