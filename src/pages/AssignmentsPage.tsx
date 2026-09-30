import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { useApp } from '../context/AppContext';
import { importBundle } from '../db/exportImport';
import {
  ITEM_TYPE_LABELS,
  type Assignment,
  type ContentItem,
} from '../types';
import { formatDate, formatPercent } from '../utils/format';
import { uid } from '../utils/id';
import { canAssign, isStudent } from '../utils/roles';
import { shareAssignmentResults } from '../utils/shareAssignments';

export function AssignmentsPage() {
  const {
    currentUser,
    users,
    items,
    attempts,
    assignments,
    saveAssignment,
    deleteAssignment,
    refresh,
  } = useApp();

  const teacher = canAssign(currentUser);
  const student = isStudent(currentUser);
  const importRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const assignableItems = items;

  const students = useMemo(
    () => users.filter((u) => u.role === 'ogrenci'),
    [users],
  );

  const myAssignments = useMemo(() => {
    if (!currentUser) return [];
    if (teacher) {
      return assignments.filter((a) => a.assignedBy === currentUser.id);
    }
    return assignments.filter((a) => a.studentIds.includes(currentUser.id));
  }, [assignments, currentUser, teacher]);

  const studentDoneCount = useMemo(() => {
    if (!currentUser || !student) return 0;
    const ids = new Set(myAssignments.flatMap((a) => a.itemIds));
    return attempts.filter(
      (t) => t.userId === currentUser.id && ids.has(t.itemId),
    ).length;
  }, [attempts, currentUser, myAssignments, student]);

  function toggle(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function create() {
    if (!currentUser || !teacher) return;
    if (!title.trim()) {
      alert('Başlık gerekli');
      return;
    }
    if (selectedItems.length === 0) {
      alert('En az bir sınav / içerik seçin');
      return;
    }
    if (selectedStudents.length === 0) {
      alert('En az bir öğrenci seçin');
      return;
    }
    const a: Assignment = {
      id: uid(),
      title: title.trim(),
      note: note.trim(),
      itemIds: selectedItems,
      studentIds: selectedStudents,
      assignedBy: currentUser.id,
      dueAt: due ? new Date(due).getTime() : null,
      createdAt: Date.now(),
    };
    await saveAssignment(a);
    setOpen(false);
    setTitle('');
    setNote('');
    setDue('');
    setSelectedItems([]);
    setSelectedStudents([]);
  }

  function progressFor(a: Assignment, studentId: string) {
    const done = a.itemIds.filter((itemId) =>
      attempts.some((t) => t.itemId === itemId && t.userId === studentId),
    ).length;
    return { done, total: a.itemIds.length };
  }

  async function handleShareAll() {
    if (!currentUser || !student) return;
    setBusy(true);
    setMsg(null);
    try {
      const mode = await shareAssignmentResults(
        currentUser,
        myAssignments,
        items,
        attempts,
      );
      if (mode === 'shared') setMsg('Atama sonuçların paylaşıldı.');
      else if (mode === 'copied')
        setMsg('Özet panoya kopyalandı, JSON dosyası indirildi.');
      else setMsg('JSON dosyası indirildi — öğretmene gönder.');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        /* iptal */
      } else {
        setMsg(e instanceof Error ? e.message : 'Paylaşım başarısız');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleShareOne(a: Assignment) {
    if (!currentUser || !student) return;
    setBusy(true);
    setMsg(null);
    try {
      const mode = await shareAssignmentResults(
        currentUser,
        [a],
        items,
        attempts,
      );
      if (mode === 'shared') setMsg(`“${a.title}” sonuçları paylaşıldı.`);
      else if (mode === 'copied')
        setMsg('Özet panoya kopyalandı, JSON dosyası indirildi.');
      else setMsg('JSON dosyası indirildi — öğretmene gönder.');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        /* iptal */
      } else {
        setMsg(e instanceof Error ? e.message : 'Paylaşım başarısız');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await importBundle(file, 'merge');
      refresh();
      if (r.kind === 'atama-sonuclari') {
        setMsg(
          `${r.studentName} sonuçları alındı: ${r.attempts} deneme. Raporlar’da görebilirsin.`,
        );
      } else if (r.kind === 'sinav-sonucu') {
        setMsg(
          `${r.studentName ?? 'Öğrenci'} sınav sonucu alındı. Raporlar’da görebilirsin.`,
        );
      } else {
        setMsg(
          `İçe aktarıldı: ${r.attempts} sonuç, ${r.items} içerik, ${r.users} kullanıcı.`,
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'İçe aktarma başarısız');
    } finally {
      setBusy(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Ödev & sınav</p>
          <h1>{teacher ? 'Sınav atamaları' : 'Bana atananlar'}</h1>
          <p className="muted">
            {teacher
              ? 'Sınav ata; öğrencinin paylaştığı sonuç JSON’unu içe aktarıp gör.'
              : 'Atananları çöz; bitince tüm sonuçlarını öğretmene paylaş.'}
          </p>
        </div>
        <div className="hero-actions">
          {teacher && (
            <>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                }}
              />
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => importRef.current?.click()}
              >
                Sonuç içe aktar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setOpen(true)}
              >
                + Atama yap
              </button>
            </>
          )}
          {student && (
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || studentDoneCount === 0}
              onClick={() => void handleShareAll()}
            >
              Tüm sonuçları paylaş
            </button>
          )}
        </div>
      </header>

      {msg && <p className="notice">{msg}</p>}

      {myAssignments.length === 0 && (
        <p className="muted">Henüz atama yok.</p>
      )}

      <div className="item-grid">
        {myAssignments.map((a) => {
          const teacherUser = users.find((u) => u.id === a.assignedBy);
          const assignedItems = a.itemIds
            .map((id) => items.find((i) => i.id === id))
            .filter(Boolean) as ContentItem[];
          const mineDone = currentUser
            ? a.itemIds.filter((id) =>
                attempts.some(
                  (t) => t.itemId === id && t.userId === currentUser.id,
                ),
              ).length
            : 0;

          return (
            <article key={a.id} className="item-card">
              <div className="item-card__meta">
                <span className="tag">Atama</span>
                {a.dueAt && (
                  <span className="tag tag--soft">
                    Son: {formatDate(a.dueAt)}
                  </span>
                )}
              </div>
              <h3>{a.title}</h3>
              {a.note && <p className="muted tiny">{a.note}</p>}
              <p className="tiny muted">
                {teacher
                  ? `${a.studentIds.length} öğrenci · ${a.itemIds.length} içerik`
                  : `Öğretmen: ${teacherUser?.name ?? '—'} · ${mineDone}/${a.itemIds.length} tamam`}
              </p>

              <ul className="plain-list">
                {assignedItems.map((it) => {
                  const mine = currentUser
                    ? attempts.find(
                        (t) =>
                          t.itemId === it.id && t.userId === currentUser.id,
                      )
                    : undefined;
                  const href =
                    it.type === 'kartlar'
                      ? `/kartlar/${it.id}`
                      : `/coz/${it.id}`;
                  return (
                    <li key={it.id}>
                      <Link to={href}>
                        {it.title} ({ITEM_TYPE_LABELS[it.type]})
                      </Link>
                      {mine && (
                        <span className="tiny muted">
                          {' '}
                          — {formatPercent(mine.percent)}
                        </span>
                      )}
                      {!mine && student && (
                        <span className="tiny muted"> — bekliyor</span>
                      )}
                    </li>
                  );
                })}
              </ul>

              {teacher && (
                <div className="tiny muted" style={{ marginTop: '0.5rem' }}>
                  {a.studentIds.map((sid) => {
                    const s = users.find((u) => u.id === sid);
                    const p = progressFor(a, sid);
                    return (
                      <div key={sid}>
                        {s?.name ?? '?'}: {p.done}/{p.total} tamamlandı
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="item-card__actions">
                {student && assignedItems[0] && (
                  <Link
                    className="btn btn--small btn--primary"
                    to={
                      assignedItems[0].type === 'kartlar'
                        ? `/kartlar/${assignedItems[0].id}`
                        : `/coz/${assignedItems[0].id}`
                    }
                  >
                    Başla
                  </Link>
                )}
                {student && mineDone > 0 && (
                  <button
                    type="button"
                    className="btn btn--small btn--ghost"
                    disabled={busy}
                    onClick={() => void handleShareOne(a)}
                  >
                    Sonuçları paylaş
                  </button>
                )}
                {teacher && (
                  <Link className="btn btn--small btn--ghost" to="/raporlar">
                    Raporlar
                  </Link>
                )}
                {teacher && (
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    onClick={async () => {
                      if (!confirm('Atama silinsin mi?')) return;
                      await deleteAssignment(a.id);
                    }}
                  >
                    Sil
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={open}
        title="Yeni atama"
        onClose={() => setOpen(false)}
        wide
        footer={
          <>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setOpen(false)}
            >
              İptal
            </button>
            <button type="button" className="btn btn--primary" onClick={create}>
              Ata
            </button>
          </>
        }
      >
        <label className="field">
          <span>Başlık</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. 5. Sınıf Haftalık Sınav"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Not (isteğe bağlı)</span>
          <textarea
            className="input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Son tarih (isteğe bağlı)</span>
          <input
            className="input"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>

        <div className="field">
          <span>
            İçerikler{' '}
            <span className="tiny muted">
              ({selectedItems.length} seçili)
            </span>
          </span>
          <div className="check-list">
            {assignableItems.map((it) => (
              <label key={it.id} className="choice choice--compact">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(it.id)}
                  onChange={() =>
                    toggle(selectedItems, it.id, setSelectedItems)
                  }
                />
                <span>
                  {it.title}{' '}
                  <span className="tiny muted">
                    ({ITEM_TYPE_LABELS[it.type]})
                  </span>
                </span>
              </label>
            ))}
            {assignableItems.length === 0 && (
              <p className="muted tiny">Önce içerik oluşturun.</p>
            )}
          </div>
        </div>

        <div className="field">
          <span>
            Öğrenciler{' '}
            <span className="tiny muted">
              ({selectedStudents.length} seçili)
            </span>
          </span>
          <div className="check-list">
            {students.map((s) => (
              <label key={s.id} className="choice choice--compact">
                <input
                  type="checkbox"
                  checked={selectedStudents.includes(s.id)}
                  onChange={() =>
                    toggle(selectedStudents, s.id, setSelectedStudents)
                  }
                />
                <span>{s.name}</span>
              </label>
            ))}
            {students.length === 0 && (
              <p className="muted tiny">
                Kullanıcılar’dan öğrenci rolünde profil ekleyin.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
