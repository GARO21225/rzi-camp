import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useStore } from '../store'
import { personnel as personnelAPI, voyages as voyagesAPI, evenements as evenementsAPI, demandes as demandesAPI } from '../api'
import { ROLE_LABELS, getRole, iconeEtLibelle } from '../constants/roleNav'
import { nomAffiche } from '../components/MobileChrome'

// ════════════════════════════════════════════════════════════════
// Accueil résident — direction « Filon d'or » : nuit marine profonde
// traversée de courbes de niveau dorées (la géologie du site), typo
// industrielle étendue (Archivo), chiffres en mono. Le hero sombre est
// réservé à cet écran d'accueil ; les cartes en dessous restent claires
// et lisibles en plein soleil sur le terrain.
// ════════════════════════════════════════════════════════════════

const NUIT = '#06142E'
const NUIT_2 = '#0B2350'
const OR = '#E3B23C'
const OR_PROFOND = '#C9972B'
const ENCRE = '#0F1A2E'
const GRIS = '#5B6472'
const DISPLAY = "'Archivo', 'IBM Plex Sans', system-ui, sans-serif"
const MONO = "'JetBrains Mono', ui-monospace, monospace"

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
        <path key={i} className="acc-courbe" style={{ animationDelay: `${-i * 2.2}s` }}
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
                fontFamily: DISPLAY, fontStretch: '90%' }}>{v}</span>
              {estDescente && <span style={{ fontSize: 8.5, color: OR_PROFOND, fontWeight: 800, marginTop: 3, letterSpacing: .4, whiteSpace: 'nowrap' }}>⬇ DESCENTE</span>}
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
      style={{ animationDelay: `${delai}ms`, background: '#fff', borderRadius: 22, padding: 18,
        boxShadow: '0 1px 0 rgba(15,26,46,.04), 0 10px 30px -12px rgba(6,20,46,.28)',
        border: '1px solid rgba(15,26,46,.06)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {children}
    </div>
  )
}

function Surtitre({ children, droite }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontFamily: DISPLAY, fontStretch: '115%', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: GRIS }}>
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
  const [profil, setProfil] = useState(null)
  const [mesVoyages, setMesVoyages] = useState(null)
  const [agenda, setAgenda] = useState([])
  const [mesDemandes, setMesDemandes] = useState([])

  useEffect(() => {
    personnelAPI.monProfil().then(r => setProfil(r.data)).catch(() => {})
    voyagesAPI.list().then(r => setMesVoyages(r.data?.results || r.data || [])).catch(() => setMesVoyages([]))
    evenementsAPI.agenda().then(r => setAgenda((r.data?.results || r.data || []).slice(0, 3))).catch(() => {})
    demandesAPI.list().then(r => setMesDemandes(r.data?.results || r.data || [])).catch(() => {})
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
        @keyframes accDerive { from { transform: translateX(0) } to { transform: translateX(-40px) } }
        .acc-courbe { animation: accDerive 14s ease-in-out infinite alternate; }
        @keyframes accReveal { from { opacity: 0; transform: translateY(14px) scale(.985) } to { opacity: 1; transform: none } }
        .acc-reveal { animation: accReveal .55s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes accPouls { 0%,100% { box-shadow: 0 0 0 0 rgba(227,178,60,.55) } 50% { box-shadow: 0 0 0 7px rgba(227,178,60,0) } }
        .acc-tuile:active { transform: scale(.96); }
        @media (prefers-reduced-motion: reduce) { .acc-courbe, .acc-reveal { animation: none !important } }
      `}</style>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '26px 20px 74px',
        background: `radial-gradient(120% 90% at 85% 0%, ${NUIT_2} 0%, ${NUIT} 60%)`, color: '#fff' }}>
        <CourbesDeNiveau />
        <div style={{ position: 'absolute', width: 220, height: 220, right: -70, top: -90, borderRadius: '50%',
          background: `radial-gradient(circle, ${OR}40, transparent 70%)`, filter: 'blur(6px)' }} />
        <div style={{ position: 'relative' }}>
          <div className="acc-reveal" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: OR, textTransform: 'uppercase' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="acc-reveal" style={{ animationDelay: '60ms', margin: '8px 0 0', fontFamily: DISPLAY, fontStretch: '112%',
            fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: -.5, color: '#fff' }}>
            {salutation()},<br /><span style={{ color: OR }}>{prenom}</span>
          </h1>
          <div className="acc-reveal" style={{ animationDelay: '120ms', display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {[
              chambre && ['🏠', `Chambre ${chambre}`],
              ['⛏️', ROLE_LABELS[role] || role],
              profil?.societe && ['🏢', profil.societe],
            ].filter(Boolean).map(([ic, t]) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 99,
                background: 'rgba(255,255,255,.08)', border: '1px solid rgba(227,178,60,.28)', fontSize: 12, fontWeight: 600,
                backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
                <span>{ic}</span>{t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 14px 24px', marginTop: -52, position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>

        {banniereDepart && <div className="acc-reveal" style={{ animationDelay: '140ms', margin: '0 -10px' }}>{banniereDepart}</div>}

        {/* ── PROCHAIN TRAJET ───────────────────────────────── */}
        {mesVoyages !== null && (
          trajet ? (
            <Carte delai={160} onClick={() => navigate(nav.some(i => i.to === '/voyages') ? '/voyages' : '/demandes')}>
              <Surtitre droite={
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 99,
                  background: trajet.statut === 'en_voyage' ? '#DCFCE7' : '#FEF3C7',
                  color: trajet.statut === 'en_voyage' ? '#166534' : '#92400E' }}>
                  {trajet.statut === 'en_voyage' ? '● En route' : 'Planifié'}
                </span>
              }>{trajet.statut === 'en_voyage' ? 'Trajet en cours' : 'Prochain trajet'}</Surtitre>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontStretch: '108%', fontWeight: 800, fontSize: 22, color: ENCRE, lineHeight: 1.1 }}>
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
                    background: `linear-gradient(135deg, ${OR}, ${OR_PROFOND})`, color: NUIT, fontWeight: 800, fontSize: 14,
                    fontFamily: DISPLAY, fontStretch: '110%', letterSpacing: .3 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {raccourcis.map((item, i) => {
                const { icon, label } = iconeEtLibelle(item)
                return (
                  <button key={item.to} className="acc-reveal acc-tuile" onClick={() => navigate(item.to)}
                    style={{ animationDelay: `${240 + i * 55}ms`, border: '1px solid rgba(15,26,46,.06)', background: '#fff',
                      borderRadius: 20, padding: '16px 6px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 9, boxShadow: '0 8px 22px -14px rgba(6,20,46,.35)', transition: 'transform .15s' }}>
                    <span style={{ width: 46, height: 46, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, background: `linear-gradient(150deg, ${NUIT_2}, ${NUIT})`,
                      boxShadow: `inset 0 0 0 1px ${OR}55, 0 6px 14px -6px ${NUIT}` }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ENCRE, fontFamily: DISPLAY, fontStretch: '95%' }}>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── MES DEMANDES ──────────────────────────────────── */}
        {mesDemandes.length > 0 && (
          <Carte delai={420} onClick={() => navigate('/demandes')}>
            <Surtitre droite={<span style={{ color: OR_PROFOND, fontWeight: 800, fontSize: 18 }}>›</span>}>Mes demandes</Surtitre>
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
              <button onClick={() => navigate('/evenements')} style={{ background: 'none', border: 'none', color: OR_PROFOND, fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: 0, minHeight: 0, minWidth: 0 }}>Tout voir ›</button>
            )}>Au camp prochainement</Surtitre>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agenda.map(ev => {
                const d = new Date(ev.date_debut)
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 50, flexShrink: 0, textAlign: 'center', borderRadius: 14, padding: '7px 0',
                      background: '#FFF8E6', border: `1px solid ${OR}55` }}>
                      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 19, color: ENCRE, lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: OR_PROFOND, letterSpacing: .8, textTransform: 'uppercase', marginTop: 2 }}>
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
