import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  CARD_KIND_LABELS,
  ITEM_TYPE_LABELS,
  SUBJECT_LABELS,
  type ContentItem,
} from '../types';
import { formatDate, formatPercent } from '../utils/format';
import { canManageContent, isStudent } from '../utils/roles';

export function HomePage() {
  const { currentUser, items, folders, attempts, users, assignments } =
    useApp();
  const canEdit = canManageContent(currentUser);
  const student = isStudent(currentUser);

  const myAttempts = useMemo(
    () =>
      currentUser
        ? attempts.filter((a) => a.userId === currentUser.id).slice(0, 5)
        : [],
    [attempts, currentUser],
  );

  const myAssignments = useMemo(() => {
    if (!currentUser) return [];
    return assignments
      .filter((a) => a.studentIds.includes(currentUser.id))
      .slice(0, 5);
  }, [assignments, currentUser]);

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
      assigned: myAssignments.length,
    };
  }, [folders, items, attempts, users, currentUser, myAssignments]);

  return (
    <div className="page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">
            Hoş geldin{currentUser ? `, ${currentUser.name}` : ''}
          </p>
          <h1>Alıştırma</h1>
          <p className="lede">
            {student
              ? 'Atanan sınavlarını çöz, kart çalış, sonuçlarını paylaş.'
              : 'Alıştırma, test, sınav ve kart oluştur; öğrencilere ata; sonuçları izle.'}
          </p>
        </div>
        <div className="hero-actions">
          {canEdit ? (
            <>
              <Link className="btn btn--primary" to="/duzenle/yeni">
                Yeni içerik
              </Link>
              <Link
                className="btn btn--ghost"
                to="/duzenle/yeni?type=kartlar"
              >
                Kartlar
              </Link>
              <Link className="btn btn--ghost" to="/atamalar">
                Atama yap
              </Link>
            </>
          ) : (
            <Link className="btn btn--primary" to="/atamalar">
              Atananlarım
            </Link>
          )}
          <Link className="btn btn--ghost" to="/klasorler">
            Klasörler
          </Link>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat">
          <span className="stat__n">{stats.assigned}</span>
          <span className="stat__l">Atama</span>
        </div>
        <div className="stat">
          <span className="stat__n">{stats.items}</span>
          <span className="stat__l">İçerik</span>
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

      {student && myAssignments.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2>Sana atananlar</h2>
            <Link to="/atamalar">Tümü</Link>
          </div>
          <div className="item-grid">
            {myAssignments.map((a) => (
              <article key={a.id} className="item-card">
                <span className="tag">Atama</span>
                <h3>{a.title}</h3>
                <p className="muted tiny">{a.itemIds.length} içerik</p>
                <Link className="btn btn--small btn--primary" to="/atamalar">
                  Görüntüle
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__head">
          <h2>Son içerikler</h2>
          <Link to="/klasorler">Tümü</Link>
        </div>
        <div className="item-grid">
          {recent.map((item) => (
            <ItemCard key={item.id} item={item} canEdit={canEdit} />
          ))}
          {recent.length === 0 && (
            <p className="muted">Henüz içerik yok.</p>
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

function ItemCard({
  item,
  canEdit,
}: {
  item: ContentItem;
  canEdit: boolean;
}) {
  const isCards = item.type === 'kartlar';
  const count = isCards ? (item.cards?.length ?? 0) : item.questions.length;
  return (
    <article className="item-card">
      <div className="item-card__meta">
        <span className="tag">{ITEM_TYPE_LABELS[item.type]}</span>
        <span className="tag tag--soft">{SUBJECT_LABELS[item.subject]}</span>
        {isCards && item.cardKind && (
          <span className="tag tag--soft">
            {CARD_KIND_LABELS[item.cardKind]}
          </span>
        )}
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
        {canEdit && (
          <Link
            className="btn btn--small btn--ghost"
            to={`/duzenle/${item.id}`}
          >
            Düzenle
          </Link>
        )}
      </div>
    </article>
  );
}
