// Screens.jsx — Login, Dashboard, Residences (list + detail), Maintenance, Voyages
function LoginScreen({ onLogin }) {
  const [user, setUser] = React.useState('admin');
  const [pw, setPw] = React.useState('••••••');
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
                  display: 'grid', placeItems: 'center', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '36px 36px 28px',
                    width: 380, boxShadow: '0 20px 60px rgba(15,23,42,.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="../../assets/roxgold-logo.png" style={{ height: 58, display: 'block', margin: '0 auto' }} />
          <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'ui-monospace, monospace',
                        letterSpacing: 2, color: '#64748b', textTransform: 'uppercase' }}>
            Camp ERP · Connexion
          </div>
        </div>
        <label style={{ display: 'block', fontSize: 11, color: '#64748b',
                        fontWeight: 600, marginBottom: 6, textTransform: 'uppercase',
                        letterSpacing: .5 }}>Identifiant</label>
        <input value={user} onChange={e => setUser(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                   borderRadius: 9, fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ display: 'block', fontSize: 11, color: '#64748b',
                        fontWeight: 600, marginBottom: 6, textTransform: 'uppercase',
                        letterSpacing: .5 }}>Mot de passe</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
                   borderRadius: 9, fontSize: 13, marginBottom: 18, boxSizing: 'border-box' }} />
        <button onClick={onLogin}
          style={{ width: '100%', background: '#1e3a8a', color: '#fff', border: 0,
                   padding: '12px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                   cursor: 'pointer', letterSpacing: .5 }}>
          Se connecter →
        </button>
        <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 14 }}>
          Résidence Roxgold Sango · v2.4.1
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }) {
  return (
    <div style={{ padding: 16, animation: 'fadeIn .3s ease' }}>
      <HeroBanner subtitle="Résidence Roxgold Sango"
        title="vendredi 15 mars 2024" statValue="134" statLabel="Bâtiments" />
      <div style={{ height: 14 }} />
      <AlertBanner tone="red" onClick={() => onNavigate('residences')}>
        ⚠️ 3 départ(s) prévu(s) dans les 7 prochains jours
      </AlertBanner>
      <div style={{ height: 8 }} />
      <AlertBanner tone="orange">
        🔔 Nouvelle demande de maintenance — Bât. B-12
      </AlertBanner>
      <div style={{ height: 18 }} />

      <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
                    gap: 10, marginBottom: 18 }}>
        <KpiCard value="42"  label="🟢 Libres"     color="#16a34a" onClick={() => onNavigate('residences')} />
        <KpiCard value="87"  label="🔴 Occupés"    color="#dc2626" onClick={() => onNavigate('residences')} />
        <KpiCard value="67%" label="📊 Taux occup." color="#dc2626" sub="⚠️ Haute" />
        <KpiCard value="3"   label="📅 Départs S-1" color="#ea580c" onClick={() => onNavigate('residences')} />
        <KpiCard value="5"   label="🚨 Incidents"   color="#dc2626" onClick={() => onNavigate('maintenance')} />
        <KpiCard value="8"   label="✈️ En voyage"   color="#ea580c" onClick={() => onNavigate('voyages')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <ProgressCard title="📊 Statuts résidences" rows={[
          { label: 'Libres',      value: 42, pct: 31, color: '#16a34a' },
          { label: 'Occupés',     value: 87, pct: 65, color: '#dc2626' },
          { label: 'Réservés',    value: 2,  pct: 1,  color: '#2563eb' },
          { label: 'Maintenance', value: 3,  pct: 2,  color: '#ea580c' },
        ]} />
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                      padding: 16, boxShadow: '0 2px 8px rgba(15,23,42,.06)' }}>
          <div style={{ fontWeight: 700, color: '#1e3a8a', marginBottom: 14, fontSize: 13 }}>
            ⚡ Actions rapides
          </div>
          <ActionButton icon="🏠" label="Gérer les résidences"   color="#1e3a8a" onClick={() => onNavigate('residences')} />
          <ActionButton icon="🗺️" label="Carte GIS"               color="#2563eb" />
          <ActionButton icon="👤" label="Déclarer du personnel"   color="#16a34a" />
          <ActionButton icon="📅" label="Créer un événement"      color="#7c3aed" />
          <ActionButton icon="🛠️" label="Voir les incidents"      color="#ea580c" onClick={() => onNavigate('maintenance')} />
          <ActionButton icon="📝" label="Demandes en attente"     color="#f0a500" />
        </div>
      </div>
    </div>
  );
}

function Residences({ onSelect }) {
  const rows = [
    { code: 'B-12 / A2', occupant: 'Ouedraogo, K.', statut: 'Occupé',      depart: '22/03/2024' },
    { code: 'B-12 / A3', occupant: '—',              statut: 'Libre',       depart: '—' },
    { code: 'B-14 / B1', occupant: 'Sawadogo, M.',   statut: 'Occupé',      depart: '18/03/2024' },
    { code: 'B-14 / B2', occupant: 'Coulibaly, A.',  statut: 'En voyage',   depart: '—' },
    { code: 'B-14 / B3', occupant: '—',              statut: 'Maintenance', depart: '—' },
    { code: 'B-21 / C1', occupant: 'Diallo, F.',     statut: 'Occupé',      depart: '12/04/2024' },
    { code: 'B-21 / C2', occupant: 'Traoré, B.',     statut: 'Réservé',     depart: '01/04/2024' },
    { code: 'B-21 / C3', occupant: '—',              statut: 'Libre',       depart: '—' },
  ];
  return (
    <div style={{ padding: 16, animation: 'fadeIn .3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'ui-monospace, monospace',
                        letterSpacing: 2, textTransform: 'uppercase' }}>Opérations</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>Résidences</div>
        </div>
        <button style={{ background: '#1e3a8a', color: '#fff', border: 0,
                         padding: '10px 16px', borderRadius: 9, fontSize: 12,
                         fontWeight: 700, cursor: 'pointer' }}>
          + Nouvelle assignation
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {['Tous', 'Libres', 'Occupés', 'Maintenance', 'Réservés'].map((f, i) => (
          <button key={f}
            style={{ background: i === 0 ? '#1e3a8a' : 'rgba(30,58,138,.06)',
                     color: i === 0 ? '#fff' : '#1e3a8a',
                     border: i === 0 ? '0' : '1px solid rgba(30,58,138,.15)',
                     padding: '7px 12px', borderRadius: 9,
                     fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {f}
          </button>
        ))}
        <input placeholder="🔍 Rechercher un bâtiment, occupant…"
          style={{ flex: 1, minWidth: 220, padding: '7px 12px',
                   border: '1px solid #e5e7eb', borderRadius: 9, fontSize: 12 }} />
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                    overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,.06)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 110px 32px',
                      padding: '10px 16px', background: '#f5f7fb',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: 10, fontFamily: 'ui-monospace, monospace',
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.5,
                      fontWeight: 700 }}>
          <div>Bâtiment</div><div>Occupant</div><div>Statut</div><div>Départ</div><div></div>
        </div>
        {rows.map((r, i) => (
          <div key={i} onClick={() => onSelect && onSelect(r)}
            style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 110px 32px',
                     padding: '12px 16px',
                     borderBottom: i === rows.length - 1 ? 0 : '1px solid #e5e7eb',
                     fontSize: 13, alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700,
                          color: '#1e3a8a' }}>{r.code}</div>
            <div style={{ color: r.occupant === '—' ? '#94a3b8' : '#0f172a' }}>{r.occupant}</div>
            <div><StatusPill status={r.statut} /></div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11,
                          color: r.depart === '—' ? '#94a3b8' : '#0f172a' }}>{r.depart}</div>
            <div style={{ textAlign: 'right', color: '#94a3b8' }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Maintenance() {
  const incidents = [
    { id: 'INC-2041', title: 'Climatisation hors service',  bat: 'B-12 / A2', tone: 'red',    statut: 'Ouvert',     time: 'il y a 2 h' },
    { id: 'INC-2040', title: 'Fuite robinet salle de bain', bat: 'B-14 / B1', tone: 'orange', statut: 'En cours',   time: 'il y a 6 h' },
    { id: 'INC-2039', title: 'Ampoule à remplacer',         bat: 'B-21 / C1', tone: 'green',  statut: 'Résolu',     time: 'hier' },
  ];
  return (
    <div style={{ padding: 16, animation: 'fadeIn .3s ease' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'ui-monospace, monospace',
                      letterSpacing: 2, textTransform: 'uppercase' }}>Activité</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>Maintenance</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
                    gap: 10, marginBottom: 14 }}>
        <KpiCard value="2"  label="🚨 Ouverts"   color="#dc2626" />
        <KpiCard value="1"  label="🛠️ En cours"  color="#ea580c" />
        <KpiCard value="14" label="✓ Résolus 30j" color="#16a34a" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {incidents.map(i => (
          <div key={i.id}
            style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                     padding: '12px 16px', boxShadow: '0 2px 8px rgba(15,23,42,.06)',
                     display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11,
                          color: '#64748b', width: 90 }}>{i.id}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{i.title}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {i.bat} · {i.time}
              </div>
            </div>
            <StatusPill status={i.tone === 'red' ? 'Occupé' : i.tone === 'orange' ? 'Maintenance' : 'Libre'} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Voyages() {
  const trips = [
    { who: 'Coulibaly, A.', from: 'Ouagadougou', to: 'Sango', dep: '12/03', ret: '20/03', tone: 'En voyage' },
    { who: 'Diallo, F.',    from: 'Sango',       to: 'Bobo-Dioulasso', dep: '14/03', ret: '17/03', tone: 'En voyage' },
    { who: 'Traoré, B.',    from: 'Sango',       to: 'Ouagadougou',    dep: '20/03', ret: '24/03', tone: 'Réservé' },
  ];
  return (
    <div style={{ padding: 16, animation: 'fadeIn .3s ease' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'ui-monospace, monospace',
                      letterSpacing: 2, textTransform: 'uppercase' }}>Activité</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>Voyages</div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(15,23,42,.06)', overflow: 'hidden' }}>
        {trips.map((t, i) => (
          <div key={i} style={{ display: 'grid',
                                gridTemplateColumns: '1fr 220px 160px 120px',
                                padding: '14px 16px', alignItems: 'center',
                                borderBottom: i === trips.length - 1 ? 0 : '1px solid #e5e7eb',
                                fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{t.who}</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#64748b' }}>
              {t.from} → {t.to}
            </div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: '#0f172a' }}>
              {t.dep} – {t.ret}
            </div>
            <div><StatusPill status={t.tone} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, Dashboard, Residences, Maintenance, Voyages });
