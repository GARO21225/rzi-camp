import React, { useState, useRef, useEffect } from 'react'
import { X, Send, Bot } from 'lucide-react'

export default function AIFab({ open, onToggle }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: '👋 Bonjour Aminata. J\'ai préparé ton briefing. 3 priorités, 2 alertes. Que veux-tu explorer ?' },
  ])
  const [input, setInput] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    setTimeout(() => {
      const reply = aiReply(text)
      setMessages((m) => [...m, { role: 'bot', text: reply }])
    }, 500)
  }

  const ask = (q) => { setInput(q); setTimeout(send, 100) }

  return (
    <>
      <button className="ai-fab" onClick={onToggle} title="Copilote IA">
        <Bot size={22} />
        <span className="ai-fab-badge">3</span>
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-head">
            <div className="ai-mark">
              <Bot size={18} color="white" />
            </div>
            <div>
              <h3>RZ-1 · Copilote Camp</h3>
              <p>Toujours connecté · 3 alertes actives</p>
            </div>
            <button onClick={onToggle} className="ai-close">
              <X size={14} />
            </button>
          </div>
          <div className="ai-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <div className="ai-av">{m.role === 'user' ? 'AO' : 'AI'}</div>
                <div className="ai-bubble" dangerouslySetInnerHTML={{ __html: m.text }} />
              </div>
            ))}
          </div>
          <div className="ai-suggest">
            <button onClick={() => ask('Quel est le résumé de la journée ?')}>📊 Résumé</button>
            <button onClick={() => ask('Quelles sont les alertes actives ?')}>⚠️ Alertes</button>
            <button onClick={() => ask('Détails pompe P-203')}>🔧 Pompe P-203</button>
            <button onClick={() => ask('Optimisations coûts')}>💰 Coûts</button>
          </div>
          <div className="ai-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Demande au copilote…"
            />
            <button className="btn btn-primary btn-icon" onClick={send}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        .ai-fab {
          position: fixed; bottom: 24px; right: 24px;
          width: 56px; height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--gold-400), var(--gold-600));
          color: white;
          display: grid; place-items: center;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(255,205,0,.45);
          z-index: 100;
          transition: all .2s;
          border: 2px solid rgba(255,255,255,.2);
        }
        .ai-fab:hover { transform: scale(1.08); }
        .ai-fab-badge {
          position: absolute; top: -2px; right: -2px;
          background: var(--status-alert); color: white;
          font-size: 10px; font-weight: 700;
          padding: 2px 6px; border-radius: 999px;
          border: 2px solid var(--surface);
        }
        .ai-panel {
          position: fixed; bottom: 92px; right: 24px;
          width: 380px; max-width: calc(100vw - 32px);
          max-height: 600px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 18px;
          box-shadow: var(--shadow-xl);
          display: flex; flex-direction: column;
          overflow: hidden;
          z-index: 100;
          animation: slideUp .3s cubic-bezier(.16,1,.3,1);
        }
        .ai-head { padding: 14px 16px; background: linear-gradient(135deg, var(--ink-900), var(--ink-700)); color: white; display: flex; align-items: center; gap: 12px; }
        .ai-mark { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--gold-400), var(--gold-600)); display: grid; place-items: center; box-shadow: 0 4px 12px rgba(255,205,0,.35); }
        .ai-head h3 { font-size: 14px; font-weight: 700; }
        .ai-head p { font-size: 11px; color: rgba(255,255,255,.65); margin-top: 1px; }
        .ai-close { margin-left: auto; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15); color: white; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 14px; display: grid; place-items: center; }
        .ai-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 280px; max-height: 360px; }
        .ai-msg { display: flex; gap: 8px; }
        .ai-av { width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
        .ai-msg.user .ai-av { background: var(--copper-100); color: var(--copper-700); }
        .ai-msg.bot .ai-av { background: linear-gradient(135deg, var(--gold-400), var(--gold-600)); color: white; }
        .ai-msg.user { flex-direction: row-reverse; }
        .ai-bubble { background: var(--bg-2); border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.5; max-width: 280px; }
        .ai-msg.user .ai-bubble { background: var(--copper-100); color: var(--copper-900); }
        .ai-suggest { padding: 0 16px 8px; display: flex; gap: 6px; flex-wrap: wrap; }
        .ai-suggest button { font-size: 11.5px; padding: 5px 10px; background: var(--bg-2); border: 1px solid var(--border); border-radius: 999px; cursor: pointer; color: var(--text-2); font-family: inherit; }
        .ai-suggest button:hover { background: var(--gold-50); color: var(--gold-800); border-color: var(--gold-300); }
        .ai-input { border-top: 1px solid var(--border); padding: 10px; display: flex; gap: 6px; align-items: center; }
        .ai-input input { flex: 1; height: 36px; border: 1px solid var(--border-2); background: var(--bg-2); border-radius: 10px; padding: 0 12px; font-size: 13px; font-family: inherit; outline: none; color: var(--text); }
        .ai-input input:focus { border-color: var(--copper-500); }
      `}</style>
    </>
  )
}

function aiReply(q) {
  const l = q.toLowerCase()
  if (l.includes('résum') || l.includes('jour')) {
    return '<strong>3 priorités</strong> pour aujourd\'hui :<br>• Fuite B47 · intervention 02:20<br>• Pompe P-203 · risque panne 87%<br>• Rotation AT-447 · 38 personnes à processer'
  }
  if (l.includes('alerte') || l.includes('urgent')) {
    return '🚨 <strong>3 alertes actives</strong> :<br>1. Pompe P-203 · vibrations anormales (P2)<br>2. Fraude QR B12 · doublons suspects<br>3. Pic électrique +18% · bloc C'
  }
  if (l.includes('p203') || l.includes('pompe')) {
    return '🔧 <strong>Pompe P-203</strong> · 87% de probabilité de panne sous 72h.<br><br>Trois signaux concordants : vibrations +142%, T° +8°C, courant intermittent. Coût évité estimé : <strong>18 000 €</strong>.'
  }
  if (l.includes('coût') || l.includes('optim')) {
    return '💰 <strong>3 optimisations détectées</strong> :<br>• Décale clim bloc C 2h → -14 200€/mois<br>• Coupe éclairage parking 23h-5h → -2 800€/mois<br>• Regrouper livraisons → -1 200€/mois'
  }
  return 'Bonne question. Je peux analyser les données du camp. Essaie : "résumé", "alertes", "pompe P-203" ou "coûts".'
}
