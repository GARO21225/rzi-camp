import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from 'recharts'
import { restaurants as api } from '../api'
import { toast, confirmDialog } from '../toast'

const COULEURS = ['#0f2a5c', '#c9972b', '#7c3aed', '#2563eb', '#16a34a', '#dc2626', '#0891b2']
const isoJour = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const carte = { background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,.07)', marginBottom: 14 }
const inp = { border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit' }
const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' })

function Tuile({ label, valeur, couleur }) {
  return (
    <div style={{ flex: '1 1 140px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: couleur }}>{valeur}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Barres({ titre, data }) {
  const rows = (data || []).map(([nom, n]) => ({ nom, n }))
  if (!rows.length) return null
  return (
    <div style={carte}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 8 }}>{titre}</div>
      <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 34)}>
        <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 20 }}>
          <XAxis type="number" allowDecimals={false} fontSize={11} />
          <YAxis type="category" dataKey="nom" width={150} fontSize={11} />
          <Tooltip />
          <Bar dataKey="n" name="Repas" radius={[0, 4, 4, 0]}>
            {rows.map((_, i) => <Cell key={i} fill={COULEURS[i % COULEURS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Rapport({ restos }) {
  const auj = new Date()
  const [debut, setDebut] = useState(isoJour(new Date(auj.getTime() - 6 * 86400000)))
  const [fin, setFin] = useState(isoJour(auj))
  const [resto, setResto] = useState('')
  const [d, setD] = useState(null)
  const [chargement, setChargement] = useState(false)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const r = await api.rapport({ debut, fin, ...(resto ? { restaurant: resto } : {}) })
      setD(r.data)
    } catch (e) { toast.error(e.response?.data?.error || 'Rapport indisponible'); setD(null) }
    finally { setChargement(false) }
  }, [debut, fin, resto])
  useEffect(() => { charger() }, [charger])

  const raccourci = (jours) => { const f = new Date(); setFin(isoJour(f)); setDebut(isoJour(new Date(f.getTime() - (jours - 1) * 86400000))) }
  const csv = () => {
    if (!d) return
    const lignes = [['Date', 'Repas servis'], ...d.par_jour, [], ['Restaurant', 'Repas'], ...d.par_restaurant, [], ['Superviseur', 'Scans'], ...d.par_superviseur, [], ['Société', 'Repas'], ...d.par_societe]
    const blob = new Blob(['﻿' + lignes.map(l => l.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `repas_${debut}_${fin}.csv`; a.click()
  }
  const serie = (d?.par_jour || []).map(([j, n]) => ({ jour: `${j.slice(8, 10)}/${j.slice(5, 7)}`, n }))
  const repasCols = ['Petit-déjeuner', 'Déjeuner', 'Dîner']

  return (
    <div>
      <div style={{ ...carte, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={debut} onChange={e => setDebut(e.target.value)} style={inp} />
        <span>→</span>
        <input type="date" value={fin} onChange={e => setFin(e.target.value)} style={inp} />
        {[[1, "Aujourd'hui"], [7, '7 jours'], [30, '30 jours']].map(([j, l]) => (
          <button key={j} onClick={() => raccourci(j)} style={{ ...btn('#e2e8f0'), color: '#334155' }}>{l}</button>))}
        <select value={resto} onChange={e => setResto(e.target.value)} style={inp}>
          <option value="">Tous les restaurants</option>
          {restos.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
        </select>
        <button onClick={csv} disabled={!d} style={{ ...btn('#16a34a'), marginLeft: 'auto' }}>📥 CSV</button>
        <button onClick={() => window.print()} style={btn('#475569')}>🖨️ Imprimer</button>
      </div>
      {chargement && <div style={{ textAlign: 'center', padding: 30 }}>⏳</div>}
      {d && !chargement && (<>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <Tuile label="Repas servis" valeur={d.total} couleur="#0f2a5c" />
          <Tuile label="Moyenne / jour" valeur={d.moyenne_par_jour} couleur="#2563eb" />
          <Tuile label="Personnes distinctes" valeur={d.personnes_uniques} couleur="#16a34a" />
          <Tuile label="Jours" valeur={d.nb_jours} couleur="#c9972b" />
        </div>
        {d.total === 0 && <div style={{ ...carte, textAlign: 'center', color: '#64748b' }}>Aucun repas scanné sur cette période.</div>}
        {d.nb_jours > 1 && d.total > 0 && (
          <div style={carte}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Repas servis par jour</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={serie}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="jour" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip />
                <Line type="monotone" dataKey="n" name="Repas" stroke="#0f2a5c" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
            </ResponsiveContainer>
          </div>)}
        <Barres titre="Par restaurant" data={d.par_restaurant} />
        <Barres titre="Par repas" data={d.par_repas} />
        <Barres titre="Par superviseur (scans effectués)" data={d.par_superviseur} />
        <Barres titre="Par société" data={d.par_societe} />
        <Barres titre="Affluence par heure" data={d.par_heure} />
        {Object.keys(d.matrice).length > 0 && (
          <div style={carte}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Restaurant × repas</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ background: '#0f2a5c', color: '#fff' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>Restaurant</th>{repasCols.map(c => <th key={c} style={{ textAlign: 'right', padding: 6 }}>{c}</th>)}</tr></thead>
              <tbody>{Object.entries(d.matrice).map(([r, m]) => (
                <tr key={r} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: 6 }}>{r}</td>
                  {repasCols.map(c => <td key={c} style={{ textAlign: 'right', padding: 6 }}>{m[c] || 0}</td>)}</tr>))}</tbody>
            </table>
          </div>)}
      </>)}
      <div style={{ fontSize: 12, color: '#64748b' }}>
        📧 L'envoi automatique par email se règle dans Paramétrage → Rapports par email (type « Restauration »).
      </div>
    </div>
  )
}

function Affectations({ restos, recharger, peutGerer }) {
  const [candidats, setCandidats] = useState([])
  const [q, setQ] = useState('')
  const [nouveau, setNouveau] = useState('')
  useEffect(() => {
    if (!peutGerer) return
    const t = setTimeout(() => api.candidats(q).then(r => setCandidats(r.data || [])).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [q, peutGerer])

  const affecter = async (r, ids) => {
    try { await api.affecter(r.id, ids); recharger() } catch (e) { toast.error(e.response?.data?.error || 'Erreur') }
  }
  const ajouter = async () => {
    if (!nouveau.trim()) return
    try { await api.create({ nom: nouveau.trim() }); setNouveau(''); recharger() } catch (e) { toast.error(e.response?.data?.error || 'Erreur') }
  }
  if (!peutGerer) return <div style={carte}>Seul le Camp Boss peut affecter les superviseurs. Vos restaurants : {restos.map(r => r.nom).join(', ') || 'aucun'}.</div>
  return (
    <div>
      <div style={{ ...carte, fontSize: 12.5, color: '#475569' }}>
        Le Camp Boss affecte un ou plusieurs superviseurs à chaque restaurant. Seuls eux scannent les QR des agents à l'entrée de leur restaurant.
      </div>
      <div style={{ ...carte, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Nouveau restaurant…" value={nouveau} onChange={e => setNouveau(e.target.value)} style={{ ...inp, flex: 1, minWidth: 180 }} />
        <button onClick={ajouter} style={btn('#2563eb')}>➕ Ajouter</button>
        <input placeholder="🔍 Chercher un utilisateur…" value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, minWidth: 200 }} />
      </div>
      {restos.map(r => {
        const ids = r.superviseurs.map(s => s.id)
        return (
          <div key={r.id} style={{ ...carte, opacity: r.actif ? 1 : .55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input defaultValue={r.nom} style={{ ...inp, fontWeight: 700, flex: 1, minWidth: 180 }}
                onBlur={async e => { const v = e.target.value.trim(); if (v && v !== r.nom) { try { await api.update(r.id, { nom: v }); recharger() } catch (er) { toast.error(er.response?.data?.error || 'Erreur') } } }} />
              <label style={{ fontSize: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
                <input type="checkbox" checked={r.actif} onChange={async e => { await api.update(r.id, { actif: e.target.checked }); recharger() }} /> Actif
              </label>
              <button onClick={async () => { if (await confirmDialog(`Supprimer « ${r.nom} » ? (désactivé si des repas y sont rattachés)`)) { await api.supprimer(r.id); recharger() } }}
                style={{ ...btn('#fef2f2'), color: '#dc2626', border: '1px solid #fecaca' }}>🗑️</button>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Superviseurs ({ids.length})</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {r.superviseurs.length === 0 && <span style={{ fontSize: 12, color: '#dc2626' }}>Aucun superviseur — personne ne peut scanner ici.</span>}
              {r.superviseurs.map(s => (
                <span key={s.id} style={{ background: '#eff6ff', color: '#1e40af', borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  👨‍🍳 {s.nom} <button onClick={() => affecter(r, ids.filter(i => i !== s.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>×</button>
                </span>))}
            </div>
            <select value="" onChange={e => { if (e.target.value) affecter(r, [...ids, Number(e.target.value)]) }} style={{ ...inp, maxWidth: 320 }}>
              <option value="">➕ Affecter un superviseur…</option>
              {candidats.filter(c => !ids.includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.nom}{c.role ? ` (${c.role})` : ''}</option>)}
            </select>
          </div>)
      })}
    </div>
  )
}

function Reglages() {
  const [reserve, setReserve] = useState(null)
  useEffect(() => { api.reglages().then(r => setReserve(r.data.scan_reserve)).catch(() => {}) }, [])
  const maj = async (v) => { try { const r = await api.setReglages({ scan_reserve: v }); setReserve(r.data.scan_reserve); toast.success('Réglage enregistré') } catch { toast.error('Erreur') } }
  if (reserve === null) return null
  return (
    <div style={carte}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={reserve} onChange={e => maj(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
        <span><b>Scan réservé aux superviseurs affectés</b><br />
          <span style={{ fontSize: 12, color: '#64748b' }}>Activé : seuls les superviseurs affectés à un restaurant (et le Camp Boss / admin) peuvent valider un repas. Désactivé : tout le personnel Restauration peut scanner (le restaurant est alors facultatif).</span></span>
      </label>
    </div>
  )
}

export default function RestaurantsGestion() {
  const [onglet, setOnglet] = useState('rapport')
  const [restos, setRestos] = useState([])
  const [peutGerer, setPeutGerer] = useState(false)

  const charger = useCallback(() => {
    api.list().then(r => setRestos(r.data || [])).catch(() => {})
    api.mes().then(r => setPeutGerer(!!r.data.peut_gerer)).catch(() => {})
  }, [])
  useEffect(() => { charger() }, [charger])

  const onglets = [['rapport', '📊 Rapport & graphiques'], ['affectations', '👨‍🍳 Restaurants & superviseurs'], ...(peutGerer ? [['reglages', '⚙️ Réglages']] : [])]
  return (
    <div className="rzc-page-scope" style={{ padding: 16, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f2a5c', margin: '0 0 12px' }}>🍽️ Restaurants du camp</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {onglets.map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
              background: onglet === k ? '#0f2a5c' : '#e2e8f0', color: onglet === k ? '#fff' : '#475569' }}>{l}</button>))}
      </div>
      {onglet === 'rapport' && <Rapport restos={restos.filter(r => r.actif)} />}
      {onglet === 'affectations' && <Affectations restos={restos} recharger={charger} peutGerer={peutGerer} />}
      {onglet === 'reglages' && peutGerer && <Reglages />}
    </div>
  )
}
