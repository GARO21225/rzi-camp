import React, { useEffect, useState } from 'react'
import { departementsAPI, entreprisesAPI } from '../api'
import { toast, confirmDialog } from '../toast'

const inp = { border:'1px solid #e2e8f0', borderRadius:8, padding:'8px 12px', fontSize:13, boxSizing:'border-box' }
const btn = (bg, color='#fff') => ({ background:bg, color, border:'none', padding:'8px 14px', borderRadius:8, cursor:'pointer', fontSize:12.5, fontWeight:700 })
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:8 }}>
          {deps.map(d => (
            <div key={d.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center', gap:8, opacity:d.actif ? 1 : .55 }}>
              <input defaultValue={d.nom} disabled={!isAdmin} style={{ ...inp, flex:1, minWidth:0, padding:'5px 8px', fontWeight:600 }}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== d.nom) agir(() => departementsAPI.update(d.id, { nom:v }), 'Renommé (fiches mises à jour)'); else e.target.value = d.nom }} />
              <span title="Personnel actif" style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>👤 {d.nb_personnel}</span>
              {isAdmin && (<>
                <button title={d.actif ? 'Désactiver' : 'Réactiver'} style={btn(d.actif ? '#f1f5f9' : '#dcfce7', '#334155')} onClick={() => agir(() => departementsAPI.update(d.id, { actif: !d.actif }))}>{d.actif ? '⏸' : '▶'}</button>
                <button title="Supprimer" style={btn('#fef2f2', '#dc2626')}
                  onClick={async () => { if (await confirmDialog(`Supprimer le département « ${d.nom} » ?`)) agir(() => departementsAPI.delete(d.id), 'Supprimé') }}>🗑️</button>
              </>)}
            </div>
          ))}
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
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {ents.map(x => (
            <div key={x.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:'8px 10px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', opacity:x.actif ? 1 : .55 }}>
              <input defaultValue={x.nom} disabled={!isAdmin} style={{ ...inp, flex:'1 1 200px', minWidth:0, padding:'5px 8px', fontWeight:600 }}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== x.nom) agir(() => entreprisesAPI.update(x.id, { nom:v }), 'Renommé (fiches mises à jour)'); else e.target.value = x.nom }} />
              <select value={valeurRattache(x)} disabled={!isAdmin} style={{ ...inp, padding:'5px 8px', minWidth:200 }}
                onChange={e => agir(() => entreprisesAPI.update(x.id, payloadRattache(e.target.value)))}>
                {optionsRattache(x.id)}
              </select>
              <span style={{ fontSize:11, color:'#64748b' }}>{x.entreprise_mere ? `→ ${x.departement_effectif_nom || '—'}` : ''}</span>
              {isAdmin && (<>
                <button title={x.actif ? 'Désactiver' : 'Réactiver'} style={btn(x.actif ? '#f1f5f9' : '#dcfce7', '#334155')} onClick={() => agir(() => entreprisesAPI.update(x.id, { actif: !x.actif }))}>{x.actif ? '⏸' : '▶'}</button>
                <button title="Supprimer" style={btn('#fef2f2', '#dc2626')}
                  onClick={async () => { if (await confirmDialog(`Supprimer « ${x.nom} » ?`)) agir(() => entreprisesAPI.delete(x.id), 'Supprimé') }}>🗑️</button>
              </>)}
            </div>
          ))}
          {ents.length === 0 && <div style={{ color:'#94a3b8', fontSize:13 }}>Aucun sous-traitant.</div>}
        </div>
      </section>
    </div>
  )
}
