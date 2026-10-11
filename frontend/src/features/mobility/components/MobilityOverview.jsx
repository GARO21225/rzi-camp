// Vue d'ensemble du Centre de Mobilité : synthèse opérationnelle + accès direct aux espaces.
import { useMemo } from 'react'
import { calculerVueEnsemble } from '../utils/vueEnsemble'

const COUL = { rouge: '#DC2626', ambre: '#D4A017' }

function Carte({ icone, titre, valeur, sous, couleur = '#0F1A2E', onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      style={{ textAlign: 'left', background: '#fff', border: '1px solid rgba(15,26,46,.10)', borderRadius: 12, padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default', minHeight: 92 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#5B6472' }}>{titre}</div>
        <span style={{ fontSize: 20, opacity: .7 }}>{icone}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: couleur, lineHeight: 1.1, marginTop: 6 }}>{valeur}</div>
      {sous && <div style={{ fontSize: 11, color: '#5B6472', marginTop: 4 }}>{sous}</div>}
    </button>
  )
}

export default function MobilityOverview({ voyages, rotations, demandesAOrganiser, demandesVoyageEnAttente, rappels, isAdmin, onNavigate, loading }) {
  const today = new Date().toISOString().slice(0, 10)
  const v = useMemo(() => calculerVueEnsemble({ voyages, rotations, demandesAOrganiser, demandesVoyageEnAttente, rappels, today }),
    [voyages, rotations, demandesAOrganiser, demandesVoyageEnAttente, rappels, today])

  if (loading && !rotations.length && !voyages.length) {
    return <div style={{ padding: 30, textAlign: 'center', color: '#5B6472' }}>⏳ Chargement…</div>
  }
  const grille = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }
  return (
    <div className="mc-fade">
      <div style={grille}>
        <Carte icone="🚀" titre="Départs aujourd'hui" valeur={v.departsAujourdhui.length}
          sous={v.departsAujourdhui.length ? v.departsAujourdhui.slice(0, 2).map(r => `${(r.heure_depart || '').slice(0, 5) || '—'} ${r.destination}`).join(' · ') : 'Aucun convoi prévu'}
          couleur="#C9972B" onClick={() => onNavigate('rotations')} />
        <Carte icone="🧳" titre="Voyages en cours" valeur={v.voyagesEnCours.length}
          sous={`${v.rotationsEnCours.length} convoi(s) en route`} couleur="#D4A017" onClick={() => onNavigate(isAdmin ? 'direct' : 'rotations')} />
        <Carte icone="🏠" titre="Retours attendus" valeur={v.retoursAttendus.length}
          sous="Date de retour atteinte ou dépassée" couleur="#16A34A" onClick={() => onNavigate('liste')} />
        {isAdmin && <Carte icone="📋" titre="À organiser" valeur={v.aOrganiser}
          sous="Sans convoi affecté" couleur={v.aOrganiser ? '#7C3AED' : '#0F1A2E'} onClick={() => onNavigate('organiser')} />}
        {isAdmin && <Carte icone="✅" titre="À valider" valeur={v.enAttenteValidation}
          sous="Demandes en attente de décision" couleur={v.enAttenteValidation ? '#DC2626' : '#0F1A2E'} onClick={() => onNavigate('validations')} />}
        <Carte icone="🚌" titre="Occupation des convois" valeur={v.capacite.pct == null ? '—' : `${v.capacite.pct}%`}
          sous={v.capacite.places ? `${v.capacite.occupees}/${v.capacite.places} places (convois à venir)` : 'Aucun convoi à venir'} couleur="#0891B2" />
      </div>

      <div style={{ background: '#fff', border: '1px solid rgba(15,26,46,.10)', borderRadius: 12, padding: '14px 16px', marginTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#5B6472', marginBottom: 8 }}>
          ⚠️ Alertes opérationnelles ({v.alertes.length})
        </div>
        {v.alertes.length === 0
          ? <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>✅ Rien à signaler.</div>
          : v.alertes.slice(0, 12).map((a, i) => (
            <div key={i} onClick={a.rotation_id ? () => onNavigate('rotations') : undefined}
              style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: i ? '1px solid rgba(15,26,46,.06)' : 'none',
                fontSize: 13, color: '#0F1A2E', cursor: a.rotation_id ? 'pointer' : 'default' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: COUL[a.niveau], flexShrink: 0 }} />
              {a.texte}
            </div>
          ))}
      </div>
    </div>
  )
}
