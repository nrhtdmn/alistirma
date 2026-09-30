import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { exportAttempts } from '../db/exportImport';
import { ROLE_LABELS, SUBJECT_LABELS, type SubjectKey } from '../types';
import { formatDate, formatDuration, formatPercent } from '../utils/format';
import { shareExamResult } from '../utils/shareExam';

export function ReportsPage() {
  const { attempts, items, users, currentUser, deleteAttempt } = useApp();
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterItem, setFilterItem] = useState<string>('all');
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return attempts.filter((a) => {
      if (filterUser !== 'all' && a.userId !== filterUser) return false;
      if (filterItem !== 'all' && a.itemId !== filterItem) return false;
      return true;
    });
  }, [attempts, filterUser, filterItem]);

  const summary = useMemo(() => {
    if (filtered.length === 0) {
      return { count: 0, avg: 0, best: 0, totalTime: 0 };
    }
    const avg =
      filtered.reduce((s, a) => s + a.percent, 0) / filtered.length;
    const best = Math.max(...filtered.map((a) => a.percent));
    const totalTime = filtered.reduce((s, a) => s + a.durationSeconds, 0);
    return { count: filtered.length, avg, best, totalTime };
  }, [filtered]);

  const bySubject = useMemo(() => {
    const map = new Map<string, { n: number; sum: number }>();
    for (const a of filtered) {
      const item = items.find((i) => i.id === a.itemId);
      const key = item?.subject ?? 'diger';
      const cur = map.get(key) ?? { n: 0, sum: 0 };
      cur.n += 1;
      cur.sum += a.percent;
      map.set(key, cur);
    }
    return [...map.entries()].map(([subject, v]) => ({
      subject,
      avg: v.sum / v.n,
      n: v.n,
    }));
  }, [filtered, items]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Raporlama</p>
          <h1>Sonuçlar</h1>
          <p className="muted">
            Tüm denemeler cihazda saklanır. Dışa aktarıp paylaşabilirsin.
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={filtered.length === 0}
            onClick={() => exportAttempts(filtered.map((a) => a.id))}
          >
            Dışa aktar
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setFilterUser(currentUser?.id ?? 'all');
              setFilterItem('all');
            }}
          >
            Benim sonuçlarım
          </button>
        </div>
      </header>

      {shareMsg && <p className="notice">{shareMsg}</p>}

      <section className="filters panel">
        <label className="field">
          <span>Kullanıcı</span>
          <select
            className="input"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="all">Herkes</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_LABELS[u.role]})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>İçerik</span>
          <select
            className="input"
            value={filterItem}
            onChange={(e) => setFilterItem(e.target.value)}
          >
            <option value="all">Tümü</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="stat-grid">
        <div className="stat">
          <span className="stat__n">{summary.count}</span>
          <span className="stat__l">Deneme</span>
        </div>
        <div className="stat">
          <span className="stat__n">{formatPercent(summary.avg)}</span>
          <span className="stat__l">Ortalama</span>
        </div>
        <div className="stat">
          <span className="stat__n">{formatPercent(summary.best)}</span>
          <span className="stat__l">En iyi</span>
        </div>
        <div className="stat">
          <span className="stat__n">{formatDuration(summary.totalTime)}</span>
          <span className="stat__l">Toplam süre</span>
        </div>
      </section>

      {bySubject.length > 0 && (
        <section className="section">
          <h2>Derse göre</h2>
          <div className="bar-list">
            {bySubject.map((s) => (
              <div key={s.subject} className="bar-row">
                <span className="bar-label">
                  {SUBJECT_LABELS[s.subject as SubjectKey] ?? s.subject}
                </span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.min(100, s.avg)}%` }}
                  />
                </div>
                <span className="bar-val">
                  {formatPercent(s.avg)} · {s.n}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Detaylı liste</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Kullanıcı</th>
                <th>İçerik</th>
                <th>Puan</th>
                <th>Süre</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const user = users.find((u) => u.id === a.userId);
                const item = items.find((i) => i.id === a.itemId);
                return (
                  <tr key={a.id}>
                    <td>{formatDate(a.completedAt)}</td>
                    <td>{user?.name ?? '—'}</td>
                    <td>
                      {item ? (
                        <Link to={`/coz/${item.id}`}>{item.title}</Link>
                      ) : (
                        'Silinmiş'
                      )}
                    </td>
                    <td>
                      {a.score}/{a.maxScore} ({formatPercent(a.percent)})
                    </td>
                    <td>{formatDuration(a.durationSeconds)}</td>
                    <td>
                      <div className="hero-actions">
                        {item && (
                          <button
                            type="button"
                            className="btn btn--small btn--primary"
                            onClick={async () => {
                              try {
                                const mode = await shareExamResult(
                                  item,
                                  a,
                                  user ?? null,
                                );
                                setShareMsg(
                                  mode === 'shared'
                                    ? 'Paylaşıldı.'
                                    : mode === 'copied'
                                      ? 'Panoya kopyalandı + dosya indirildi.'
                                      : 'JSON indirildi.',
                                );
                              } catch (e) {
                                if (
                                  e instanceof Error &&
                                  e.name === 'AbortError'
                                )
                                  return;
                                setShareMsg('Paylaşım başarısız.');
                              }
                            }}
                          >
                            Paylaş
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn--small btn--danger"
                          onClick={async () => {
                            if (!confirm('Bu sonuç silinsin mi?')) return;
                            await deleteAttempt(a.id);
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
