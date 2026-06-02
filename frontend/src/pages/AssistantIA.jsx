/**
 * Assistant IA RZI Camp — connecté aux données réelles
 * Répond aux questions sur le camp en utilisant l'API Anthropic
 */
import React, { useState, useEffect, useRef } from 'react'

const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
const hdrs = () => ({ 'Content-Type':'application/json', 'Authorization':`Bearer ${localStorage.getItem('access_token')||''}` })

// Collecte les données du camp pour le contexte IA
async function collectCampData() {
  const endpoints = [
    ['/api/batiments/stats/', 'stats_residences'],
    ['/api/personnel/?page_size=10', 'personnel_sample'],
    ['/api/maintenance/incidents/?statut=declare&page_size=5', 'incidents_ouverts'],
    ['/api/voyages/?statut=en_voyage&page_size=5', 'rotations_actives'],
    ['/api/batiments/?page_size=5', 'residences_sample'],
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
        background: isUser ? 'linear-gradient(135deg,#1e3a8a,#2563eb)' : '#fff',
        color: isUser ? '#fff' : '#1e293b',
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
      // Contexte camp
      const context = campData ? `
DONNÉES RÉELLES DU CAMP ROXGOLD SANGO (temps réel):
${JSON.stringify(campData, null, 2)}
      ` : 'Données du camp non disponibles.'

      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }))

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `Tu es l'assistant IA du camp minier Roxgold Sango en Côte d'Ivoire.
Tu as accès aux données réelles du camp via ce contexte:
${context}

Réponds en français. Sois précis, concis et utile.
Utilise les données fournies pour répondre aux questions.
Si une donnée n'est pas disponible, dis-le clairement.
Format: texte clair avec emojis pour la lisibilité.`,
          messages: [...history, { role:'user', content: q }]
        })
      })

      if (!resp.ok) throw new Error(`API Error ${resp.status}`)
      const data = await resp.json()
      const answer = data.content?.[0]?.text || 'Désolé, je n\'ai pas pu traiter votre demande.'

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
          content: '⚠️ Connexion à l\'IA temporairement indisponible. Vérifiez votre connexion internet.',
          loading:false
        }
        return updated
      })
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)', background:'#f8fafc' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e3a8a,#7c3aed)', color:'#fff',
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
            borderRadius:8, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:12 }}>
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
              style={{ background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:99,
                padding:'6px 14px', cursor:'pointer', fontSize:11, color:'#1e3a8a',
                fontWeight:600, transition:'all .15s' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ padding:'12px 20px', background:'#fff', borderTop:'1px solid #e2e8f0',
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
          onFocus={e => e.target.style.borderColor='#1e3a8a'}
          onBlur={e => e.target.style.borderColor='#e2e8f0'}
        />
        <button onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{ background: (!input.trim()||loading) ? '#e2e8f0' : 'linear-gradient(135deg,#1e3a8a,#7c3aed)',
            color: (!input.trim()||loading) ? '#94a3b8' : '#fff',
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
