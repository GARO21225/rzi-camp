import React, { useState, useEffect, useCallback } from 'react'
import { inductionConfig, inductionInfras, inductionRegles, inductionQuiz } from '../api'

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  if (file.size > 3 * 1024 * 1024) { reject(new Error('Photo trop lourde (max 3 Mo)')); return }
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = reject
  r.readAsDataURL(file)
})

const NIVEAUX = [
  { v: 'critique',  l: '🔴 Critique' },
  { v: 'important', l: '🟠 Important' },
  { v: 'standard',  l: '🔵 Standard' },
]

function Section({ title, count, action, children }) {
  return (
    <div className="rzc-card" style={{ marginBottom: 20, padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', borderBottom: '1px solid var(--rzc-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--rzc-text)' }}>{title}</span>
          {typeof count === 'number' && (
            <span className="rzc-badge rzc-badge-gold">{count}</span>
          )}
        </div>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function Toolbar({ item, onEdit, onDelete, onToggleActif }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <button onClick={() => onToggleActif(item)}
        title={item.actif ? 'Désactiver (masquer du parcours)' : 'Activer'}
        style={{ background: item.actif ? 'var(--rzc-green-l)' : 'rgba(15,26,46,.05)',
          color: item.actif ? '#15803D' : 'var(--rzc-text-3)',
          border: '1px solid ' + (item.actif ? 'rgba(74,222,128,.3)' : 'var(--rzc-border-light)'),
          padding: '4px 9px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
        {item.actif ? '✓ Actif' : '✕ Inactif'}
      </button>
      <button onClick={() => onEdit(item)}
        style={{ background: 'var(--rzc-blue-l)', color: '#2563EB', border: '1px solid rgba(37,99,235,.25)',
          padding: '4px 9px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
        ✏️ Modifier
      </button>
      <button onClick={() => onDelete(item)}
        style={{ background: 'var(--rzc-red-l)', color: '#DC2626', border: '1px solid rgba(220,38,38,.25)',
          padding: '4px 9px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
        🗑️
      </button>
    </div>
  )
}

const inp = {
  width: '100%', border: '1px solid var(--rzc-border-light)', borderRadius: 9,
  padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box', background: 'var(--rzc-charcoal-l2)', color: 'var(--rzc-text)',
}
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--rzc-text-3)', marginBottom: 4 }

// ─────────────────────────────────────────────────────────────────
//  MODAL générique de formulaire
// ─────────────────────────────────────────────────────────────────
function FormModal({ title, onClose, onSave, saving, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,15,20,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rzc-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh',
        overflowY: 'auto', padding: 0 }}>
        <div style={{ background: 'linear-gradient(135deg,var(--rzc-navy),#1E3A8A)', color: '#fff',
          padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none',
            color: '#fff', width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {children}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={onClose} style={{ flex: 1, background: 'rgba(15,26,46,.04)',
              color: 'var(--rzc-text-3)', border: '1px solid var(--rzc-border-light)',
              padding: 11, borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Annuler
            </button>
            <button onClick={onSave} disabled={saving}
              className="rzc-btn rzc-btn-primary" style={{ flex: 2, padding: 11, fontSize: 13 }}>
              {saving ? '⏳ Enregistrement...' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
//  PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────
export default function InductionAdmin() {
  const [tab, setTab] = useState('config')
  const [config, setConfig] = useState(null)
  const [infras, setInfras] = useState([])
  const [regles, setRegles] = useState([])
  const [quiz, setQuiz] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [modal, setModal] = useState(null)      // { type: 'infra'|'regle'|'quiz', item: {...} | 'new' }
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [photoErr, setPhotoErr] = useState('')
  const [importing, setImporting] = useState(false)

  const importerDonnees = async () => {
    setImporting(true); setErr('')
    try {
      const r = await inductionConfig.importerDonneesOriginales()
      if (r.data.status === 'skipped') {
        setErr(r.data.message)
      }
      load()
    } catch (e) {
      setErr(e.response?.data?.error || 'Erreur lors de l\'import des données existantes')
    }
    setImporting(false)
  }

  const DEFAULT_CONFIG = {
    nom: 'Camp Résidentiel', site: '', capacite: 0,
    superficie: '', altitude: '', duree_parcours_min: 15,
  }

  const load = useCallback(async () => {
    setLoading(true)
    const failed = []
    try {
      // Timeout 10s par appel : sur cold start Render (plan gratuit), évite que
      // l'écran de chargement reste bloqué jusqu'aux 30s du timeout Axios global.
      const withTimeout = (p) => Promise.race([
        p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))
      ])
      const [rC, rI, rR, rQ] = await Promise.allSettled([
        withTimeout(inductionConfig.actuelle()),
        withTimeout(inductionInfras.list()),
        withTimeout(inductionRegles.list()),
        withTimeout(inductionQuiz.list()),
      ])
      if (rC.status === 'fulfilled') setConfig(rC.value.data)
      else { failed.push('configuration'); setConfig(DEFAULT_CONFIG) }
      if (rI.status === 'fulfilled') setInfras(rI.value.data.results || rI.value.data || [])
      else failed.push('infrastructures')
      if (rR.status === 'fulfilled') setRegles(rR.value.data.results || rR.value.data || [])
      else failed.push('règles')
      if (rQ.status === 'fulfilled') setQuiz(rQ.value.data.results || rQ.value.data || [])
      else failed.push('quiz')
      if (failed.length) {
        setErr(`Chargement partiel — ${failed.join(', ')} indisponible(s). ` +
          `Si le problème persiste, les tables de la base ne sont peut-être pas encore créées ` +
          `(exécuter /api/setup-db/ une fois côté backend).`)
      }
    } catch (e) { setErr('Erreur de chargement'); setConfig(DEFAULT_CONFIG) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Config générale ──
  const [configForm, setConfigForm] = useState(null)
  useEffect(() => { if (config) setConfigForm(config) }, [config])
  const saveConfig = async () => {
    setSaving(true); setErr('')
    try {
      if (configForm.id) await inductionConfig.update(configForm.id, configForm)
      else { const r = await inductionConfig.create(configForm); setConfigForm(r.data) }
      load()
    } catch (e) { setErr('Erreur sauvegarde configuration') }
    setSaving(false)
  }

  // ── Ouverture modal création/édition ──
  const openModal = (type, item) => {
    setPhotoErr('')
    if (item === 'new') {
      const defaults = {
        infra: { titre: '', emoji: '🏠', couleur: '#3b82f6', description: '', details: [], photo_base64: '', ordre: 0, actif: true },
        regle: { titre: '', emoji: '📋', niveau: 'standard', texte: '', ordre: 0, actif: true },
        quiz:  { question: '', options: ['', ''], bonne_reponse: 0, explication: '', ordre: 0, actif: true },
      }[type]
      setForm(defaults)
    } else {
      setForm({ ...item, details: item.details || [], options: item.options || ['', ''] })
    }
    setModal({ type, item })
  }

  const closeModal = () => { setModal(null); setForm({}) }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoErr('')
    try {
      const b64 = await fileToBase64(file)
      setForm(f => ({ ...f, photo_base64: b64, photo_mime: file.type }))
    } catch (e) { setPhotoErr(e.message) }
  }

  const saveItem = async () => {
    setSaving(true); setErr('')
    const api = { infra: inductionInfras, regle: inductionRegles, quiz: inductionQuiz }[modal.type]
    try {
      if (modal.item !== 'new' && modal.item.id) {
        await api.update(modal.item.id, form)
      } else {
        await api.create(form)
      }
      closeModal(); load()
    } catch (e) {
      setErr(e.response?.data?.detail || JSON.stringify(e.response?.data || {}) || 'Erreur')
    } finally { setSaving(false) }
  }

  const deleteItem = async (type, item) => {
    if (!window.confirm(`Supprimer « ${item.titre || item.question?.slice(0,40)} » ?`)) return
    const api = { infra: inductionInfras, regle: inductionRegles, quiz: inductionQuiz }[type]
    try { await api.delete(item.id); load() } catch (e) { alert('Erreur suppression') }
  }

  const toggleActif = async (type, item) => {
    const api = { infra: inductionInfras, regle: inductionRegles, quiz: inductionQuiz }[type]
    try { await api.update(item.id, { actif: !item.actif }); load() } catch (e) { alert('Erreur') }
  }

  const TABS = [
    { v: 'config', l: '⚙️ Configuration', n: null },
    { v: 'infras', l: '🏠 Infrastructures', n: infras.length },
    { v: 'regles', l: '📋 Règles', n: regles.length },
    { v: 'quiz',   l: '❓ Quiz', n: quiz.length },
  ]

  if (loading) return (
    <div className="rzc-page-scope" style={{ padding: 22 }}>
      <div className="rzc-skeleton" style={{ width: 280, height: 28, marginBottom: 20 }} />
      {[1,2,3].map(i => <div key={i} className="rzc-skeleton" style={{ height: 70, marginBottom: 10, borderRadius: 12 }} />)}
    </div>
  )

  return (
    <div className="rzc-page-scope rzc-fade-in" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: 'var(--rzc-navy)' }}>
            🛠️ Administration — Induction Camp
          </h1>
          <p style={{ fontSize: 12, color: 'var(--rzc-text-3)', margin: '4px 0 0' }}>
            Personnalisez le contenu vu par le personnel lors de son induction
          </p>
        </div>
        {infras.length === 0 && regles.length === 0 && quiz.length === 0 && (
          <button onClick={importerDonnees} disabled={importing} className="rzc-btn rzc-btn-primary">
            {importing ? '⏳ Import en cours...' : '📥 Récupérer les données existantes'}
          </button>
        )}
      </div>

      {err && (
        <div style={{ background: 'var(--rzc-red-l)', border: '1px solid rgba(220,38,38,.25)',
          borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 12, marginBottom: 14 }}>
          ❌ {err}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: '1px solid var(--rzc-border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            style={{
              background: tab === t.v ? 'var(--rzc-navy)' : 'transparent',
              color: tab === t.v ? '#fff' : 'var(--rzc-text-3)',
              border: 'none', borderRadius: '9px 9px 0 0', padding: '9px 16px',
              cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {t.l} {typeof t.n === 'number' && <span style={{ opacity: .8, fontSize: 11 }}>({t.n})</span>}
          </button>
        ))}
      </div>

      {/* ── Tab Configuration ── */}
      {tab === 'config' && configForm && (
        <Section title="Configuration générale du camp">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={label}>NOM DU CAMP</label>
              <input style={inp} value={configForm.nom || ''} onChange={e => setConfigForm({ ...configForm, nom: e.target.value })} />
            </div>
            <div>
              <label style={label}>SITE</label>
              <input style={inp} value={configForm.site || ''} onChange={e => setConfigForm({ ...configForm, site: e.target.value })}
                placeholder="Ex: Mine d'Or de Sango · Côte d'Ivoire" />
            </div>
            <div>
              <label style={label}>CAPACITÉ (nombre de résidents)</label>
              <input type="number" style={inp} value={configForm.capacite || 0}
                onChange={e => setConfigForm({ ...configForm, capacite: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={label}>SUPERFICIE</label>
              <input style={inp} value={configForm.superficie || ''} onChange={e => setConfigForm({ ...configForm, superficie: e.target.value })}
                placeholder="Ex: 12 ha" />
            </div>
            <div>
              <label style={label}>ALTITUDE</label>
              <input style={inp} value={configForm.altitude || ''} onChange={e => setConfigForm({ ...configForm, altitude: e.target.value })}
                placeholder="Ex: 347m" />
            </div>
            <div>
              <label style={label}>DURÉE DU PARCOURS (minutes)</label>
              <input type="number" style={inp} value={configForm.duree_parcours_min || 15}
                onChange={e => setConfigForm({ ...configForm, duree_parcours_min: parseInt(e.target.value) || 15 })} />
            </div>
          </div>
          <button onClick={saveConfig} disabled={saving} className="rzc-btn rzc-btn-primary" style={{ marginTop: 16 }}>
            {saving ? '⏳ Enregistrement...' : '💾 Enregistrer la configuration'}
          </button>
        </Section>
      )}

      {/* ── Tab Infrastructures ── */}
      {tab === 'infras' && (
        <Section title="Infrastructures du camp" count={infras.length}
          action={<button onClick={() => openModal('infra', 'new')} className="rzc-btn rzc-btn-primary">➕ Ajouter</button>}>
          {infras.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--rzc-text-3)', padding: '20px 0' }}>Aucune infrastructure — ajoutez-en une.</p>
            : infras.map(i => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px',
                borderBottom: '1px solid var(--rzc-border)' }}>
                {i.photo_base64
                  ? <img src={i.photo_base64} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 44, height: 44, borderRadius: 8, background: i.couleur + '22',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{i.emoji}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--rzc-text)' }}>{i.titre}</div>
                  <div style={{ fontSize: 11, color: 'var(--rzc-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description}</div>
                </div>
                <Toolbar item={i} onEdit={() => openModal('infra', i)} onDelete={() => deleteItem('infra', i)} onToggleActif={() => toggleActif('infra', i)} />
              </div>
            ))}
        </Section>
      )}

      {/* ── Tab Règles ── */}
      {tab === 'regles' && (
        <Section title="Règles de vie du camp" count={regles.length}
          action={<button onClick={() => openModal('regle', 'new')} className="rzc-btn rzc-btn-primary">➕ Ajouter</button>}>
          {regles.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--rzc-text-3)', padding: '20px 0' }}>Aucune règle — ajoutez-en une.</p>
            : regles.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px',
                borderBottom: '1px solid var(--rzc-border)' }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{r.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--rzc-text)' }}>{r.titre}</span>
                    <span className={`rzc-badge rzc-badge-${r.niveau === 'critique' ? 'alert' : r.niveau === 'important' ? 'gold' : 'info'}`}>
                      {NIVEAUX.find(n => n.v === r.niveau)?.l}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--rzc-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.texte}</div>
                </div>
                <Toolbar item={r} onEdit={() => openModal('regle', r)} onDelete={() => deleteItem('regle', r)} onToggleActif={() => toggleActif('regle', r)} />
              </div>
            ))}
        </Section>
      )}

      {/* ── Tab Quiz ── */}
      {tab === 'quiz' && (
        <Section title="Questions du quiz de validation" count={quiz.length}
          action={<button onClick={() => openModal('quiz', 'new')} className="rzc-btn rzc-btn-primary">➕ Ajouter</button>}>
          {quiz.length === 0
            ? <p style={{ textAlign: 'center', color: 'var(--rzc-text-3)', padding: '20px 0' }}>Aucune question — ajoutez-en une.</p>
            : quiz.map(q => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 8px',
                borderBottom: '1px solid var(--rzc-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--rzc-text)' }}>{q.question}</div>
                  <div style={{ fontSize: 11, color: 'var(--rzc-text-3)', marginTop: 3 }}>
                    {(q.options || []).length} options · bonne réponse: {q.options?.[q.bonne_reponse] || '—'}
                  </div>
                </div>
                <Toolbar item={q} onEdit={() => openModal('quiz', q)} onDelete={() => deleteItem('quiz', q)} onToggleActif={() => toggleActif('quiz', q)} />
              </div>
            ))}
        </Section>
      )}

      {/* ══ MODAL INFRA ══ */}
      {modal?.type === 'infra' && (
        <FormModal title={modal.item === 'new' ? '➕ Nouvelle infrastructure' : '✏️ Modifier infrastructure'}
          onClose={closeModal} onSave={saveItem} saving={saving}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>TITRE *</label>
              <input style={inp} value={form.titre || ''} onChange={e => setForm({ ...form, titre: e.target.value })} />
            </div>
            <div>
              <label style={label}>EMOJI (si pas de photo)</label>
              <input style={inp} value={form.emoji || ''} onChange={e => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
            </div>
          </div>
          <div>
            <label style={label}>DESCRIPTION</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label style={label}>DÉTAILS (un par ligne)</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }}
              value={(form.details || []).join('\n')}
              onChange={e => setForm({ ...form, details: e.target.value.split('\n').filter(Boolean) })}
              placeholder={"Clim réglable 20-26°C\nWi-Fi 50 Mbps\nLinge fourni"} />
          </div>
          <div>
            <label style={label}>PHOTO (remplace l'emoji, max 3 Mo)</label>
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ fontSize: 12 }} />
            {photoErr && <p style={{ color: '#DC2626', fontSize: 11, marginTop: 4 }}>{photoErr}</p>}
            {form.photo_base64 && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={form.photo_base64} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
                <button onClick={() => setForm({ ...form, photo_base64: '' })}
                  style={{ background: 'var(--rzc-red-l)', color: '#DC2626', border: 'none', borderRadius: 7,
                    padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Retirer la photo</button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>ORDRE D'AFFICHAGE</label>
              <input type="number" style={inp} value={form.ordre || 0} onChange={e => setForm({ ...form, ordre: parseInt(e.target.value) || 0 })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <input type="checkbox" checked={form.actif !== false} onChange={e => setForm({ ...form, actif: e.target.checked })} />
              <label style={{ fontSize: 12, color: 'var(--rzc-text-2)' }}>Visible dans le parcours d'induction</label>
            </div>
          </div>
        </FormModal>
      )}

      {/* ══ MODAL RÈGLE ══ */}
      {modal?.type === 'regle' && (
        <FormModal title={modal.item === 'new' ? '➕ Nouvelle règle' : '✏️ Modifier règle'}
          onClose={closeModal} onSave={saveItem} saving={saving}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>TITRE *</label>
              <input style={inp} value={form.titre || ''} onChange={e => setForm({ ...form, titre: e.target.value })} />
            </div>
            <div>
              <label style={label}>EMOJI</label>
              <input style={inp} value={form.emoji || ''} onChange={e => setForm({ ...form, emoji: e.target.value })} maxLength={4} />
            </div>
            <div>
              <label style={label}>NIVEAU</label>
              <select style={inp} value={form.niveau || 'standard'} onChange={e => setForm({ ...form, niveau: e.target.value })}>
                {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={label}>TEXTE DE LA RÈGLE *</label>
            <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={form.texte || ''}
              onChange={e => setForm({ ...form, texte: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>ORDRE D'AFFICHAGE</label>
              <input type="number" style={inp} value={form.ordre || 0} onChange={e => setForm({ ...form, ordre: parseInt(e.target.value) || 0 })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <input type="checkbox" checked={form.actif !== false} onChange={e => setForm({ ...form, actif: e.target.checked })} />
              <label style={{ fontSize: 12, color: 'var(--rzc-text-2)' }}>Visible dans le parcours d'induction</label>
            </div>
          </div>
        </FormModal>
      )}

      {/* ══ MODAL QUIZ ══ */}
      {modal?.type === 'quiz' && (
        <FormModal title={modal.item === 'new' ? '➕ Nouvelle question' : '✏️ Modifier question'}
          onClose={closeModal} onSave={saveItem} saving={saving}>
          <div>
            <label style={label}>QUESTION *</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.question || ''}
              onChange={e => setForm({ ...form, question: e.target.value })} />
          </div>
          <div>
            <label style={label}>OPTIONS DE RÉPONSE</label>
            {(form.options || []).map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input type="radio" name="bonne_reponse" checked={form.bonne_reponse === i}
                  onChange={() => setForm({ ...form, bonne_reponse: i })} title="Marquer comme bonne réponse" />
                <input style={inp} value={opt}
                  onChange={e => {
                    const next = [...form.options]; next[i] = e.target.value
                    setForm({ ...form, options: next })
                  }}
                  placeholder={`Option ${i + 1}`} />
                {form.options.length > 2 && (
                  <button onClick={() => {
                    const next = form.options.filter((_, idx) => idx !== i)
                    const newBonne = form.bonne_reponse >= next.length ? 0 : form.bonne_reponse
                    setForm({ ...form, options: next, bonne_reponse: newBonne })
                  }} style={{ background: 'var(--rzc-red-l)', color: '#DC2626', border: 'none',
                    borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✕</button>
                )}
              </div>
            ))}
            {(form.options || []).length < 6 && (
              <button onClick={() => setForm({ ...form, options: [...(form.options || []), ''] })}
                style={{ background: 'rgba(15,26,46,.04)', color: 'var(--rzc-text-3)', border: '1px dashed var(--rzc-border-light)',
                  borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
                ➕ Ajouter une option
              </button>
            )}
            <p style={{ fontSize: 10, color: 'var(--rzc-text-4)', marginTop: 6 }}>
              ⦿ Cochez le bouton radio devant la bonne réponse.
            </p>
          </div>
          <div>
            <label style={label}>EXPLICATION (affichée si la personne se trompe)</label>
            <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.explication || ''}
              onChange={e => setForm({ ...form, explication: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label}>ORDRE D'AFFICHAGE</label>
              <input type="number" style={inp} value={form.ordre || 0} onChange={e => setForm({ ...form, ordre: parseInt(e.target.value) || 0 })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
              <input type="checkbox" checked={form.actif !== false} onChange={e => setForm({ ...form, actif: e.target.checked })} />
              <label style={{ fontSize: 12, color: 'var(--rzc-text-2)' }}>Incluse dans le quiz</label>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  )
}
