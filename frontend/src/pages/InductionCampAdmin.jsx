import { useState, useEffect, useMemo, useCallback } from 'react'
import { inductionCamp } from '../api'
import { toast } from '../toast'
import { useIsMobile } from '../hooks/useIsMobile'

// Cockpit admin de l'induction Camp — « registre de contrôle » : papier ivoire,
// encre marine, ambre sécurité, filets hachurés. Pas de glassmorphism : c'est un outil de pointage.
const ENCRE = '#0f1d3a', PAPIER = '#f6f1e4', CARTE = '#fffdf7', FILET = '#d9d0b8'
const AMBRE = '#e8a200', VERT = '#1f7a4d', ROUGE = '#b3261e', GRIS = '#6b6657'
const TITRE = "'Barlow Condensed','Arial Narrow',Impact,sans-serif"
const MONO = "'JetBrains Mono',monospace"
const HACHURE = `repeating-linear-gradient(-45deg,${AMBRE} 0 8px,${ENCRE} 8px 16px)`

const STATUTS = {
  termine: { l: 'Terminé', c: VERT, bg: '#e3f2e9' },
  exempte: { l: 'Exempté', c: '#7a4f00', bg: '#fdf0cc' },
  non_commence: { l: 'À faire', c: ROUGE, bg: '#fbe6e4' },
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&display=swap');
.ica-tuile{animation:icaIn .45s both cubic-bezier(.2,.7,.2,1)}
@keyframes icaIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ica-ligne:hover{background:#fbf6e6}
.ica-btn{font-family:${TITRE};letter-spacing:.06em;text-transform:uppercase;font-weight:700;cursor:pointer;border:2px solid ${ENCRE};background:${CARTE};color:${ENCRE};padding:7px 14px;font-size:14px}
.ica-btn:hover{background:${ENCRE};color:${CARTE}}
.ica-btn.plein{background:${ENCRE};color:${CARTE}}.ica-btn.plein:hover{background:${AMBRE};color:${ENCRE};border-color:${ENCRE}}
.ica-btn:disabled{opacity:.4;cursor:not-allowed}
`

function Tuile({ label, valeur, sous, couleur, i }) {
  return (
    <div className="ica-tuile" style={{ animationDelay: `${i * 60}ms`, background: CARTE, border: `2px solid ${ENCRE}`, padding: '12px 14px', position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: couleur }} />
      <div style={{ fontFamily: TITRE, fontSize: 13, letterSpacing: '.12em', textTransform: 'uppercase', color: GRIS, paddingLeft: 8 }}>{label}</div>
      <div style={{ fontFamily: TITRE, fontSize: 44, fontWeight: 700, lineHeight: 1, color: ENCRE, paddingLeft: 8 }}>{valeur}</div>
      {sous && <div style={{ fontFamily: MONO, fontSize: 11, color: GRIS, paddingLeft: 8, marginTop: 2 }}>{sous}</div>}
    </div>
  )
}

function BarreRepartition({ nom, total, termines, exemptes }) {
  const pc = n => (total ? (n * 100) / total : 0)
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: ENCRE }}>
        <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{nom}</b>
        <span style={{ fontFamily: MONO, fontSize: 11.5 }}>{termines + exemptes}/{total}</span>
      </div>
      <div style={{ display: 'flex', height: 12, background: '#ebe4cf', border: `1px solid ${FILET}` }}>
        <div style={{ width: `${pc(termines)}%`, background: VERT }} />
        <div style={{ width: `${pc(exemptes)}%`, background: AMBRE }} />
      </div>
    </div>
  )
}

function Courbe({ jours }) {
  const max = Math.max(1, ...jours.map(j => j.n))
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
        {jours.map(j => (
          <div key={j.date} title={`${j.date} : ${j.n}`} style={{ flex: 1, height: `${Math.max(3, (j.n * 100) / max)}%`, background: j.n ? ENCRE : FILET }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10, color: GRIS, marginTop: 3 }}>
        <span>{jours[0]?.date.slice(5)}</span><span>30 derniers jours · max {max}/jour</span><span>{jours[jours.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  )
}

export default function InductionCampAdmin({ onApercu }) {
  const mobile = useIsMobile()
  const [d, setD] = useState(null)
  const [erreur, setErreur] = useState(false)
  const [statut, setStatut] = useState('')
  const [societe, setSociete] = useState('')
  const [recherche, setRecherche] = useState('')
  const [sel, setSel] = useState(new Set())
  const [modal, setModal] = useState(null) // ids à exempter
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(() => {
    inductionCamp.resume().then(r => { setD(r.data); setErreur(false) }).catch(() => setErreur(true))
  }, [])
  useEffect(() => { charger() }, [charger])

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    return (d?.lignes || []).filter(l =>
      (!statut || l.statut === statut) && (!societe || l.societe === societe) &&
      (!q || `${l.nom} ${l.societe} ${l.departement} ${l.chambre}`.toLowerCase().includes(q)))
  }, [d, statut, societe, recherche])

  const exportFichier = async fmt => {
    try {
      const r = await inductionCamp.export({ fmt, statut, societe })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url; a.download = `induction_camp.${fmt}`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch { toast.error("Export impossible") }
  }

  const confirmerExemption = async () => {
    if (!motif.trim()) return toast.error('Indique le motif')
    setEnvoi(true)
    try {
      const r = await inductionCamp.exempter(modal, motif.trim())
      toast.success(`${r.data.exemptes} personne(s) exemptée(s)`)
      setModal(null); setMotif(''); setSel(new Set()); charger()
    } catch (e) { toast.error(e?.response?.data?.error || 'Échec') }
    setEnvoi(false)
  }
  const retirer = async ids => {
    try { await inductionCamp.retirerExemption(ids); toast.success('Exemption retirée'); charger() }
    catch { toast.error('Échec') }
  }

  const selectionnables = lignes.filter(l => l.statut === 'non_commence')
  const toutCoche = selectionnables.length > 0 && selectionnables.every(l => sel.has(l.personnel_id))
  const bascule = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const champ = { fontFamily: 'inherit', fontSize: 13.5, padding: '8px 10px', border: `2px solid ${ENCRE}`, background: CARTE, color: ENCRE, borderRadius: 0 }
  const societes = [...new Set((d?.lignes || []).map(l => l.societe).filter(Boolean))].sort()

  return (
    <div style={{ minHeight: '100%', background: PAPIER, color: ENCRE, fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
      <style>{css}</style>
      <div style={{ height: 10, background: HACHURE }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: mobile ? '16px 14px 40px' : '26px 24px 50px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', color: GRIS }}>REGISTRE · SITE SANGO</div>
            <h1 style={{ fontFamily: TITRE, fontSize: mobile ? 34 : 46, margin: 0, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '.02em' }}>Induction du camp</h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ica-btn" onClick={onApercu}>Aperçu participant</button>
            <button className="ica-btn" onClick={() => exportFichier('csv')}>CSV</button>
            <button className="ica-btn plein" onClick={() => exportFichier('xlsx')}>Excel</button>
          </div>
        </div>

        {erreur && <div style={{ background: '#fbe6e4', border: `2px solid ${ROUGE}`, padding: 12, marginBottom: 14 }}>Chargement impossible. <button className="ica-btn" onClick={charger}>Réessayer</button></div>}
        {!d && !erreur && <div style={{ padding: 40, textAlign: 'center', fontFamily: MONO, color: GRIS }}>Chargement du registre…</div>}

        {d && <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
            <Tuile i={0} label="Taux de conformité" valeur={`${d.taux}%`} sous={`hors ${d.exemptes} exempté(s)`} couleur={d.taux >= 90 ? VERT : d.taux >= 60 ? AMBRE : ROUGE} />
            <Tuile i={1} label="Terminés" valeur={d.termines} sous={`sur ${d.total} résidents`} couleur={VERT} />
            <Tuile i={2} label="À faire" valeur={d.non_commences} sous="relance nécessaire" couleur={ROUGE} />
            <Tuile i={3} label="Exemptés" valeur={d.exemptes} sous="dispense motivée" couleur={AMBRE} />
            <Tuile i={4} label="Score quiz moyen" valeur={d.score_moyen ?? '—'} sous={`${d.appareils_total} appareil(s) déclaré(s)`} couleur={ENCRE} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ background: CARTE, border: `2px solid ${ENCRE}`, padding: 14 }}>
              <div style={{ fontFamily: TITRE, fontSize: 18, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Signatures par jour</div>
              <Courbe jours={d.par_jour} />
            </div>
            <div style={{ background: CARTE, border: `2px solid ${ENCRE}`, padding: 14 }}>
              <div style={{ fontFamily: TITRE, fontSize: 18, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
                Avancement par société <span style={{ fontFamily: MONO, fontSize: 10, color: GRIS }}>■ terminé <span style={{ color: AMBRE }}>■</span> exempté</span>
              </div>
              <div style={{ maxHeight: 130, overflowY: 'auto' }}>
                {d.par_societe.map(s => <BarreRepartition key={s.societe} nom={s.societe} {...s} />)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher nom, société, chambre…" style={{ ...champ, flex: '1 1 220px' }} />
            <select value={statut} onChange={e => setStatut(e.target.value)} style={champ}>
              <option value="">Tous statuts</option>
              {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
            </select>
            <select value={societe} onChange={e => setSociete(e.target.value)} style={champ}>
              <option value="">Toutes sociétés</option>
              {societes.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="ica-btn plein" disabled={!sel.size} onClick={() => setModal([...sel])}>Exempter ({sel.size})</button>
          </div>

          <div style={{ background: CARTE, border: `2px solid ${ENCRE}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: ENCRE, color: CARTE, fontFamily: TITRE, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 14 }}>
              <input type="checkbox" checked={toutCoche} disabled={!selectionnables.length}
                onChange={() => setSel(toutCoche ? new Set() : new Set(selectionnables.map(l => l.personnel_id)))} aria-label="Tout sélectionner (à faire)" />
              <span style={{ flex: 1 }}>Résident</span>
              {!mobile && <span style={{ width: 120 }}>Société</span>}
              <span style={{ width: 96 }}>Statut</span>
              <span style={{ width: mobile ? 70 : 150, textAlign: 'right' }}>{mobile ? 'Action' : 'Détail'}</span>
            </div>
            {lignes.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: GRIS }}>Aucun résultat</div>}
            {lignes.map(l => {
              const st = STATUTS[l.statut]
              return (
                <div key={l.personnel_id} className="ica-ligne" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${FILET}` }}>
                  <input type="checkbox" disabled={l.statut !== 'non_commence'} checked={sel.has(l.personnel_id)} onChange={() => bascule(l.personnel_id)} aria-label={`Sélectionner ${l.nom}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nom}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: GRIS }}>
                      {[mobile && l.societe, l.chambre, l.statut === 'exempte' && l.motif_exemption].filter(Boolean).join(' · ') || ' '}
                    </div>
                  </div>
                  {!mobile && <span style={{ width: 120, fontSize: 12.5, color: GRIS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.societe}</span>}
                  <span style={{ width: 96 }}>
                    <span style={{ background: st.bg, color: st.c, border: `1.5px solid ${st.c}`, padding: '2px 8px', fontFamily: TITRE, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>{st.l}</span>
                  </span>
                  <span style={{ width: mobile ? 70 : 150, textAlign: 'right', fontFamily: MONO, fontSize: 11, color: GRIS }}>
                    {l.statut === 'termine' && (mobile ? '✓' : `${new Date(l.date_completion).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}${l.quiz_score != null ? ` · ${l.quiz_score} pts` : ''}`)}
                    {l.statut === 'exempte' && <button className="ica-btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => retirer([l.personnel_id])}>Retirer</button>}
                    {l.statut === 'non_commence' && <button className="ica-btn" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setModal([l.personnel_id])}>Exempter</button>}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: GRIS, marginTop: 8 }}>{lignes.length} ligne(s) affichée(s) — les exports reprennent les filtres statut et société.</div>
        </>}
      </div>

      {modal && (
        <div onClick={() => !envoi && setModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: CARTE, borderRadius: 16, maxWidth: 440, width: '100%', overflow: 'hidden' }}>
            <div style={{ height: 8, background: HACHURE }} />
            <div style={{ padding: 20 }}>
              <div style={{ fontFamily: TITRE, fontSize: 26, textTransform: 'uppercase' }}>Exempter {modal.length} personne(s)</div>
              <p style={{ fontSize: 13, color: GRIS, margin: '4px 0 12px' }}>La personne ne sera plus relancée et n'aura plus à passer l'induction. Le motif est conservé avec ton nom.</p>
              <input autoFocus value={motif} onChange={e => setMotif(e.target.value)} maxLength={200} placeholder="Motif (ex. direction, déjà formé, de passage)"
                style={{ ...champ, width: '100%', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="ica-btn" disabled={envoi} onClick={() => setModal(null)}>Annuler</button>
                <button className="ica-btn plein" disabled={envoi || !motif.trim()} onClick={confirmerExemption}>Confirmer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
