/**
 * Assistant IA Roxgold SiteLife — connecté aux données réelles
 * Répond aux questions sur le camp en utilisant l'API Anthropic
 */
import React, { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { analyticsAPI, personnel as personnelAPI } from '../api'


// Une seule requête agrégée (/api/analytics/) : parc, personnel, maintenance, mobilité, plaintes, événements, alertes.
async function collectCampData() {
  try { return (await analyticsAPI.get(30)).data } catch (e) { return null }
}

// L'induction n'est pas dans l'agrégat : chargée seulement quand on la demande.
async function chargerInduction() {
  try { const j = (await personnelAPI.list({ page_size: 1000 })).data; return j.results || j } catch (e) { return null }
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', justifyContent: isUser?'flex-end':'flex-start', marginBottom:12 }}>
      {!isUser && (
        <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#1e3a8a,#7c3aed)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0, marginRight:8 }}>
          🤖
        </div>
      )}
      <div style={{
        maxWidth:'75%', padding:'10px 14px', borderRadius: isUser?'16px 16px 4px 16px':'16px 16px 16px 4px',
        background: isUser ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : 'var(--rzc-white)',
        color: isUser ? 'var(--rzc-white)' : '#1e293b',
        fontSize:13, lineHeight:1.6,
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        whiteSpace:'pre-wrap',
      }}>
        {String(msg.content).split(/(\*\*[^*]+\*\*)/g).map((t, k) => t.startsWith('**') ? <b key={k}>{t.slice(2, -2)}</b> : t)}
        {msg.loading && <span style={{opacity:.5}}>▋</span>}
      </div>
    </div>
  )
}

// ── Moteur de réponses — règles + données réelles du camp, sans API externe ──
// Reconnaît l'intention par mots-clés (accents ignorés) et formule la réponse à partir des
// chiffres réels. Ce n'est pas un modèle de langage : pour une question hors sujets, il oriente
// vers la bonne page plutôt que d'inventer.
const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const duree = h => h == null ? '—' : h >= 48 ? `${(h / 24).toFixed(1)} j` : `${h} h`
const jour = iso => new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

function resume(d) {
  const p = d.parc, i = d.incidents, pl = d.plaintes, ev = d.evenements
  return `📊 **Situation du camp**\n\n`
    + `🏠 Occupation : ${p.taux}% (${p.par_statut['Occupé'] || 0} occupée(s), ${p.par_statut['Libre'] || 0} libre(s))\n`
    + `✈️ ${d.voyages.par_statut.en_voyage || 0} en voyage, ${d.voyages.par_statut.planifie || 0} planifié(s)\n`
    + `🛠️ ${i.ouverts} incident(s) ouvert(s)${i.critiques_ouverts ? ` dont ${i.critiques_ouverts} critique(s)` : ''}${i.sla_depasse ? `, ${i.sla_depasse} SLA dépassé(s)` : ''}\n`
    + `🧹 ${pl.ouvertes} plainte(s) ouverte(s)${pl.non_affectees ? ` dont ${pl.non_affectees} non affectée(s)` : ''}\n`
    + `📅 ${ev.en_cours} événement(s) en cours, ${ev.a_venir_7j} dans les 7 jours\n`
    + (d.alertes.actives.length ? `🚨 ${d.alertes.actives.length} alerte(s) active(s)` : `✅ Aucune alerte active`)
}

const INTENTIONS = [
  [['resume', 'situation', 'aujourd', 'global', 'bilan', 'point'], d => resume(d)],
  [['alerte', 'danger', 'urgence', 'securite'], d => d.alertes.actives.length
    ? `🚨 ${d.alertes.actives.length} alerte(s) active(s) :\n` + d.alertes.actives.map(m => `• ${m}`).join('\n')
    : '✅ Aucune alerte active en ce moment.'],
  [['evenement', 'reunion', 'agenda', 'programme'], d => {
    const e = d.evenements
    return `📅 ${e.en_cours} événement(s) en cours, ${e.a_venir_7j} dans les 7 prochains jours.`
      + (e.prochains.length ? '\n\nÀ venir :\n' + e.prochains.map(x => `• ${x.titre} — ${jour(x.date)}${x.lieu ? ` (${x.lieu})` : ''}`).join('\n') : '')
  }],
  [['plainte', 'reclamation', 'menage', 'propre'], d => {
    const p = d.plaintes
    return `🧹 ${p.ouvertes} plainte(s) ouverte(s), dont ${p.non_affectees} sans responsable.\n`
      + Object.entries(p.par_statut).map(([k, n]) => `• ${k} : ${n}`).join('\n') + '\nAffectation et suivi dans Plaintes.'
  }],
  [['incident', 'maintenance', 'panne', 'sla', 'technicien'], d => {
    const i = d.incidents
    return `🛠️ ${i.ouverts} incident(s) ouvert(s)\n• ${i.critiques_ouverts} critique(s)\n• ${i.sla_depasse} SLA dépassé(s)\n`
      + `• Délai moyen de résolution : ${duree(i.delai_moyen_h)}\n`
      + (i.par_categorie.length ? `• Catégorie la plus fréquente : ${i.par_categorie[0].categorie} (${i.par_categorie[0].n})\n` : '') + 'Détails dans Maintenance.'
  }],
  [['voyage', 'deplacement', 'rotation', 'transit', 'depart', 'retour', 'mobilite'], d => {
    const v = d.voyages, prog = v.programme
    const dep = prog.reduce((s, x) => s + x.departs, 0), ret = prog.reduce((s, x) => s + x.retours, 0)
    return `✈️ ${v.par_statut.en_voyage || 0} personne(s) en voyage, ${v.par_statut.planifie || 0} voyage(s) planifié(s).\n`
      + `Sur les 14 prochains jours : ${dep} départ(s) et ${ret} retour(s) attendus.`
  }],
  [['societe', 'sous-traitant', 'sous traitant', 'effectif', 'personnel', 'combien de personnes'], d => {
    const t = d.personnel.par_type
    return `👥 ${d.personnel.total} personne(s) enregistrée(s) : ${t.roxgold || 0} Roxgold, ${t.sous_traitant || 0} sous-traitants, ${t.visiteur || 0} visiteurs.\n`
      + `Principales sociétés : ` + d.personnel.par_societe.slice(0, 4).map(s => `${s.societe} (${s.n})`).join(', ')
  }],
  [['occupation', 'taux', 'plein', 'occupe', 'residence', 'chambre', 'dispo', 'libre', 'bloc'], d => {
    const p = d.parc
    const blocs = p.par_bloc.slice(0, 3).map(b => `${b.bloc} ${b.occupes}/${b.total}`).join(' · ')
    return `🏠 Taux d'occupation : **${p.taux}%**\n• ${p.par_statut['Occupé'] || 0} occupée(s)\n• ${p.par_statut['Libre'] || 0} libre(s)\n`
      + `• ${p.par_statut['Réservé'] || 0} réservée(s)\n• ${p.hors_service} en maintenance\nBlocs les plus grands : ${blocs}`
  }],
]

async function repondre(question, data) {
  const q = norm(question)
  if (/induction|qhse|forme|formation/.test(q)) {
    const perso = await chargerInduction()
    if (!perso) return 'Données d\'induction indisponibles pour le moment.'
    const ok = perso.filter(p => p.inductionrecord?.statut === 'valide').length
    const enCours = perso.filter(p => p.inductionrecord?.statut === 'en_cours').length
    return `🎓 Sur ${perso.length} personne(s) :\n• ${ok} induite(s) (validé)\n• ${enCours} en cours\n• ${perso.length - ok - enCours} pas encore commencé`
  }
  if (!data) return '⚠️ Je n\'arrive pas à charger les données du camp. Appuyez sur 🔄 pour réessayer.'
  const hit = INTENTIONS.find(([mots]) => mots.some(m => q.includes(m)))
  if (hit) return hit[1](data)
  return `Je peux répondre sur : la situation du camp, l'occupation des résidences, les incidents de maintenance, les plaintes, `
    + `les événements et alertes, les voyages, le personnel par société et l'induction QHSE. Reformulez avec l'un de ces sujets.`
}

const SUGGESTIONS = [
  "Donne-moi un résumé de la situation du camp",
  "Quel est le taux d'occupation ?",
  "Quelles alertes sont actives ?",
  "Combien de plaintes ouvertes ?",
  "Quels événements arrivent ?",
  "Combien de départs et retours à venir ?",
  "Quels incidents de maintenance sont ouverts ?",
  "Qui n'a pas encore fait son induction QHSE ?",
]

export default function AssistantIA() {
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Bonjour ! Je suis l'assistant du camp Roxgold Sango. Je réponds avec les chiffres réels de l'application (pas de réponse inventée).\n\nJe peux vous renseigner sur :\n• 📊 La situation globale du camp\n• 🏠 Occupation et résidences\n• 🛠️ Maintenance et incidents\n• 🧹 Plaintes en cours\n• 📅 Événements et 🚨 alertes\n• ✈️ Voyages, départs et retours\n• 👥 Personnel par société, 🎓 induction QHSE\n\nQue voulez-vous savoir ?"
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [campData, setCampData] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    collectCampData().then(setCampData)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const q = text || input.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)

    const userMsg = { role:'user', content: q }
    const assistantMsg = { role:'assistant', content:'', loading:true }
    setMessages(prev => [...prev, userMsg, assistantMsg])

    try {
      // Petite latence volontaire pour garder l'effet "réflexion" — l'app
      // reste réactive et gratuite, pas d'appel réseau externe nécessaire.
      await new Promise(r => setTimeout(r, 350))
      const answer = await repondre(q, campData)

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length-1] = { role:'assistant', content:answer, loading:false }
        return updated
      })

      // Rafraîchir les données après chaque question
      collectCampData().then(setCampData)

    } catch(e) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length-1] = {
          role:'assistant',
          content: '⚠️ Une erreur est survenue. Réessayez.',
          loading:false
        }
        return updated
      })
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--rzc-charcoal)' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e3a8a,#7c3aed)', color:'var(--rzc-white)',
        padding: isMobile ? '12px 14px' : '16px 20px', display:'flex', alignItems:'center', gap: isMobile ? 10 : 12 }}>
        <div style={{ width: isMobile?36:44, height: isMobile?36:44, borderRadius:14, background:'rgba(255,255,255,.2)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize: isMobile?18:24, flexShrink:0 }}>🤖</div>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ fontWeight:800, fontSize: isMobile?14:16, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {isMobile ? 'Assistant IA' : 'Assistant IA — Roxgold SiteLife'}
          </div>
          <div style={{ fontSize: isMobile?10.5:12, opacity:.8, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {campData ? (isMobile ? '🟢 Données en temps réel' : '🟢 Connecté aux données en temps réel') : '⏳ Chargement des données...'}
          </div>
        </div>
        <button onClick={()=>collectCampData().then(setCampData)}
          style={{ marginLeft:'auto', background:'rgba(255,255,255,.2)', border:'none', flexShrink:0,
            borderRadius:8, padding: isMobile?'8px':'6px 12px', color:'var(--rzc-white)', cursor:'pointer', fontSize:12 }}>
          {isMobile ? '🔄' : '🔄 Sync'}
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '12px 14px' : '16px 20px' }}>
        {messages.map((m, i) => <MessageBubble key={i} msg={m}/>)}
        <div ref={bottomRef}/>
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div style={isMobile
          ? { padding:'0 14px 10px', display:'flex', gap:8, overflowX:'auto', flexWrap:'nowrap', WebkitOverflowScrolling:'touch' }
          : { padding:'0 20px 10px', display:'flex', gap:8, flexWrap:'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              style={{ background:'var(--rzc-white)', border:'1.5px solid #e2e8f0', borderRadius:99,
                padding:'6px 14px', cursor:'pointer', fontSize:11, color:'var(--rzc-navy)',
                fontWeight:600, transition:'all .15s', flexShrink:0, whiteSpace:'nowrap' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: isMobile ? '10px 14px' : '12px 20px', background:'var(--rzc-white)', borderTop:'1px solid #e2e8f0',
        display:'flex', gap:10, alignItems:'flex-end' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() }}}
          placeholder="Posez votre question sur le camp... (Entrée pour envoyer)"
          rows={2}
          style={{ flex:1, border:'2px solid #e2e8f0', borderRadius:12, padding:'10px 14px',
            fontSize:13, outline:'none', resize:'none', fontFamily:'inherit',
            transition:'border-color .2s' }}
          onFocus={e => e.target.style.borderColor='var(--rzc-navy)'}
          onBlur={e => e.target.style.borderColor='var(--rzc-border-light)'}
        />
        <button onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{ background: (!input.trim()||loading) ? 'var(--rzc-border-light)' : 'linear-gradient(135deg,#1e3a8a,#7c3aed)',
            color: (!input.trim()||loading) ? 'var(--rzc-text-4)' : 'var(--rzc-white)',
            border:'none', borderRadius:12, width:48, height:48,
            cursor: (!input.trim()||loading) ? 'not-allowed' : 'pointer',
            fontSize:20, display:'flex', alignItems:'center', justifyContent:'center',
            flexShrink:0, transition:'all .2s' }}>
          {loading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  )
}
