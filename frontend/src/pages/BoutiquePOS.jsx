import React, { useState } from 'react'
import { QrCode, Plus, Minus, Trash2, CreditCard, User } from 'lucide-react'

const ARTICLES = [
  { id: 1, name: 'Café 250g', prix: 2500, stock: 42, cat: 'Boissons' },
  { id: 2, name: 'Eau 1.5L', prix: 800, stock: 8, cat: 'Boissons' },
  { id: 3, name: 'Sandwich poulet', prix: 3500, stock: 12, cat: 'Snacking' },
  { id: 4, name: 'Coca-Cola 33cl', prix: 1200, stock: 96, cat: 'Boissons' },
  { id: 5, name: 'Biscuits Prince', prix: 800, stock: 18, cat: 'Snacking' },
  { id: 6, name: 'Cigarettes Marlboro', prix: 1500, stock: 28, cat: 'Tabac' },
]

export default function BoutiquePOS() {
  const [cart, setCart] = useState([])
  const [client, setClient] = useState(null)

  const add = (a) => {
    setCart((c) => {
      const ex = c.find((x) => x.id === a.id)
      if (ex) return c.map((x) => (x.id === a.id ? { ...x, qty: x.qty + 1 } : x))
      return [...c, { ...a, qty: 1 }]
    })
  }
  const remove = (id) => setCart((c) => c.filter((x) => x.id !== id))
  const dec = (id) => setCart((c) => c.map((x) => (x.id === id && x.qty > 1 ? { ...x, qty: x.qty - 1 } : x)).filter((x) => x.qty > 0))
  const total = cart.reduce((s, c) => s + c.prix * c.qty, 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Caisse (POS)</h1>
          <p className="page-sub">Point de vente · 6 articles en stock</p>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
            Catalogue
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {ARTICLES.map((a) => (
              <button
                key={a.id}
                onClick={() => add(a)}
                className="card hover-lift"
                style={{ padding: 14, textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{a.cat}</div>
                <div className="flex items-center justify-between mt-2">
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--copper-600)' }}>{a.prix.toLocaleString('fr-FR')} F</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Stock: {a.stock}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad-lg" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11 }}>
            Panier ({cart.length})
          </h3>

          <div className="card mb-3" style={{ padding: 10, background: 'var(--bg-2)' }}>
            <div className="flex items-center gap-2">
              <QrCode size={16} />
              <input className="input input-sm" placeholder="Scanner QR client pour créditer son compte" style={{ flex: 1 }} />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, minHeight: 200 }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
                <div style={{ fontSize: 13 }}>Panier vide</div>
              </div>
            ) : cart.map((c) => (
              <div key={c.id} className="flex items-center gap-2 mb-2" style={{ padding: 8, background: 'var(--bg-2)', borderRadius: 8 }}>
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ color: 'var(--text-3)' }}>{(c.prix * c.qty).toLocaleString('fr-FR')} F</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => dec(c.id)} className="btn btn-icon btn-sm btn-soft"><Minus size={12} /></button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{c.qty}</span>
                  <button onClick={() => add(c)} className="btn btn-icon btn-sm btn-soft"><Plus size={12} /></button>
                </div>
                <button onClick={() => remove(c.id)} className="btn btn-icon btn-sm btn-danger"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 14, color: 'var(--text-3)' }}>Total</span>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{total.toLocaleString('fr-FR')} F</span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', height: 46 }} disabled={cart.length === 0}>
              <CreditCard size={16} /> Encaisser
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .mt-2 { margin-top: 8px; } .mb-2 { margin-bottom: 8px; } .mb-3 { margin-bottom: 12px; }
        @media (max-width: 1024px) { .grid[style*="2fr 1fr"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
