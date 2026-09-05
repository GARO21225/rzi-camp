/**
 * Assistant IA RZI Camp — connecté aux données réelles
 * Répond aux questions sur le camp en utilisant l'API Anthropic
 */
import React, { useState, useEffect, useRef } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
const hdrs = () => ({ 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('access_token')||''}` })

// Collecte les données du camp — statistiques complètes (pas des
// échantillons partiels) pour que les réponses soient exactes, pas
// approximatives sur les 5-10 premiers enregistrements seulement.
async function collectCampData() {
  const endpoints = [
    ['/api/batiments/stats/', 'residences'],
    ['/api/incidents/stats-sql/', 'incidents'],
    ['/api/voyages/stats/', 'voyages'],
    ['/api/personnel/?page_size=1000', 'personnel'],
  ]
  const data = {}
  await Promise.allSettled(
    endpoints.map(async ([path, key]) => {
      try {
        const r = await fetch(`${BASE}${path}`, { headers: hdrs() })
        if (r.ok) data[key] = await r.json()
      } catch(e) {}
    })
  )
  return data
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
        {msg.content}
        {msg.loading && <span style={{opacity:.5}}>▋</span>}
      </div>
    </div>
  )
}

// ── Moteur de réponses — règles + données réelles, sans API externe ──
// Pas de clé/abonnement IA payant nécessaire : reconnaît l'intention par
// mots-clés et formule la réponse à partir des vraies données du camp déjà
// chargées. Couvre les questions courantes ; pour le reste, oriente vers
// la bonne page de l'app plutôt que d'inventer une réponse.
function repondre(question, data) {
  const q = question.toLowerCase()
  const res = data?.residences || {}
  const inc = data?.incidents || {}
  const voy = data?.voyages || {}
  const perso = data?.personnel?.results || data?.personnel || []

  const contient = (...mots) => mots.some(m => q.includes(m))

  if (contient('occupation', 'taux', 'plein', 'occupé')) {
    return `🏠 Taux d'occupation actuel : **${res.taux_occupation ?? '—'}%**\n`
      + `• ${res.par_statut?.['Occupé'] ?? 0} résidence(s) occupée(s)\n`
      + `• ${res.par_statut?.['Libre'] ?? 0} libre(s)\n`
      + `• ${res.par_statut?.['Réservé'] ?? 0} réservée(s)\n`
      + `• ${res.par_statut?.['Maintenance'] ?? 0} en maintenance`
  }

  if (contient('résidence', 'chambre', 'dispo', 'libre')) {
    const libres = res.par_statut?.['Libre'] ?? 0
    return libres > 0
      ? `🟢 ${libres} résidence(s) libre(s) actuellement. Voir la liste complète dans Résidences.`
      : `🔴 Aucune résidence libre en ce moment.`
  }

  if (contient('voyage', 'déplacement', 'rotation', 'transit')) {
    return `✈️ ${voy.en_voyage ?? 0} personne(s) actuellement en déplacement.\n`
      + `${voy.planifies ? `📅 ${voy.planifies} voyage(s) planifié(s) à venir.` : ''}`
  }

  if (contient('incident', 'maintenance', 'panne', 'sla')) {
    const ouverts = (inc.declare||0) + (inc.assigne||0) + (inc.en_cours||0)
    return `🛠️ ${ouverts} incident(s) de maintenance ouvert(s)\n`
      + `• ${inc.critique ?? 0} critique(s)\n`
      + `• ${inc.sla_depasse ?? 0} SLA dépassé(s)\n`
      + `Détails dans Maintenance.`
  }

  if (contient('induction', 'qhse', 'formé', 'formation')) {
    const total = perso.length
    const induits = perso.filter(p => p.inductionrecord?.statut === 'valide').length
    const enCours = perso.filter(p => p.inductionrecord?.statut === 'en_cours').length
    const nonFait = total - induits - enCours
    return total
      ? `🎓 Sur ${total} membre(s) du personnel :\n• ${induits} induit(s) (validé)\n• ${enCours} en cours\n• ${nonFait} pas encore commencé`
      : `Données personnel indisponibles pour le moment.`
  }

  if (contient('résumé', 'situation', 'aujourd\'hui', 'aujourdhui', 'global')) {
    const ouverts = (inc.declare||0) + (inc.assigne||0) + (inc.en_cours||0)
    return `📊 **Situation du camp**\n\n`
      + `🏠 Occupation : ${res.taux_occupation ?? '—'}% (${res.par_statut?.['Libre'] ?? 0} libre(s))\n`
      + `✈️ ${voy.en_voyage ?? 0} en déplacement\n`
      + `🛠️ ${ouverts} incident(s) ouvert(s)${inc.critique ? ` dont ${inc.critique} critique(s)` : ''}\n`
      + `👥 ${perso.length || '—'} membre(s) du personnel suivi(s)`
  }

  return `Je peux répondre sur : l'occupation des résidences, les incidents de maintenance, `
    + `les voyages/rotations, l'induction QHSE, ou un résumé global du camp. `
    + `Reformulez votre question avec l'un de ces sujets, ou utilisez les pages dédiées dans le menu.`
}

const SUGGESTIONS = [
  "Quel est le taux d'occupation actuel du camp ?",
  "Combien de personnes sont en voyage en ce moment ?",
  "Quels sont les incidents de maintenance non résolus ?",
  "Donne-moi un résumé de la situation du camp aujourd'hui",
  "Qui n'a pas encore fait son induction QHSE ?",
  "Quelles résidences sont disponibles ?",
]

export default function AssistantIA() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Bonjour ! Je suis l'assistant IA du camp Roxgold Sango. Je suis connecté à toutes vos données en temps réel.\n\nJe peux vous aider avec :\n• 📊 Statistiques et rapports du camp\n• 🏠 État des résidences et occupation\n• 👤 Suivi du personnel et des inducti\ons\n• 🛠️ Maintenance et incidents\n• ✈️ Rotations et voyages\n\nQue puis-je faire pour vous ?"
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
      const answer = repondre(q, campData)

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
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)', background:'var(--rzc-charcoal)' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e3a8a,#7c3aed)', color:'var(--rzc-white)',
        padding:'16px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:'rgba(255,255,255,.2)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🤖</div>
        <div>
          <div style={{ fontWeight:800, fontSize:16 }}>Assistant IA — RZI Camp</div>
          <div style={{ fontSize:12, opacity:.8 }}>
            {campData ? '🟢 Connecté aux données en temps réel' : '⏳ Chargement des données...'}
          </div>
        </div>
        <button onClick={()=>collectCampData().then(setCampData)}
          style={{ marginLeft:'auto', background:'rgba(255,255,255,.2)', border:'none',
            borderRadius:8, padding:'6px 12px', color:'var(--rzc-white)', cursor:'pointer', fontSize:12 }}>
          🔄 Sync
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
        {messages.map((m, i) => <MessageBubble key={i} msg={m}/>)}
        <div ref={bottomRef}/>
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div style={{ padding:'0 20px 10px', display:'flex', gap:8, flexWrap:'wrap' }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              style={{ background:'var(--rzc-white)', border:'1.5px solid #e2e8f0', borderRadius:99,
                padding:'6px 14px', cursor:'pointer', fontSize:11, color:'var(--rzc-navy)',
                fontWeight:600, transition:'all .15s' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'12px 20px', background:'var(--rzc-white)', borderTop:'1px solid #e2e8f0',
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
