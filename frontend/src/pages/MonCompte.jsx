import React from 'react'
import { User, Mail, Phone, Building2, Lock, Bell, Globe, Camera, Save } from 'lucide-react'

export default function MonCompte() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Mon Compte</h1>
          <p className="page-sub">Profil, préférences et sécurité</p>
        </div>
        <button className="btn btn-primary"><Save size={14} /> Enregistrer</button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <div className="card card-pad-lg text-center">
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
            <div className="avatar" style={{ width: 96, height: 96, fontSize: 32, borderRadius: 24, margin: '0 auto' }}>AO</div>
            <button style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--copper-600)', color: 'white', border: '2px solid var(--surface)', borderRadius: '50%', width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
              <Camera size={14} />
            </button>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Aminata Ouédraogo</h3>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Manager Camp · ROXGOLD</div>
          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>Membre depuis 15 mars 2026</div>

          <div className="divider" />

          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Connexions</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>247</div>
            </div>
            <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Actions</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>1 432</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-pad-lg">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
              👤 Informations
            </h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field icon={<User size={14} />} label="Nom complet" defaultValue="Aminata Ouédraogo" />
              <Field icon={<Mail size={14} />} label="Email" defaultValue="a.ouedraogo@roxgold.com" />
              <Field icon={<Phone size={14} />} label="Téléphone" defaultValue="+226 70 12 34 56" />
              <Field icon={<Building2 size={14} />} label="Société" defaultValue="ROXGOLD" />
            </div>
          </div>

          <div className="card card-pad-lg">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
              🔒 Sécurité
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Mot de passe</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Dernière modification il y a 12 jours</div>
                  </div>
                </div>
                <button className="btn btn-soft btn-sm">Modifier</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 16 }}>🔐</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Authentification 2FA</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Sécurise ton compte avec un code SMS</div>
                  </div>
                </div>
                <span className="badge badge-ok">Activé</span>
              </div>
            </div>
          </div>

          <div className="card card-pad-lg">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
              🔔 Notifications
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { l: 'Nouveaux incidents critiques', on: true },
                { l: 'Alertes pompe P-203', on: true },
                { l: 'Rapports hebdomadaires', on: false },
                { l: 'Confirmations rotations', on: true },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div style={{ fontSize: 13 }}>{n.l}</div>
                  <button style={{ width: 40, height: 22, borderRadius: 11, background: n.on ? 'var(--copper-500)' : 'var(--bg-2)', border: 'none', cursor: 'pointer', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: 2, left: n.on ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'all .2s' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .divider { height: 1px; background: var(--border); margin: 16px 0; }
        .avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--copper-500), var(--emerald-600)); display: grid; place-items: center; color: white; font-weight: 700; font-size: 13px; }
      `}</style>
    </div>
  )
}

function Field({ icon, label, defaultValue }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {icon} {label}
      </label>
      <input className="input" defaultValue={defaultValue} />
    </div>
  )
}
