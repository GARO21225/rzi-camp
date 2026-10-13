import { useState, useEffect, useCallback } from 'react'
import ChoixPersonne from '../components/ChoixPersonne'
import { restaurants as api, qr as qrAPI } from '../api'
import { toast, confirmDialog } from '../toast'

// RESTAURANTS — affectation des superviseurs + réglages (Paramétrage). Le tableau de bord est dans la page Restauration.
const NAVY = '#0f2a5c', OR = '#c9972b'
const carte = { background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(15,23,42,.08)', border: '1px solid #eef2f7' }
const titreCarte = { fontWeight: 800, fontSize: 13.5, color: '#0f172a', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }
const inp = { border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#0f172a' }
const btn = (bg, fg = '#fff') => ({ background: bg, color: fg, border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' })

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
            <ChoixPersonne placeholder="➕ Saisir un nom pour affecter un superviseur…"
              options={candidats.filter(c => !ids.includes(c.id)).map(c => ({ id: c.id, nom: c.nom, detail: c.role }))}
              onChoisir={id => affecter(r, [...ids, id])} />
          </div>)
      })}
    </div>
  )
}

function Reglages() {
  const [r, setR] = useState(null)
  const charger = () => api.reglages().then(x => setR(x.data)).catch(() => {})
  useEffect(() => { charger() }, [])
  const maj = async (d) => { try { const x = await api.setReglages(d); setR(x.data); toast.success('Réglage enregistré') } catch { toast.error('Erreur') } }
  const regenerer = async () => {
    if (!(await confirmDialog("Régénérer les QR de tous les badges ? Les badges déjà signés restent identiques ; les anciens QR (numéro seul) deviennent invalides et les badges sont à réimprimer."))) return
    try { const x = await qrAPI.regenererTousQr(); toast.success(x.data.message || 'QR régénérés'); charger() } catch (e) { toast.error(e.response?.data?.error || 'Erreur') }
  }
  if (!r) return null
  const ligne = (champ, valeur, titre, aide) => (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid #eef2f7' }}>
      <input type="checkbox" checked={valeur} onChange={e => maj({ [champ]: e.target.checked })} style={{ width: 18, height: 18, marginTop: 2 }} />
      <span><b>{titre}</b><br /><span style={{ fontSize: 12, color: '#64748b' }}>{aide}</span></span>
    </label>)
  return (
    <div style={{ ...carte, maxWidth: 820 }}>
      {ligne('scan_reserve', r.scan_reserve, 'Scan réservé aux superviseurs affectés',
        "Activé : seuls les superviseurs affectés à un restaurant (et le Camp Boss / admin) valident un repas. Désactivé : toute l'équipe Restauration peut scanner.")}
      {ligne('qr_signe_obligatoire', r.qr_signe_obligatoire, 'QR signé obligatoire (anti-fraude)',
        "Activé : le scan refuse un numéro seul (« 0042 »), que n'importe qui pourrait taper. Seuls les QR signés des badges sont acceptés.")}
      <div style={{ padding: '12px 0' }}>
        <div style={{ fontSize: 13 }}>Badges actifs sans QR signé : <b style={{ color: r.qr_non_signes ? '#dc2626' : '#16a34a' }}>{r.qr_non_signes}</b></div>
        <button onClick={regenerer} style={{ ...btn(NAVY), marginTop: 8 }}>🔁 Régénérer les QR de tous les badges</button>
      </div>
    </div>
  )
}


export default function RestaurantsGestion() {
  const [onglet, setOnglet] = useState('affectations')
  const [restos, setRestos] = useState([])
  const [peutGerer, setPeutGerer] = useState(false)

  const charger = useCallback(() => {
    api.list().then(r => setRestos(r.data || [])).catch(() => {})
    api.mes().then(r => setPeutGerer(!!r.data.peut_gerer)).catch(() => {})
  }, [])
  useEffect(() => { charger() }, [charger])

  const onglets = [['affectations', '👨‍🍳 Restaurants & superviseurs'], ...(peutGerer ? [['reglages', '⚙️ Réglages du scan']] : [])]
  return (
    <div className="rzc-page-scope" style={{ padding: '16px 20px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>🍽️ Restaurants — paramétrage</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {onglets.map(([k, l]) => (
            <button key={k} onClick={() => setOnglet(k)}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5,
                background: onglet === k ? NAVY : '#e2e8f0', color: onglet === k ? '#fff' : '#475569' }}>{l}</button>))}
        </div>
        <a href="/restauration" style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>📊 Tableau de bord → page Restauration</a>
      </div>
      {onglet === 'affectations' && <Affectations restos={restos} recharger={charger} peutGerer={peutGerer} />}
      {onglet === 'reglages' && peutGerer && <Reglages />}
    </div>
  )
}
