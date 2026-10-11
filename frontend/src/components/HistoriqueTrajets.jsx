// Historique des trajets suivis par « Ma conduite » — onglet « Voyage » de la page Historique existante.
// Données 100 % serveur (positions, événements, durée, distance) ; exports PDF/CSV générés par le serveur.
import React, { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import MapSafe, { trajetValide } from './MapSafe'
import { suiviConvois } from '../api'
import { toast } from '../toast'
import { TILE_URL, TILE_ATTRIBUTION, CENTRE_DEFAUT } from './CarteConvoisDirect'
import { sauverBlob } from '../utils/gps'

const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 8, fontSize: 13, width: '100%', fontFamily: 'inherit' }
const STATUTS = { en_route: ['🚐 En route', '#2563eb'], arret: ['⏸️ À l\'arrêt', '#d97706'], arrive: ['🏁 Terminé', '#16a34a'] }
const COMPLETUDE = { complete: ['✅ Trace complète', '#16a34a'], partielle: ['⚠️ Trace partielle', '#d97706'], aucune: ['❌ Aucune position', '#dc2626'] }
const hms = (s) => s == null ? '—' : `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')} min`
const dt = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const COUL_EV = { depart: '#2563eb', arrivee: '#16a34a', reprise: '#64748b' }

function Detail({ rid, onFermer }) {
  const [rap, setRap] = useState(null)
  const [erreur, setErreur] = useState(false)
  useEffect(() => { suiviConvois.rapport(rid).then(r => setRap(r.data)).catch(() => setErreur(true)) }, [rid])
  const telecharger = async (type) => {
    try {
      const r = type === 'pdf' ? await suiviConvois.exportPdf(rid) : await suiviConvois.exportCsv(rid)
      sauverBlob(r.data, type === 'pdf' ? `rapport_trajet_${rid}.pdf` : `trajet_${rid}.csv`)
    } catch { toast.error('Téléchargement impossible') }
  }
  if (erreur) return <div style={{ padding: 16, color: '#dc2626' }}>Rapport indisponible (accès refusé ou trajet introuvable).</div>
  if (!rap) return <div style={{ padding: 16, color: 'var(--text-dim)' }}>Chargement…</div>
  const trace = trajetValide(rap.trace)
  const [cl, cc] = COMPLETUDE[rap.completude] || COMPLETUDE.aucune
  const marqueurs = rap.chronologie.filter(e => Number.isFinite(e.latitude) && Number.isFinite(e.longitude))
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontWeight: 800, color: 'var(--blue)' }}>Trajet {rap.rotation_id} · {rap.mission.origine || '—'} → {rap.mission.destination || '—'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => telecharger('pdf')} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📄 Télécharger le rapport PDF</button>
          <button onClick={() => telecharger('csv')} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>📊 Exporter les données CSV</button>
          <button onClick={onFermer} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Fermer</button>
        </div>
      </div>
      {rap.provisoire && <div style={{ marginTop: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>⏳ Données provisoires — le trajet n'est pas terminé.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8, margin: '10px 0' }}>
        {[['Chauffeur', rap.chauffeur || '—'], ['Véhicule', `${rap.vehicule || ''} ${rap.vehicule_matricule || ''}`.trim() || '—'],
          ['Départ', dt(rap.depart.heure)], ['Arrivée', rap.arrivee.heure ? dt(rap.arrivee.heure) : 'en cours'],
          ['Durée', hms(rap.duree_s)], ['Distance (estimation)', `${rap.distance_km} km`],
          ['Passagers au départ', rap.nb_passagers_depart], ['Positions GPS', rap.nb_positions]].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{v}</div>
          </div>))}
      </div>
      <div style={{ fontSize: 12, color: cc, fontWeight: 700, marginBottom: 8 }}>{cl} — <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>{rap.completude_detail}</span></div>
      {trace.length > 1 ? (
        <MapSafe libelle="La carte du trajet">
          <div style={{ height: 280, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <MapContainer bounds={trace} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <Polyline positions={trace} pathOptions={{ color: '#16A34A', weight: 5, opacity: .8 }} />
              {marqueurs.map((e, i) => (
                <CircleMarker key={i} center={[e.latitude, e.longitude]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: COUL_EV[e.type] || '#d97706', fillOpacity: 1 }}>
                  <Tooltip>{dt(e.heure)} — {e.libelle || 'Départ'}{e.lieu ? ` · ${e.lieu}` : ''}</Tooltip>
                </CircleMarker>))}
            </MapContainer>
          </div>
        </MapSafe>
      ) : <div style={{ padding: 14, background: 'var(--surface2)', borderRadius: 8, fontSize: 12, color: 'var(--text-dim)' }}>Carte indisponible : moins de 2 positions GPS enregistrées.</div>}
      <div style={{ fontWeight: 700, margin: '12px 0 6px', fontSize: 13 }}>Chronologie</div>
      {rap.chronologie.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
          <b style={{ minWidth: 118, color: COUL_EV[e.type] || '#d97706' }}>{dt(e.heure)}</b>
          <div><b>{e.libelle || 'Départ'}</b>{e.lieu ? ` — ${e.lieu}` : ''}{e.detail ? <span style={{ color: 'var(--text-dim)' }}> · {e.detail}</span> : null}</div>
        </div>))}
    </div>
  )
}

export default function HistoriqueTrajets() {
  const [f, setF] = useState({ du: '', au: '', chauffeur: '', vehicule: '', rotation_id: '', statut: '' })
  const [liste, setListe] = useState(null)
  const [sel, setSel] = useState(null)
  const chercher = useCallback(() => {
    const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v))
    suiviConvois.historique(params).then(r => setListe(r.data || [])).catch(() => { setListe([]); toast.error("Historique indisponible") })
  }, [f])
  useEffect(() => { chercher() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const champ = (k, label, type = 'text') => (
    <div><label style={{ display: 'block', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase' }}>{label}</label>
      <input type={type} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} style={inp} /></div>)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 10 }}>
        {champ('du', 'Du', 'date')}{champ('au', 'Au', 'date')}{champ('chauffeur', 'Chauffeur')}{champ('vehicule', 'Véhicule / immat.')}{champ('rotation_id', 'Mission / rotation')}
        <div><label style={{ display: 'block', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase' }}>Statut</label>
          <select value={f.statut} onChange={e => setF({ ...f, statut: e.target.value })} style={inp}>
            <option value="">Tous</option>{Object.entries(STATUTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
      </div>
      <button onClick={chercher} style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>🔍 Rechercher</button>
      {liste === null && <div style={{ color: 'var(--text-dim)' }}>Chargement…</div>}
      {liste && liste.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-dim)' }}>Aucun trajet suivi pour ces critères.</div>}
      {(liste || []).map(r => {
        const [sl, sc] = STATUTS[r.suivi?.statut] || ['—', '#64748b']
        return (
          <div key={r.rotation_id}>
            <div onClick={() => setSel(sel === r.rotation_id ? null : r.rotation_id)}
              style={{ background: '#fff', border: '1px solid var(--border)', borderLeft: `4px solid ${sc}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <b>{r.rotation_id} · {r.mission}</b><span style={{ color: sc, fontWeight: 700, fontSize: 12 }}>{sl}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>
                🧑‍✈️ {r.conducteur || '—'} · 🚐 {r.vehicule} {r.vehicule_matricule} · départ {dt(r.suivi?.depart_at)}
                {r.suivi?.arrivee_at && <> · durée {hms(r.suivi.duree_s)} · ~{r.suivi.distance_km} km</>}
              </div>
            </div>
            {sel === r.rotation_id && <Detail rid={r.rotation_id} onFermer={() => setSel(null)} />}
          </div>)
      })}
    </div>
  )
}
