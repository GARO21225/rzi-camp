// Espace « Validations » (admin) : demandes de voyage (page Demandes) et voyages en attente de décision.
import { C } from '../utils/theme'
import { fmt } from '../utils/format'
import { Panel } from './ui'

const Bouton = ({ couleur, actif, disabled, onClick, children }) => (
  <button className="mc-btn" style={{ background: couleur, color: '#fff', opacity: actif ? .6 : 1 }} disabled={disabled} onClick={onClick}>
    {actif ? '⏳ …' : children}
  </button>
)

export default function MobilityValidations({ voyages, demandes, enCours, agir, envoyer }) {
  const enAttente = voyages.filter(v => v.statut_validation === 'en_attente')
  if (enAttente.length === 0 && demandes.length === 0) {
    return (
      <div className="mc-fade">
        <Panel style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <div style={{ color: C.muted, fontSize: 13 }}>Aucune demande en attente de validation.</div>
        </Panel>
      </div>
    )
  }
  return (
    <div className="mc-fade">
      {demandes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: .5 }}>
            📨 Demandes de voyage ({demandes.length})
          </div>
          {demandes.map(d => {
            const kv = `vd${d.id}`, kr = `rd${d.id}`
            return (
              <Panel key={kv} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{d.demandeur_nom}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      🧳 {d.donnees?.origine ? `${d.donnees.origine} → ` : ''}{d.donnees?.destination || '—'} · {fmt(d.date_debut_souhaitee)} → {fmt(d.date_fin_souhaitee)}
                      {d.donnees?.vehicule_personnel && <> · <b>🚗 Véhicule personnel{d.donnees?.immatriculation ? ` (${d.donnees.immatriculation})` : ''}</b></>}
                    </div>
                    {d.message_demandeur && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Motif : {d.message_demandeur}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Bouton couleur={C.green} actif={enCours[kv]} disabled={!!enCours[kv] || !!enCours[kr]}
                      onClick={() => agir(kv, () => envoyer(`/api/demandes/${d.id}/valider/`, {}, 'Demande validée'))}>✅ Valider</Bouton>
                    <Bouton couleur={C.red} actif={enCours[kr]} disabled={!!enCours[kv] || !!enCours[kr]}
                      onClick={() => agir(kr, async () => {
                        const motif = prompt(`Motif du rejet de la demande de ${d.demandeur_nom} (obligatoire) :`)
                        if (!motif) return
                        await envoyer(`/api/demandes/${d.id}/rejeter/`, { commentaire: motif }, 'Demande rejetée')
                      })}>❌ Rejeter</Bouton>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>
      )}
      {enAttente.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {enAttente.map(v => {
            const kv = `vv${v.id}`, kr = `rv${v.id}`
            return (
              <Panel key={v.id} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{v.personnel_nom}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                      {v.personnel_societe} · 🧳 {v.origine ? `${v.origine} → ` : ''}{v.destination} · {fmt(v.date_depart)} → {fmt(v.date_retour_prevue)}
                    </div>
                    {v.motif && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Motif : {v.motif}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Bouton couleur={C.green} actif={enCours[kv]} disabled={!!enCours[kv] || !!enCours[kr]}
                      onClick={() => agir(kv, () => envoyer(`/api/voyages/${v.id}/valider/`, {}, 'Voyage validé'))}>✅ Valider</Bouton>
                    <Bouton couleur={C.red} actif={enCours[kr]} disabled={!!enCours[kv] || !!enCours[kr]}
                      onClick={() => agir(kr, async () => {
                        const motif = prompt(`Motif du refus du voyage de ${v.personnel_nom} vers ${v.destination} (obligatoire) :`)
                        if (!motif) return
                        await envoyer(`/api/voyages/${v.id}/refuser/`, { motif }, 'Voyage refusé')
                      })}>❌ Refuser</Bouton>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>
      )}
    </div>
  )
}
