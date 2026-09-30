import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ROLE_LABELS } from '../types';
import {
  canAssign,
  canManageContent,
  canManageSystem,
  isReadOnlyRole,
} from '../utils/roles';

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

  const studentLike = isReadOnlyRole(currentUser);
  const nav = [
    { to: '/', label: 'Ana Sayfa', end: true, show: true },
    { to: '/atamalar', label: studentLike ? 'Atananlar' : 'Atamalar', end: false, show: true },
    { to: '/klasorler', label: 'Klasörler', end: false, show: true },
    { to: '/raporlar', label: 'Raporlar', end: false, show: true },
    {
      to: '/kullanicilar',
      label: 'Kullanıcılar',
      end: false,
      show: canManageSystem(currentUser),
    },
    {
      to: '/ayarlar',
      label: 'Ayarlar',
      end: false,
      show: canManageSystem(currentUser) || canAssign(currentUser),
    },
  ].filter((n) => n.show);

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
            <small>
              {currentUser
                ? ROLE_LABELS[currentUser.role]
                : 'Öğren · Ölç · Paylaş'}
            </small>
          </span>
        </button>

        <nav className="nav">
          {nav.map((n) => (
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

        {!canManageContent(currentUser) && (
          <p className="tiny pad" style={{ opacity: 0.75 }}>
            Öğrenci / veli: içerik ekleme ve silme kapalı.
          </p>
        )}

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
