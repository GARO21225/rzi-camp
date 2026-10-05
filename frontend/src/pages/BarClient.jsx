import React, { useEffect, useMemo, useState } from 'react'
import { boutique as boutiqueAPI, parametres as parametresAPI } from '../api'
import { useIsMobile } from '../hooks/useIsMobile'

// Vue « Mon bar » du RÉSIDENT : la carte (prix, disponibilité), SON bon de
// caisse et SES consommations. Il ne vend rien, ne voit ni la caisse, ni
// les ventes des autres, ni le stock — c'est la vue du gérant du bar et de
// l'admin (Boutique.jsx). L'API applique les mêmes règles (restauration/
// views.py, _profil_bar).

const ENCRE = '#0F1A2E'
const GRIS = '#5B6472'
const OR = '#C9972B'
const NUIT = '#0B2350'
const fcfa = n => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`

export default function BarClient() {
  const isMobile = useIsMobile()
  const [articles, setArticles] = useState(null)
  const [consos, setConsos] = useState([])
  const [bon, setBon] = useState(null)
  const [horaires, setHoraires] = useState(null)
  const [categorie, setCategorie] = useState('')
  const [recherche, setRecherche] = useState('')

  useEffect(() => {
    boutiqueAPI.articles({ page_size: 200 }).then(r => setArticles((r.data?.results || r.data || []).filter(a => a.actif !== false))).catch(() => setArticles([]))
    boutiqueAPI.consommations({ page_size: 50 }).then(r => setConsos(r.data?.results || r.data || [])).catch(() => {})
    boutiqueAPI.bons({ annee: new Date().getFullYear() }).then(r => setBon((r.data?.results || r.data || [])[0] || null)).catch(() => {})
    parametresAPI.list().then(r => {
      const d = r.data?.find?.(p => p.cle === 'boutique_ouverture_debut')?.valeur
      const f = r.data?.find?.(p => p.cle === 'boutique_ouverture_fin')?.valeur
      if (d && f) setHoraires({ d, f })
    }).catch(() => {})
  }, [])

  const categories = useMemo(() => [...new Set((articles || []).map(a => a.categorie).filter(Boolean))].sort(), [articles])
  const visibles = (articles || []).filter(a =>
    (!categorie || a.categorie === categorie) && (!recherche || a.nom.toLowerCase().includes(recherche.toLowerCase())))

  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0)
  const duMois = consos.filter(c => new Date(c.date_conso) >= debutMois)
  const totalMois = duMois.reduce((s, c) => s + Number(c.montant || 0), 0)
  const restant = Number(bon?.credit_restant || 0), initial = Number(bon?.credit_initial || 0)
  const pct = initial > 0 ? Math.max(0, Math.min(100, Math.round(restant / initial * 100))) : 0

  const carte = { background: '#fff', borderRadius: 16, padding: 16, border: '1px solid rgba(15,26,46,.07)', boxShadow: '0 1px 3px rgba(6,20,46,.06)' }
  const surtitre = { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: GRIS, marginBottom: 10 }

  return (
    <div style={{ padding: isMobile ? 12 : 20, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: ENCRE }}>🍹 Mon bar</h2>
        <div style={{ fontSize: 13, color: GRIS, marginTop: 2 }}>
          La carte du bar, votre bon de caisse et vos consommations{horaires && <> · ouvert de <b>{horaires.d}</b> à <b>{horaires.f}</b></>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div style={{ ...carte, background: `linear-gradient(150deg, ${NUIT}, #06142E)`, color: '#fff', border: 'none' }}>
          <div style={{ ...surtitre, color: 'rgba(255,255,255,.7)' }}>Mon bon de caisse {new Date().getFullYear()}</div>
          {bon ? (<>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: '#E3B23C' }}>{fcfa(restant)}</div>
            <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>restant sur {fcfa(initial)}</div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.15)', marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct < 20 ? '#F87171' : '#E3B23C' }} />
            </div>
          </>) : (
            <div style={{ fontSize: 13, opacity: .85 }}>Aucun bon de caisse cette année. Paiement en espèces ou Mobile Money au comptoir.</div>
          )}
        </div>
        <div style={carte}>
          <div style={surtitre}>Ce mois-ci</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: ENCRE }}>{fcfa(totalMois)}</div>
          <div style={{ fontSize: 12, color: GRIS, marginTop: 2 }}>{duMois.length} consommation(s)</div>
        </div>
      </div>

      <div style={carte}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ ...surtitre, marginBottom: 0 }}>La carte</div>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="🔍 Rechercher"
            style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '7px 10px', fontSize: 13, width: isMobile ? '100%' : 200 }} />
        </div>
        {categories.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
            {['', ...categories].map(c => (
              <button key={c || 'tout'} onClick={() => setCategorie(c)}
                style={{ flexShrink: 0, border: categorie === c ? `1px solid ${NUIT}` : '1px solid #e2e8f0', background: categorie === c ? NUIT : '#fff',
                  color: categorie === c ? '#fff' : ENCRE, borderRadius: 99, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {c || 'Tout'}
              </button>
            ))}
          </div>
        )}
        {articles === null ? <div style={{ color: GRIS, fontSize: 13 }}>⏳ Chargement…</div>
          : visibles.length === 0 ? <div style={{ color: GRIS, fontSize: 13 }}>Aucun article.</div>
          : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 170}px, 1fr))`, gap: 10 }}>
            {visibles.map(a => {
              const dispo = Number(a.stock) > 0
              return (
                <div key={a.id} style={{ border: '1px solid #eef1f6', borderRadius: 14, padding: 10, opacity: dispo ? 1 : .55, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {a.image_url
                    ? <img src={a.image_url} alt="" loading="lazy" style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 10, background: '#f8fafc' }} />
                    : <div style={{ height: 90, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🥤</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: ENCRE, lineHeight: 1.25 }}>{a.nom}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
                    <span style={{ fontWeight: 700, color: OR, fontSize: 12.5, whiteSpace: 'nowrap' }}>{fcfa(a.prix)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: dispo ? '#16A34A' : '#DC2626' }}>{dispo ? 'Disponible' : 'Épuisé'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={carte}>
        <div style={surtitre}>Mes consommations</div>
        {consos.length === 0 ? <div style={{ color: GRIS, fontSize: 13 }}>Aucune consommation enregistrée.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {consos.slice(0, 30).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: ENCRE }}>{c.article_nom} {c.quantite > 1 && <span style={{ color: GRIS }}>× {c.quantite}</span>}</div>
                  <div style={{ fontSize: 11.5, color: GRIS }}>
                    {new Date(c.date_conso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{c.mode_paiement === 'bon' ? '🎫 Bon de caisse' : c.mode_paiement === 'especes' ? '💵 Espèces' : c.mode_paiement}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: ENCRE, fontSize: 13.5, whiteSpace: 'nowrap' }}>{fcfa(c.montant)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
