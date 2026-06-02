import React, { useState, useRef, useEffect } from 'react'
import { Bot, Send, Sparkles, FileText, Wrench, TrendingUp } from 'lucide-react'

const SUGGESTIONS = [
  { icon: <FileText size={12} />, label: '📊 Résumé du jour' },
  { icon: <Wrench size={12} />, label: '🔧 Détails pompe P-203' },
  { icon: <TrendingUp size={12} />, label: '💰 Optimisations coûts' },
  { icon: <Sparkles size={12} />, label: '⚠️ Prédictions maintenance' },
  { icon: <Bot size={12} />, label: '👥 Effectif optimal' },
  { icon: <FileText size={12} />, label: '🍽️ Prévision repas' },
  { icon: <Sparkles size={12} />, label: '🌍 Bilan carbone' },
]

export default function CopiloteIA() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: '<strong>Bonjour Aminata</strong>. J\'ai analysé la nuit. <strong>3 éléments importants</strong> à traiter avant midi :<ol style="margin: 8px 0 0 16px; line-height: 1.7;"><li>Fuite B47 · intervention planifiée 02:20</li><li>Pompe P-203 · proba panne 87% (vs 12% hier)</li><li>Rotation Vol AT-447 · 38 personnes à processer</li></ol>',
    },
  ])
  const [input, setInput] = useState('')
  const bodyRef = useRef(null)

  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  const send = (text) => {
    const q = (text || input).trim()
    if (!q) return
    setMessages((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setTimeout(() => setMessages((m) => [...m, { role: 'bot', text: aiReply(q) }]), 500)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Copilote IA Opérationnel</h1>
          <p className="page-sub">Assistant contextuel · analyses prédictives · actions exécutables</p>
        </div>
        <span className="badge badge-ok"><span className="dot dot-ok" />14 sources connectées</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '280px 1fr' }}>
        <div className="card card-pad-lg" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Suggestions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => send(s.label.replace(/^[^ ]+ /, ''))}
                style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12.5, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 9, cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit' }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
          <h3 style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Capacités actives</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
            {[
              { l: 'Prédiction panne', on: true },
              { l: 'Détection fraude', on: true },
              { l: 'Analyse sentiment', on: true },
              { l: 'Vision caméra', on: false, beta: true },
              { l: 'Génération rapport', on: true },
            ].map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span>{c.l}</span>
                <span className={`badge badge-${c.beta ? 'warn' : c.on ? 'ok' : 'ink'}`}>{c.beta ? 'Bêta' : c.on ? 'Actif' : 'Inactif'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 18, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, var(--gold-400), var(--gold-600))', display: 'grid', placeItems: 'center' }}>
              <Bot size={20} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>RZ-1 · Assistant Camp</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Modèle RZI-Camp v2.3 · formé sur 18 mois</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }} ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`} style={{ display: 'flex', gap: 8 }}>
                <div className="ai-av" style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, background: m.role === 'user' ? 'var(--copper-100)' : 'linear-gradient(135deg, var(--gold-400), var(--gold-600))', color: m.role === 'user' ? 'var(--copper-700)' : 'white' }}>
                  {m.role === 'user' ? 'AO' : 'AI'}
                </div>
                <div className="bubble" style={{ background: m.role === 'user' ? 'var(--copper-100)' : 'var(--bg-2)', color: m.role === 'user' ? 'var(--copper-900)' : 'var(--text)', borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, maxWidth: 480 }} dangerouslySetInnerHTML={{ __html: m.text }} />
              </div>
            ))}
          </div>

          <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
            <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
              {['📋 Crée intervention', '🔮 Prédictions', '👥 Effectif optimal', '📊 Rapport'].map((s) => (
                <button key={s} onClick={() => send(s.replace(/^[^ ]+ /, ''))} style={{ fontSize: 11.5, padding: '5px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 999, cursor: 'pointer', color: 'var(--text-2)', fontFamily: 'inherit' }}>{s}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="Demande au copilote…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-icon btn-primary" onClick={() => send()}><Send size={14} /></button>
            </div>
          </div>
        </div>
      </div>

      <style>{`.grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; } .mb-2 { margin-bottom: 8px; } .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }`}</style>
    </div>
  )
}

function aiReply(q) {
  const l = q.toLowerCase()
  if (l.includes('résum') || l.includes('jour')) {
    return '<strong>3 priorités</strong> pour aujourd\'hui :<br>• Fuite B47 · intervention 02:20<br>• Pompe P-203 · risque panne 87%<br>• Rotation AT-447 · 38 personnes à processer<br><br>📊 Occupation <strong>92%</strong> · Conformité HSE <strong>98.4%</strong> · 7 incidents ouverts (↓ 3).'
  }
  if (l.includes('p203') || l.includes('pompe')) {
    return '🔧 <strong>Pompe P-203</strong> · 87% de probabilité de panne sous 72h.<br><br>Trois signaux concordants : vibrations +142%, T° +8°C, courant intermittent. Coût évité estimé : <strong>18 000 €</strong>.<br><br>Recommandation : commander SKF-6205 et planifier arrêt. Je peux créer l\'intervention si tu valides.'
  }
  if (l.includes('coût') || l.includes('optim')) {
    return '💰 <strong>3 optimisations détectées</strong> :<br>• Décale clim bloc C 2h → -14 200€/mois<br>• Coupe éclairage parking 23h-5h → -2 800€/mois<br>• Regrouper livraisons → -1 200€/mois'
  }
  if (l.includes('effectif') || l.includes('personnel')) {
    return '👥 <strong>Effectif actuel</strong> : 847 personnes (incl. 156 expatriés).<br><br>Pic d\'occupation : <strong>12h-14h</strong> (déjeuner) et <strong>18h-20h</strong> (dîner). Recommandation : renforcer équipe ménage 14h-16h.'
  }
  if (l.includes('repas') || l.includes('resto')) {
    return '🍽️ <strong>Prévision repas aujourd\'hui</strong> : 1 247 repas (↑ 8%).<br>• Petit-déj : 412<br>• Déjeuner : 628<br>• Dîner : 207 estimé<br><br>Stock OK pour tous les menus.'
  }
  if (l.includes('carbone') || l.includes('co2')) {
    return '🌍 <strong>Bilan carbone Mai 2026</strong> : 1 247 tCO2e<br><br>• Électricité (générateur) : 67%<br>• Transport (rotations) : 22%<br>• Restauration : 8%<br>• Eau : 3%<br><br>Objectif 2026 : -15% vs 2025.'
  }
  if (l.includes('crée') || l.includes('intervention')) {
    return '✓ <strong>Intervention #MNT-2848</strong> créée · priorité P2 · ETA 72h.<br>✓ Notification envoyée à Moussa Koné.<br>✓ Pièce SKF-6205 ajoutée au bon de commande #PO-2026-0892.'
  }
  return 'Bonne question. Je peux analyser les données du camp. Essaie : "résumé", "pompe P-203", "coûts" ou "effectif".'
}
