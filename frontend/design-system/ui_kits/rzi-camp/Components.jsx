// Components.jsx — KpiCard, HeroBanner, AlertBanner, StatusPill, ProgressCard, ActionButton
function KpiCard({ value, label, color = '#1e3a8a', sub, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderTop: `4px solid ${color}`, borderRadius: 12,
        padding: '16px 18px', boxShadow: '0 2px 8px rgba(15,23,42,.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .3s, box-shadow .3s',
      }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-1px)';
                                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(15,23,42,.10)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none';
                           e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,.06)'; }}>
      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 26,
                    fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 5,
                    textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 2, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function HeroBanner({ subtitle, title, statValue, statLabel }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
      borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center',
      gap: 14, boxShadow: '0 4px 20px rgba(30,58,138,.25)', color: '#fff',
    }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '6px 10px', flexShrink: 0 }}>
        <img src="../../assets/roxgold-logo.png" style={{ height: 38, display: 'block' }} alt="" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)',
                      fontFamily: 'ui-monospace, monospace', letterSpacing: 2,
                      textTransform: 'uppercase', marginBottom: 3 }}>{subtitle}</div>
        <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>{title}</div>
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 38,
                      fontWeight: 700, color: '#f0a500', lineHeight: 1 }}>{statValue}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)',
                      textTransform: 'uppercase', letterSpacing: 1 }}>{statLabel}</div>
      </div>
    </div>
  );
}

function AlertBanner({ tone = 'red', children, onClick }) {
  const colors = {
    red:    { bg: 'rgba(220,38,38,.06)', bd: 'rgba(220,38,38,.2)',  fg: '#dc2626' },
    orange: { bg: 'rgba(234,88,12,.06)', bd: 'rgba(234,88,12,.2)',  fg: '#ea580c' },
    green:  { bg: 'rgba(22,163,74,.06)', bd: 'rgba(22,163,74,.25)', fg: '#16a34a' },
    blue:   { bg: 'rgba(30,58,138,.06)', bd: 'rgba(30,58,138,.2)',  fg: '#1e3a8a' },
  };
  const c = colors[tone];
  return (
    <div onClick={onClick}
      style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 12,
               padding: '10px 16px', display: 'flex', justifyContent: 'space-between',
               alignItems: 'center', cursor: onClick ? 'pointer' : 'default',
               color: c.fg, fontWeight: 700, fontSize: 13 }}>
      <span>{children}</span>
      {onClick && <span>→</span>}
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    'Libre':       { bg: 'rgba(22,163,74,.1)',  fg: '#16a34a' },
    'Occupé':      { bg: 'rgba(220,38,38,.1)',  fg: '#dc2626' },
    'Réservé':     { bg: 'rgba(37,99,235,.1)',  fg: '#2563eb' },
    'Maintenance': { bg: 'rgba(234,88,12,.1)',  fg: '#ea580c' },
    'En voyage':   { bg: 'rgba(234,88,12,.1)',  fg: '#ea580c' },
  };
  const c = map[status] || map['Libre'];
  return (
    <span style={{ background: c.bg, color: c.fg, borderRadius: 999,
                   padding: '4px 10px', fontSize: 11, fontWeight: 600,
                   display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.fg }}></span>
      {status}
    </span>
  );
}

function ActionButton({ icon, label, color = '#1e3a8a', onClick }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', background: `${color}0d`, color,
               border: `1px solid ${color}25`, padding: '9px 14px',
               borderRadius: 9, fontSize: 12, fontWeight: 600,
               textAlign: 'left', display: 'block', marginBottom: 6,
               cursor: 'pointer', fontFamily: 'inherit' }}>
      {icon} {label} →
    </button>
  );
}

function ProgressCard({ title, rows }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: 16, boxShadow: '0 2px 8px rgba(15,23,42,.06)' }}>
      <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 14, fontSize: 13 }}>{title}</div>
      {rows.map(r => (
        <div key={r.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{r.label}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', color: r.color, fontWeight: 700 }}>
              {r.value} <span style={{ color: '#64748b', fontWeight: 400 }}>{r.pct}%</span>
            </span>
          </div>
          <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: r.color, borderRadius: 6,
                          width: `${r.pct}%`, transition: 'width 1s ease' }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { KpiCard, HeroBanner, AlertBanner, StatusPill, ActionButton, ProgressCard });
