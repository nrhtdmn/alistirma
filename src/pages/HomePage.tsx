import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ITEM_TYPE_LABELS,
  SUBJECT_LABELS,
  type ContentItem,
} from '../types';
import { formatDate, formatPercent } from '../utils/format';

export function HomePage() {
  const { currentUser, items, folders, attempts, users } = useApp();

  const myAttempts = useMemo(
    () =>
      currentUser
        ? attempts.filter((a) => a.userId === currentUser.id).slice(0, 5)
        : [],
    [attempts, currentUser],
  );

  const recent = items.slice(0, 6);

  const stats = useMemo(() => {
    const att = currentUser
      ? attempts.filter((a) => a.userId === currentUser.id)
      : [];
    const avg =
      att.length > 0
        ? att.reduce((s, a) => s + a.percent, 0) / att.length
        : 0;
    return {
      folders: folders.length,
      items: items.length,
      attempts: att.length,
      avg,
      users: users.length,
    };
  }, [folders, items, attempts, users, currentUser]);

  return (
    <div className="page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Hoş geldin{currentUser ? `, ${currentUser.name}` : ''}</p>
          <h1>Alıştırma</h1>
          <p className="lede">
            1. sınıftan doktoraya — her ders için alıştırma, test ve sınav oluştur,
            çöz, sonuçları sakla ve paylaş. Her şey cihazında kalır.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="btn btn--primary" to="/duzenle/yeni">
            Yeni içerik
          </Link>
          <Link className="btn btn--ghost" to="/duzenle/yeni?type=kartlar">
            Kelime kartları
          </Link>
          <Link className="btn btn--ghost" to="/klasorler">
            Klasörlere git
          </Link>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat">
          <span className="stat__n">{stats.items}</span>
          <span className="stat__l">İçerik</span>
        </div>
        <div className="stat">
          <span className="stat__n">{stats.folders}</span>
          <span className="stat__l">Klasör</span>
        </div>
        <div className="stat">
          <span className="stat__n">{stats.attempts}</span>
          <span className="stat__l">Çözümün</span>
        </div>
        <div className="stat">
          <span className="stat__n">{formatPercent(stats.avg)}</span>
          <span className="stat__l">Ort. başarı</span>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Son içerikler</h2>
          <Link to="/klasorler">Tümü</Link>
        </div>
        <div className="item-grid">
          {recent.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
          {recent.length === 0 && (
            <p className="muted">Henüz içerik yok. İlk alıştırmanı oluştur.</p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Son sonuçların</h2>
          <Link to="/raporlar">Raporlar</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>İçerik</th>
                <th>Puan</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {myAttempts.map((a) => {
                const item = items.find((i) => i.id === a.itemId);
                return (
                  <tr key={a.id}>
                    <td>{item?.title ?? 'Silinmiş içerik'}</td>
                    <td>
                      {a.score}/{a.maxScore} ({formatPercent(a.percent)})
                    </td>
                    <td>{formatDate(a.completedAt)}</td>
                  </tr>
                );
              })}
              {myAttempts.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Henüz sonuç yok.
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

function ItemCard({ item }: { item: ContentItem }) {
  const isCards = item.type === 'kartlar';
  const count = isCards ? (item.cards?.length ?? 0) : item.questions.length;
  return (
    <article className="item-card">
      <div className="item-card__meta">
        <span className="tag">{ITEM_TYPE_LABELS[item.type]}</span>
        <span className="tag tag--soft">{SUBJECT_LABELS[item.subject]}</span>
      </div>
      <h3>{item.title}</h3>
      <p className="muted tiny">
        {item.gradeLevel} · {count} {isCards ? 'kart' : 'soru'}
      </p>
      <div className="item-card__actions">
        <Link
          className="btn btn--small btn--primary"
          to={isCards ? `/kartlar/${item.id}` : `/coz/${item.id}`}
        >
          {isCards ? 'Çalış' : 'Çöz'}
        </Link>
        <Link className="btn btn--small btn--ghost" to={`/duzenle/${item.id}`}>
          Düzenle
        </Link>
      </div>
    </article>
  );
}
