import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useStore } from '../store'
import { personnel as personnelAPI, voyages as voyagesAPI, evenements as evenementsAPI, demandes as demandesAPI } from '../api'
import { ROLE_LABELS, getRole, iconeEtLibelle } from '../constants/roleNav'
import { nomAffiche } from '../components/MobileChrome'

// ════════════════════════════════════════════════════════════════
// Accueil résident — direction « Filon d'or » : nuit marine profonde
// traversée de courbes de niveau dorées (la géologie du site), typo
// industrielle (IBM Plex Sans, largeur normale), chiffres en mono. Le hero sombre est
// réservé à cet écran d'accueil ; les cartes en dessous restent claires
// et lisibles en plein soleil sur le terrain.
// ════════════════════════════════════════════════════════════════

const NUIT = '#06142E'
const NUIT_2 = '#0B2350'
const OR = '#E3B23C'
const OR_PROFOND = '#C9972B'
const ENCRE = '#0F1A2E'
const GRIS = '#5B6472'
const DISPLAY = "'IBM Plex Sans', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"
const CLE_CACHE = 'rzc_accueil' // effacé à la déconnexion (localStorage.clear())

function salutation() {
  const h = new Date().getHours()
  if (h < 5) return 'Bonne nuit'
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

const jourJ = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((d - t) / 86400000)
}

/** Courbes de niveau dorées, qui dérivent lentement (signature de l'écran). */
function CourbesDeNiveau() {
  const lignes = Array.from({ length: 9 }, (_, i) => i)
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .55 }}>
      <defs>
        <linearGradient id="filon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={OR} stopOpacity=".05" />
          <stop offset=".55" stopColor={OR} stopOpacity=".55" />
          <stop offset="1" stopColor={OR} stopOpacity=".08" />
        </linearGradient>
      </defs>
      {lignes.map(i => (
        <path key={i}
          d={`M -40 ${40 + i * 26} C 60 ${10 + i * 24}, 140 ${90 + i * 22}, 230 ${50 + i * 25} S 380 ${20 + i * 27}, 460 ${70 + i * 23}`}
          fill="none" stroke="url(#filon)" strokeWidth={i === 4 ? 1.6 : .8} />
      ))}
    </svg>
  )
}

/** Ligne de route : villes du trajet, ville de descente en or, la suite estompée. */
function LigneDeRoute({ voyage }) {
  const etapes = [...(voyage.etapes || [])].filter(e => e.sens !== 'retour').sort((a, b) => a.ordre - b.ordre)
  const villes = etapes.length
    ? [etapes[0].origine, ...etapes.map(e => e.destination)].filter(Boolean)
    : [voyage.origine, voyage.destination].filter(Boolean)
  const iDescente = Math.max(0, villes.findIndex(v => v?.toLowerCase() === voyage.destination?.toLowerCase()))
  const fin = iDescente || villes.length - 1
  // Fait défiler la ligne pour que la ville de descente soit visible
  const refDescente = useRef(null)
  useEffect(() => { refDescente.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' }) }, [fin])
  return (
    <div style={{ overflowX: 'auto', margin: '14px -4px 0', padding: '4px 4px 2px', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: Math.max(villes.length * 84, 260) }}>
        {villes.map((v, i) => {
          const parcouru = i <= fin
          const estDescente = i === fin
          return (
            <div key={`${v}${i}`} ref={estDescente ? refDescente : undefined} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 84, padding: '0 3px' }}>
              {i > 0 && (
                <span style={{ position: 'absolute', top: 7, right: '50%', width: '100%', height: 3, borderRadius: 2,
                  background: i <= fin ? `linear-gradient(90deg, ${OR_PROFOND}, ${OR})` : '#E2E8F0' }} />
              )}
              <span style={{ position: 'relative', zIndex: 1, width: estDescente ? 17 : 11, height: estDescente ? 17 : 11, marginTop: estDescente ? 0 : 3,
                borderRadius: '50%', background: estDescente ? OR : (parcouru ? '#fff' : '#F1F5F9'),
                border: `3px solid ${parcouru ? OR_PROFOND : '#CBD5E1'}`,
                boxShadow: estDescente ? `0 0 0 5px ${OR}33` : 'none' }} />
              <span style={{ marginTop: 6, fontSize: 9.5, fontWeight: estDescente ? 800 : 600, letterSpacing: .3,
                color: parcouru ? ENCRE : '#94A3B8', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2, maxWidth: 80, overflowWrap: 'anywhere',
                fontFamily: DISPLAY }}>{v}</span>
              {estDescente && <span style={{ fontSize: 8.5, color: OR_PROFOND, fontWeight: 700, marginTop: 3, letterSpacing: .4, whiteSpace: 'nowrap' }}>⬇ DESCENTE</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Carte({ children, delai = 0, style = {}, onClick }) {
  return (
    <div className="acc-reveal" onClick={onClick}
      style={{ animationDelay: `${Math.min(delai, 200)}ms`, background: '#fff', borderRadius: 18, padding: 16,
        boxShadow: '0 1px 2px rgba(6,20,46,.06), 0 6px 18px -10px rgba(6,20,46,.22)',
        border: '1px solid rgba(15,26,46,.06)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  )
}

function Surtitre({ children, droite }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', color: GRIS }}>
        {children}
      </span>
      {droite}
    </div>
  )
}

export default function Accueil() {
  const navigate = useNavigate()
  const { user } = useStore()
  const { nav = [], banniereDepart = null } = useOutletContext() || {}
  const role = getRole(user)
  // Dernières données connues affichées IMMÉDIATEMENT (réseau lent au camp),
  // puis rafraîchies en arrière-plan.
  const cache = useMemo(() => { try { return JSON.parse(localStorage.getItem(CLE_CACHE) || '{}') } catch { return {} } }, [])
  const [profil, setProfil] = useState(cache.profil || null)
  const [mesVoyages, setMesVoyages] = useState(cache.voyages || null)
  const [agenda, setAgenda] = useState(cache.agenda || [])
  const [mesDemandes, setMesDemandes] = useState(cache.demandes || [])

  useEffect(() => {
    const maj = (cle, set) => v => {
      set(v)
      try { localStorage.setItem(CLE_CACHE, JSON.stringify({ ...JSON.parse(localStorage.getItem(CLE_CACHE) || '{}'), [cle]: v })) } catch {}
    }
    personnelAPI.monProfil().then(r => maj('profil', setProfil)(r.data)).catch(() => {})
    voyagesAPI.list().then(r => maj('voyages', setMesVoyages)(r.data?.results || r.data || [])).catch(() => setMesVoyages(v => v || []))
    evenementsAPI.agenda().then(r => maj('agenda', setAgenda)((r.data?.results || r.data || []).slice(0, 3))).catch(() => {})
    demandesAPI.list().then(r => maj('demandes', setMesDemandes)(r.data?.results || r.data || [])).catch(() => {})
  }, [])

  // Trajet à mettre en avant : en cours, sinon le prochain planifié
  const trajet = useMemo(() => {
    const v = (mesVoyages || []).filter(x => ['en_voyage', 'planifie'].includes(x.statut))
    return v.find(x => x.statut === 'en_voyage') || v.sort((a, b) => a.date_depart.localeCompare(b.date_depart))[0] || null
  }, [mesVoyages])

  // Prénom en casse normale (les fiches Personnel sont souvent en MAJUSCULES)
  const brut = user?.first_name || profil?.prenom || nomAffiche(user).split(' ')[0] || ''
  const prenom = brut.charAt(0).toUpperCase() + brut.slice(1).toLowerCase()
  const chambre = profil?.residence_principale?.residence
  const raccourcis = nav.filter(i => i.to && !['/', '/accueil', '/mon-compte'].includes(i.to)).slice(0, 6)
  const demandesEnAttente = mesDemandes.filter(d => d.statut === 'en_attente').length
  const demandesValidees = mesDemandes.filter(d => d.statut === 'validee').length
  const j = trajet ? jourJ(trajet.date_depart) : null

  return (
    <div style={{ minHeight: '100%', background: '#EEF1F6', fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes accReveal { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .acc-reveal { animation: accReveal .35s ease-out both; }
        .acc-tuile:active { transform: scale(.96); }
        @media (prefers-reduced-motion: reduce) { .acc-reveal { animation: none !important } }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '22px 18px 64px',
        background: `radial-gradient(120% 90% at 85% 0%, ${NUIT_2} 0%, ${NUIT} 60%)`, color: '#fff' }}>
        <CourbesDeNiveau />
        <div style={{ position: 'absolute', width: 220, height: 220, right: -70, top: -90, borderRadius: '50%',
          background: `radial-gradient(circle, ${OR}40, transparent 70%)`, filter: 'blur(6px)' }} />
        <div style={{ position: 'relative' }}>
          <div className="acc-reveal" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: OR, textTransform: 'uppercase' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="acc-reveal" style={{ animationDelay: '60ms', margin: '8px 0 0', fontFamily: DISPLAY,
            fontWeight: 700, fontSize: 26, lineHeight: 1.15, letterSpacing: -.3, color: '#fff' }}>
            {salutation()},<br /><span style={{ color: OR }}>{prenom}</span>
          </h1>
          <div className="acc-reveal" style={{ animationDelay: '120ms', display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {[
              chambre && ['🏠', `Chambre ${chambre}`],
              ['⛏️', ROLE_LABELS[role] || role],
              profil?.societe && ['🏢', profil.societe],
            ].filter(Boolean).map(([ic, t]) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99,
                background: 'rgba(255,255,255,.08)', border: '1px solid rgba(227,178,60,.28)', fontSize: 11.5, fontWeight: 600 }}>
                <span>{ic}</span>{t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 14px 24px', marginTop: -44, position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>

        {banniereDepart && <div className="acc-reveal" style={{ animationDelay: '140ms', margin: '0 -10px' }}>{banniereDepart}</div>}

        {/* ── PROCHAIN TRAJET ───────────────────────────────── */}
        {mesVoyages !== null && (
          trajet ? (
            <Carte delai={160} onClick={() => navigate(nav.some(i => i.to === '/voyages') ? '/voyages' : '/demandes')}>
              <Surtitre droite={
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                  background: trajet.statut === 'en_voyage' ? '#DCFCE7' : '#FEF3C7',
                  color: trajet.statut === 'en_voyage' ? '#166534' : '#92400E' }}>
                  {trajet.statut === 'en_voyage' ? '● En route' : 'Planifié'}
                </span>
              }>{trajet.statut === 'en_voyage' ? 'Trajet en cours' : 'Prochain trajet'}</Surtitre>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 20, color: ENCRE, lineHeight: 1.15 }}>
                    {trajet.destination || '—'}
                  </div>
                  <div style={{ fontSize: 12.5, color: GRIS, marginTop: 4 }}>
                    {new Date(trajet.date_depart + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {trajet.heure_depart && ` · ${trajet.heure_depart.slice(0, 5)}`}
                  </div>
                  <div style={{ fontSize: 12, color: ENCRE, marginTop: 6, fontWeight: 600 }}>
                    {trajet.vehicule_personnel
                      ? `🚗 Véhicule personnel${trajet.vehicule_matricule ? ` · ${trajet.vehicule_matricule}` : ''}`
                      : trajet.vehicule_matricule
                      ? `🚌 ${trajet.vehicule || 'Convoi'} · ${trajet.vehicule_matricule}${trajet.point_rdv ? ` · RDV ${trajet.point_rdv}` : ''}`
                      : '🚌 Convoi en cours d\'organisation'}
                  </div>
                </div>
                {trajet.statut === 'planifie' && j !== null && (
                  <div style={{ textAlign: 'center', flexShrink: 0, padding: '8px 12px', borderRadius: 16,
                    background: `linear-gradient(160deg, ${NUIT_2}, ${NUIT})`, color: '#fff' }}>
                    <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, color: OR, lineHeight: 1 }}>{j <= 0 ? 'J' : `J-${j}`}</div>
                    <div style={{ fontSize: 9, letterSpacing: 1, opacity: .75, marginTop: 3 }}>{j <= 0 ? "AUJOURD'HUI" : j === 1 ? 'DEMAIN' : 'JOURS'}</div>
                  </div>
                )}
              </div>
              <LigneDeRoute voyage={trajet} />
            </Carte>
          ) : (
            <Carte delai={160}>
              <Surtitre>Prochain trajet</Surtitre>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 30 }}>🛣️</div>
                <div style={{ flex: 1, fontSize: 13.5, color: GRIS, lineHeight: 1.4 }}>Aucun trajet prévu. Votre prochaine rotation apparaîtra ici.</div>
              </div>
              {nav.some(i => i.to === '/demandes') && (
                <button onClick={() => navigate('/demandes')}
                  style={{ marginTop: 14, width: '100%', border: 'none', borderRadius: 14, padding: '13px 16px', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${OR}, ${OR_PROFOND})`, color: NUIT, fontWeight: 700, fontSize: 14,
                    fontFamily: DISPLAY, letterSpacing: .3 }}>
                  ✈  Demander un voyage
                </button>
              )}
            </Carte>
          )
        )}

        {/* ── RACCOURCIS ────────────────────────────────────── */}
        {raccourcis.length > 0 && (
          <div>
            <div style={{ padding: '4px 4px 0' }}><Surtitre>Raccourcis</Surtitre></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {raccourcis.map((item, i) => {
                const { icon, label } = iconeEtLibelle(item)
                return (
                  <button key={item.to} className="acc-reveal acc-tuile" onClick={() => navigate(item.to)}
                    style={{ animationDelay: `${120 + i * 30}ms`, border: '1px solid rgba(15,26,46,.07)', background: '#fff',
                      borderRadius: 16, padding: '12px 4px 10px', minHeight: 0, minWidth: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(6,20,46,.06)', transition: 'transform .15s' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 19, background: `linear-gradient(150deg, ${NUIT_2}, ${NUIT})`,
                      boxShadow: `inset 0 0 0 1px ${OR}55` }}>{icon}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: ENCRE, fontFamily: DISPLAY, maxWidth: '100%',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── MES DEMANDES ──────────────────────────────────── */}
        {mesDemandes.length > 0 && (
          <Carte delai={420} onClick={() => navigate('/demandes')}>
            <Surtitre droite={<span style={{ color: OR_PROFOND, fontWeight: 700, fontSize: 18 }}>›</span>}>Mes demandes</Surtitre>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[[demandesEnAttente, 'En attente', '#D97706'], [demandesValidees, 'Validées', '#16A34A']].map(([n, l, c]) => (
                <div key={l} style={{ background: '#F8FAFC', borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: c, lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 11.5, color: GRIS, marginTop: 4, fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
          </Carte>
        )}

        {/* ── À VENIR ───────────────────────────────────────── */}
        {agenda.length > 0 && (
          <Carte delai={480}>
            <Surtitre droite={nav.some(i => i.to === '/evenements') && (
              <button onClick={() => navigate('/evenements')} style={{ background: 'none', border: 'none', color: OR_PROFOND, fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: 0, minHeight: 0, minWidth: 0 }}>Tout voir ›</button>
            )}>Au camp prochainement</Surtitre>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agenda.map(ev => {
                const d = new Date(ev.date_debut)
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 50, flexShrink: 0, textAlign: 'center', borderRadius: 14, padding: '7px 0',
                      background: '#FFF8E6', border: `1px solid ${OR}55` }}>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19, color: ENCRE, lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: OR_PROFOND, letterSpacing: .8, textTransform: 'uppercase', marginTop: 2 }}>
                        {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                      </div>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: ENCRE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.titre}</div>
                      <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>
                        {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{ev.lieu && ` · ${ev.lieu}`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Carte>
        )}

        <button onClick={() => navigate('/mon-compte')} className="acc-reveal"
          style={{ animationDelay: '540ms', alignSelf: 'center', background: 'none', border: 'none', color: GRIS, fontSize: 12.5,
            fontWeight: 600, cursor: 'pointer', padding: '6px 10px' }}>
          👤 Mon compte · mot de passe
        </button>
      </div>
    </div>
  )
}
