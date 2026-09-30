import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ROLE_LABELS } from '../types';

const NAV = [
  { to: '/', label: 'Ana Sayfa', end: true },
  { to: '/klasorler', label: 'Klasörler' },
  { to: '/raporlar', label: 'Raporlar' },
  { to: '/kullanicilar', label: 'Kullanıcılar' },
  { to: '/ayarlar', label: 'Ayarlar' },
];

export function Layout() {
  const { ready, currentUser, users, setCurrentUserId } = useApp();
  const navigate = useNavigate();

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot__mark">Alıştırma</div>
        <p>Yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <button
          type="button"
          className="brand"
          onClick={() => navigate('/')}
        >
          <span className="brand__mark">A</span>
          <span className="brand__text">
            <strong>Alıştırma</strong>
            <small>Öğren · Ölç · Paylaş</small>
          </span>
        </button>

        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `nav__link ${isActive ? 'is-active' : ''}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__user">
          <label className="field-label" htmlFor="user-switch">
            Aktif kullanıcı
          </label>
          <select
            id="user-switch"
            className="input"
            value={currentUser?.id ?? ''}
            onChange={(e) => setCurrentUserId(e.target.value)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_LABELS[u.role]})
              </option>
            ))}
          </select>
          {currentUser && (
            <div className="user-pill">
              <span
                className="avatar"
                style={{ background: currentUser.color }}
              >
                {currentUser.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{currentUser.name}</strong>
                <small>{ROLE_LABELS[currentUser.role]}</small>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
