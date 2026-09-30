import { useState } from 'react';
import { Modal } from '../components/Modal';
import { useApp } from '../context/AppContext';
import {
  ROLE_LABELS,
  USER_COLORS,
  type User,
  type UserRole,
} from '../types';
import { formatDate } from '../utils/format';

export function UsersPage() {
  const {
    users,
    currentUser,
    setCurrentUserId,
    addUser,
    updateUser,
    deleteUser,
  } = useApp();

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('ogrenci');
  const [color, setColor] = useState(USER_COLORS[0]);

  function openCreate() {
    setEdit(null);
    setName('');
    setRole('ogrenci');
    setColor(USER_COLORS[users.length % USER_COLORS.length]);
    setOpen(true);
  }

  function openEdit(u: User) {
    setEdit(u);
    setName(u.name);
    setRole(u.role);
    setColor(u.color);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) return;
    if (edit) {
      await updateUser({ ...edit, name: name.trim(), role, color });
    } else {
      const id = await addUser({ name: name.trim(), role, color });
      await setCurrentUserId(id);
    }
    setOpen(false);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Profiller</p>
          <h1>Kullanıcılar</h1>
          <p className="muted">
            Öğretmen, öğrenci veya veli — tek tıkla geçiş yap. Herkes aynı
            cihazda kendi sonuçlarını tutar.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          + Kullanıcı
        </button>
      </header>

      <div className="user-grid">
        {users.map((u) => (
          <article
            key={u.id}
            className={`user-card ${currentUser?.id === u.id ? 'is-active' : ''}`}
          >
            <span className="avatar lg" style={{ background: u.color }}>
              {u.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h3>{u.name}</h3>
              <p className="muted tiny">
                {ROLE_LABELS[u.role]} · {formatDate(u.createdAt)}
              </p>
            </div>
            <div className="item-card__actions">
              {currentUser?.id !== u.id && (
                <button
                  type="button"
                  className="btn btn--small btn--primary"
                  onClick={() => setCurrentUserId(u.id)}
                >
                  Seç
                </button>
              )}
              <button
                type="button"
                className="btn btn--small btn--ghost"
                onClick={() => openEdit(u)}
              >
                Düzenle
              </button>
              <button
                type="button"
                className="btn btn--small btn--danger"
                onClick={async () => {
                  if (!confirm(`"${u.name}" silinsin mi?`)) return;
                  try {
                    await deleteUser(u.id);
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Silinemedi');
                  }
                }}
              >
                Sil
              </button>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={open}
        title={edit ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı'}
        onClose={() => setOpen(false)}
      >
        <label className="field">
          <span>Ad</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Rol</span>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Renk</span>
          <div className="color-row">
            {USER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`swatch ${color === c ? 'is-active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setOpen(false)}
          >
            İptal
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Kaydet
          </button>
        </div>
      </Modal>
    </div>
  );
}
