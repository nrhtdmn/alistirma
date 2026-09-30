import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { db } from '../db/database';
import type {
  CardDeckOptions,
  CardDirection,
  CardReviewState,
  FlashCard,
  ReviewLogEntry,
  SrsRating,
} from '../types';
import { DEFAULT_DECK_OPTIONS, ITEM_TYPE_LABELS, SUBJECT_LABELS } from '../types';
import { formatDate, formatPercent } from '../utils/format';
import { uid } from '../utils/id';
import {
  createNewReviewState,
  formatInterval,
  isDue,
  previewInterval,
  reviewStateId,
  schedule,
  startOfLocalDay,
} from '../utils/srs';

type StudyMode = 'anki' | 'new' | 'review' | 'learning' | 'cram' | null;

interface QueuedCard {
  card: FlashCard;
  direction: CardDirection;
  state: CardReviewState;
}

const RATING_LABELS: Record<SrsRating, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

export function CardsPage() {
  const { id } = useParams();
  const { items, currentUser, saveAttempt } = useApp();
  const item = items.find((i) => i.id === id);

  const opts: CardDeckOptions = useMemo(
    () => ({ ...DEFAULT_DECK_OPTIONS, ...item?.deckOptions }),
    [item],
  );

  const [reviews, setReviews] = useState<CardReviewState[]>([]);
  const [logs, setLogs] = useState<ReviewLogEntry[]>([]);
  const [mode, setMode] = useState<StudyMode>(null);
  const [queue, setQueue] = useState<QueuedCard[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shownAt, setShownAt] = useState(Date.now());
  const [sessionStats, setSessionStats] = useState({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [done, setDone] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const cards = item?.cards ?? [];

  const reload = useCallback(async () => {
    if (!item || !currentUser) return;
    const [r, l] = await Promise.all([
      db.cardReviews.where({ userId: currentUser.id, itemId: item.id }).toArray(),
      db.reviewLogs
        .where({ userId: currentUser.id, itemId: item.id })
        .reverse()
        .sortBy('reviewedAt'),
    ]);
    setReviews(r);
    setLogs(l.reverse());
    setLoading(false);
  }, [item, currentUser]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Kart + yön için state oluştur / getir */
  const ensureStates = useCallback(async (): Promise<CardReviewState[]> => {
    if (!item || !currentUser) return [];
    const existing = await db.cardReviews
      .where({ userId: currentUser.id, itemId: item.id })
      .toArray();
    const map = new Map(existing.map((e) => [e.id, e]));
    const toAdd: CardReviewState[] = [];

    for (const card of cards) {
      const dirs: CardDirection[] = opts.enableReverse
        ? ['forward', 'reverse']
        : ['forward'];
      for (const dir of dirs) {
        const sid = reviewStateId(currentUser.id, item.id, card.id, dir);
        if (!map.has(sid)) {
          const s = createNewReviewState(
            currentUser.id,
            item.id,
            card.id,
            dir,
            opts,
          );
          toAdd.push(s);
          map.set(sid, s);
        }
      }
    }

    // Silinen kartların state'lerini bırak (geçmiş için) ama kuyruğa alma
    if (toAdd.length) await db.cardReviews.bulkPut(toAdd);
    return [...map.values()];
  }, [item, currentUser, cards, opts]);

  const counts = useMemo(() => {
    const now = Date.now();
    const dayStart = startOfLocalDay(now);
    const reviewedToday = logs.filter((l) => l.reviewedAt >= dayStart);
    const newToday = reviewedToday.filter((l) => l.previousState === 'new').length;
    const reviewToday = reviewedToday.filter(
      (l) => l.previousState === 'review',
    ).length;

    let neu = 0;
    let learning = 0;
    let reviewDue = 0;
    let suspended = 0;
    let leeches = 0;

    const cardIds = new Set(cards.map((c) => c.id));
    for (const r of reviews) {
      if (!cardIds.has(r.cardId)) continue;
      if (opts.enableReverse === false && r.direction === 'reverse') continue;
      if (r.suspended) {
        suspended += 1;
        continue;
      }
      if (r.isLeech) leeches += 1;
      if (r.buriedUntil && r.buriedUntil > now) continue;
      if (r.state === 'new') neu += 1;
      else if (r.state === 'learning' || r.state === 'relearning') {
        if (isDue(r, now)) learning += 1;
      } else if (r.state === 'review' && isDue(r, now)) reviewDue += 1;
    }

    const newLeft = Math.max(0, opts.newPerDay - newToday);
    const reviewLeft =
      opts.reviewsPerDay <= 0
        ? reviewDue
        : Math.max(0, Math.min(reviewDue, opts.reviewsPerDay - reviewToday));

    return {
      neu,
      learning,
      reviewDue,
      suspended,
      leeches,
      newLeft,
      reviewLeft,
      dueTotal: Math.min(neu, newLeft) + learning + reviewLeft,
      reviewedToday: reviewedToday.length,
    };
  }, [reviews, logs, cards, opts]);

  async function buildQueue(m: StudyMode): Promise<QueuedCard[]> {
    if (!m || !item || !currentUser) return [];
    const states = await ensureStates();
    await reload();
    const now = Date.now();
    const cardMap = new Map(cards.map((c) => [c.id, c]));
    const dayStart = startOfLocalDay(now);
    const reviewedToday = (
      await db.reviewLogs.where({ userId: currentUser.id, itemId: item.id }).toArray()
    ).filter((l) => l.reviewedAt >= dayStart);
    const newToday = reviewedToday.filter((l) => l.previousState === 'new').length;
    const reviewTodayCount = reviewedToday.filter(
      (l) => l.previousState === 'review',
    ).length;

    const usable = states.filter((s) => {
      if (!cardMap.has(s.cardId)) return false;
      if (!opts.enableReverse && s.direction === 'reverse') return false;
      if (s.suspended) return false;
      if (s.buriedUntil && s.buriedUntil > now) return false;
      return true;
    });

    const toQueued = (s: CardReviewState): QueuedCard | null => {
      const card = cardMap.get(s.cardId);
      if (!card) return null;
      return { card, direction: s.direction, state: s };
    };

    if (m === 'cram') {
      return usable
        .map(toQueued)
        .filter(Boolean)
        .sort(() => Math.random() - 0.5) as QueuedCard[];
    }

    const learningDue = usable
      .filter(
        (s) =>
          (s.state === 'learning' || s.state === 'relearning') && isDue(s, now),
      )
      .sort((a, b) => a.dueAt - b.dueAt);

    const reviewDue = usable
      .filter((s) => s.state === 'review' && isDue(s, now))
      .sort((a, b) => a.dueAt - b.dueAt);

    const news = usable
      .filter((s) => s.state === 'new')
      .sort((a, b) => a.cardId.localeCompare(b.cardId));

    if (m === 'learning') {
      return learningDue.map(toQueued).filter(Boolean) as QueuedCard[];
    }
    if (m === 'review') {
      const limit =
        opts.reviewsPerDay <= 0
          ? reviewDue.length
          : Math.max(0, opts.reviewsPerDay - reviewTodayCount);
      return reviewDue.slice(0, limit).map(toQueued).filter(Boolean) as QueuedCard[];
    }
    if (m === 'new') {
      const limit = Math.max(0, opts.newPerDay - newToday);
      return news.slice(0, limit).map(toQueued).filter(Boolean) as QueuedCard[];
    }

    // anki: learning first, then review, then new (with daily caps)
    const reviewLimit =
      opts.reviewsPerDay <= 0
        ? reviewDue.length
        : Math.max(0, opts.reviewsPerDay - reviewTodayCount);
    const newLimit = Math.max(0, opts.newPerDay - newToday);
    const q = [
      ...learningDue,
      ...reviewDue.slice(0, reviewLimit),
      ...news.slice(0, newLimit),
    ];
    return q.map(toQueued).filter(Boolean) as QueuedCard[];
  }

  async function startMode(m: Exclude<StudyMode, null>) {
    const q = await buildQueue(m);
    setMode(m);
    setQueue(q);
    setQIndex(0);
    setFlipped(false);
    setShownAt(Date.now());
    setSessionStats({ again: 0, hard: 0, good: 0, easy: 0 });
    setDone(q.length === 0);
    const fresh = await db.cardReviews
      .where({ userId: currentUser!.id, itemId: item!.id })
      .toArray();
    setReviews(fresh);
  }

  const current = queue[qIndex] ?? null;

  const faces = useMemo(() => {
    if (!current) return { front: '', back: '', hint: '', example: '' };
    if (current.direction === 'forward') {
      return {
        front: current.card.front,
        back: current.card.back,
        hint: current.card.hint ?? '',
        example: current.card.example ?? '',
      };
    }
    return {
      front: current.card.back,
      back: current.card.front,
      hint: '',
      example: current.card.example ?? '',
    };
  }, [current]);

  async function rate(rating: SrsRating) {
    if (!current || !item || !currentUser || !flipped) return;
    const prev = current.state;
    const nextState = schedule(prev, rating, opts);
    const timeTakenMs = Date.now() - shownAt;

    const log: ReviewLogEntry = {
      id: uid(),
      userId: currentUser.id,
      itemId: item.id,
      cardId: current.card.id,
      direction: current.direction,
      rating,
      previousState: prev.state,
      newState: nextState.state,
      previousInterval: prev.intervalDays,
      newInterval: nextState.intervalDays,
      easeFactor: nextState.easeFactor,
      reviewedAt: Date.now(),
      timeTakenMs,
    };

    await db.transaction('rw', db.cardReviews, db.reviewLogs, async () => {
      await db.cardReviews.put(nextState);
      await db.reviewLogs.add(log);
    });

    setSessionStats((s) => ({
      again: s.again + (rating === 1 ? 1 : 0),
      hard: s.hard + (rating === 2 ? 1 : 0),
      good: s.good + (rating === 3 ? 1 : 0),
      easy: s.easy + (rating === 4 ? 1 : 0),
    }));

    // Again / learning cards may re-enter queue today
    const nextQueue = [...queue];
    nextQueue[qIndex] = { ...current, state: nextState };

    if (
      rating === 1 ||
      nextState.state === 'learning' ||
      nextState.state === 'relearning'
    ) {
      // Anki: again cards come back after step — append if due soon in same session optional
      // Keep simple: if due within 10 min, append to end
      if (nextState.dueAt - Date.now() <= 10 * 60_000 && !nextState.suspended) {
        nextQueue.push({ ...current, state: nextState });
      }
    }

    setQueue(nextQueue);
    setFlipped(false);
    setShownAt(Date.now());

    if (qIndex >= nextQueue.length - 1) {
      // finished
      const total =
        sessionStats.again +
        sessionStats.hard +
        sessionStats.good +
        sessionStats.easy +
        1;
      const goodish =
        sessionStats.good + sessionStats.easy + (rating >= 3 ? 1 : 0);
      await saveAttempt({
        id: uid(),
        itemId: item.id,
        userId: currentUser.id,
        answers: [
          {
            questionId: 'srs-session',
            value: { ...sessionStats, last: rating },
            isCorrect: null,
            pointsEarned: goodish,
          },
        ],
        score: goodish,
        maxScore: total,
        percent: total ? (goodish / total) * 100 : 0,
        durationSeconds: Math.round(
          (logs[0] ? Date.now() - (logs[logs.length - 1]?.reviewedAt ?? Date.now()) : 0) /
            1000,
        ),
        startedAt: Date.now(),
        completedAt: Date.now(),
      });
      setDone(true);
      await reload();
      return;
    }
    setQIndex((i) => i + 1);
  }

  async function toggleSuspend(state: CardReviewState) {
    await db.cardReviews.put({
      ...state,
      suspended: !state.suspended,
      buriedUntil: null,
    });
    await reload();
  }

  async function buryCard(state: CardReviewState) {
    const until = startOfLocalDay() + 86_400_000;
    await db.cardReviews.put({ ...state, buriedUntil: until });
    await reload();
  }

  async function resetDeckProgress() {
    if (!item || !currentUser) return;
    if (!confirm('Bu destedeki tüm SRS ilerlemen silinsin mi?')) return;
    const keys = await db.cardReviews
      .where({ userId: currentUser.id, itemId: item.id })
      .primaryKeys();
    const logKeys = await db.reviewLogs
      .where({ userId: currentUser.id, itemId: item.id })
      .primaryKeys();
    await db.cardReviews.bulkDelete(keys);
    await db.reviewLogs.bulkDelete(logKeys);
    await reload();
    setMode(null);
    setDone(false);
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!mode || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (!flipped) return;
      if (e.key === '1') void rate(1);
      if (e.key === '2') void rate(2);
      if (e.key === '3') void rate(3);
      if (e.key === '4') void rate(4);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, done, flipped, current, qIndex, queue]);

  if (!item || item.type !== 'kartlar') {
    return (
      <div className="page">
        <p>Kelime kartı seti bulunamadı.</p>
        <Link to="/klasorler">Geri</Link>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="page">
        <p>Çalışmak için kullanıcı seçin.</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="page">
        <p>Bu sette kart yok.</p>
        <Link to={`/duzenle/${item.id}`}>Düzenle</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <p>Yükleniyor…</p>
      </div>
    );
  }

  // Session finished
  if (mode && done) {
    const total =
      sessionStats.again +
      sessionStats.hard +
      sessionStats.good +
      sessionStats.easy;
    return (
      <div className="page">
        <header className="page-hero">
          <div>
            <p className="eyebrow">Oturum bitti</p>
            <h1>{total} kart çalışıldı</h1>
            <p className="lede">
              Again {sessionStats.again} · Hard {sessionStats.hard} · Good{' '}
              {sessionStats.good} · Easy {sessionStats.easy}
            </p>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setMode(null);
                setDone(false);
              }}
            >
              Desteye dön
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void startMode('anki')}
            >
              Tekrar çalış
            </button>
          </div>
        </header>
      </div>
    );
  }

  // Study session
  if (mode && current) {
    const previews: Record<SrsRating, string> = {
      1: previewInterval(current.state, 1, opts),
      2: previewInterval(current.state, 2, opts),
      3: previewInterval(current.state, 3, opts),
      4: previewInterval(current.state, 4, opts),
    };

    return (
      <div className="page cards-page">
        <header className="page-head">
          <div>
            <p className="eyebrow">
              Anki · {current.state.state}
              {current.direction === 'reverse' ? ' · ters' : ''}
            </p>
            <h1>{item.title}</h1>
            <p className="muted">
              {qIndex + 1} / {queue.length} · Ease{' '}
              {(current.state.easeFactor * 100).toFixed(0)}% · Aralık{' '}
              {current.state.intervalDays
                ? `${current.state.intervalDays}g`
                : '—'}
            </p>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => void buryCard(current.state)}
            >
              Gizle (bugün)
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => void toggleSuspend(current.state)}
            >
              Askıya al
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                setMode(null);
                setDone(false);
              }}
            >
              Çık
            </button>
          </div>
        </header>

        <div className="card-progress">
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${((qIndex + 1) / Math.max(1, queue.length)) * 100}%`,
              }}
            />
          </div>
        </div>

        <button
          type="button"
          className={`flash-card ${flipped ? 'is-flipped' : ''}`}
          onClick={() => setFlipped((f) => !f)}
          aria-label="Kartı çevir"
        >
          <div className="flash-card__inner">
            <div className="flash-card__face flash-card__front">
              <span className="tiny muted">
                {current.direction === 'reverse' ? 'Ters kart · ' : ''}
                Ön yüz · Space
              </span>
              <strong className="flash-word">{faces.front}</strong>
              {faces.hint && <span className="muted">{faces.hint}</span>}
              {current.card.tags && current.card.tags.length > 0 && (
                <div className="tag-row">
                  {current.card.tags.map((t) => (
                    <span key={t} className="tag tag--soft">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flash-card__face flash-card__back">
              <span className="tiny muted">Arka yüz</span>
              <strong className="flash-word">{faces.back}</strong>
              {faces.example && (
                <p className="flash-example">{faces.example}</p>
              )}
              {current.card.note && (
                <p className="tiny">{current.card.note}</p>
              )}
            </div>
          </div>
        </button>

        {!flipped ? (
          <div className="hero-actions card-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setFlipped(true)}
            >
              Göster (Space)
            </button>
          </div>
        ) : (
          <div className="anki-rates">
            {([1, 2, 3, 4] as SrsRating[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`anki-rate anki-rate--${r}`}
                onClick={() => void rate(r)}
              >
                <strong>
                  {r} · {RATING_LABELS[r]}
                </strong>
                <small>{previews[r]}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Empty queue message
  if (mode && !current) {
    return (
      <div className="page">
        <h1>Çalışacak kart yok</h1>
        <p className="muted">
          Bugünkü limit doldu veya vadesi gelen kart kalmadı.
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setMode(null)}
        >
          Geri
        </button>
      </div>
    );
  }

  // Deck hub
  const retention = (() => {
    const recent = logs.slice(0, 100);
    if (!recent.length) return null;
    const ok = recent.filter((l) => l.rating >= 3).length;
    return (ok / recent.length) * 100;
  })();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {ITEM_TYPE_LABELS.kartlar} · Anki SRS ·{' '}
            {SUBJECT_LABELS[item.subject]}
          </p>
          <h1>{item.title}</h1>
          <p className="muted">
            {cards.length} not ·{' '}
            {opts.enableReverse ? cards.length * 2 : cards.length} kart
            {opts.enableReverse ? ' (çift yön)' : ''}
          </p>
        </div>
        <div className="hero-actions">
          <Link className="btn btn--ghost" to={`/duzenle/${item.id}`}>
            Düzenle
          </Link>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setBrowseOpen((o) => !o)}
          >
            Gözat
          </button>
        </div>
      </header>

      <section className="stat-grid">
        <div className="stat">
          <span className="stat__n">{counts.dueTotal}</span>
          <span className="stat__l">Bugün due</span>
        </div>
        <div className="stat">
          <span className="stat__n">{counts.neu}</span>
          <span className="stat__l">Yeni</span>
        </div>
        <div className="stat">
          <span className="stat__n">{counts.learning}</span>
          <span className="stat__l">Öğrenme</span>
        </div>
        <div className="stat">
          <span className="stat__n">{counts.reviewDue}</span>
          <span className="stat__l">Tekrar</span>
        </div>
      </section>

      <section className="panel">
        <h2>Çalışma</h2>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void startMode('anki')}
          >
            Çalış ({counts.dueTotal})
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void startMode('new')}
          >
            Yeni ({Math.min(counts.neu, counts.newLeft)})
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void startMode('learning')}
          >
            Öğrenme ({counts.learning})
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void startMode('review')}
          >
            Tekrar ({counts.reviewLeft})
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void startMode('cram')}
          >
            Ezber (hepsi)
          </button>
        </div>
        <p className="tiny muted" style={{ marginTop: '0.75rem' }}>
          Kısayollar: Space = çevir · 1 Again · 2 Hard · 3 Good · 4 Easy
        </p>
      </section>

      <section className="panel">
        <h2>İstatistik</h2>
        <ul className="plain-list">
          <li>Bugün incelenen: {counts.reviewedToday}</li>
          <li>
            Günlük limit: {opts.newPerDay} yeni /{' '}
            {opts.reviewsPerDay || '∞'} tekrar
          </li>
          <li>
            Saklama (son 100):{' '}
            {retention == null ? '—' : formatPercent(retention)}
          </li>
          <li>Askıda: {counts.suspended} · Leech: {counts.leeches}</li>
          <li>
            Öğrenme adımları: {opts.learningStepsMinutes.join(', ')} dk
          </li>
        </ul>
        <div className="hero-actions" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn--danger btn--small"
            onClick={() => void resetDeckProgress()}
          >
            İlerlemeyi sıfırla
          </button>
        </div>
      </section>

      {logs.length > 0 && (
        <section className="section">
          <h2>Son incelemeler</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Kart</th>
                  <th>Puan</th>
                  <th>Aralık</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 15).map((l) => {
                  const c = cards.find((x) => x.id === l.cardId);
                  return (
                    <tr key={l.id}>
                      <td>{formatDate(l.reviewedAt)}</td>
                      <td>
                        {c?.front ?? '?'}
                        {l.direction === 'reverse' ? ' ↔' : ''}
                      </td>
                      <td>{RATING_LABELS[l.rating]}</td>
                      <td>
                        {l.newInterval
                          ? `${l.newInterval}g`
                          : formatInterval(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {browseOpen && (
        <section className="section">
          <h2>Kart tarayıcı</h2>
          <div className="item-grid">
            {cards.map((c) => {
              const fwd = reviews.find(
                (r) => r.cardId === c.id && r.direction === 'forward',
              );
              return (
                <article key={c.id} className="item-card">
                  <strong>{c.front}</strong>
                  <p className="muted">{c.back}</p>
                  <p className="tiny muted">
                    {fwd
                      ? `${fwd.state} · due ${formatDate(fwd.dueAt)} · ease ${(fwd.easeFactor * 100).toFixed(0)}%`
                      : 'Henüz çalışılmadı'}
                  </p>
                  {fwd && (
                    <button
                      type="button"
                      className="btn btn--small btn--ghost"
                      onClick={() => void toggleSuspend(fwd)}
                    >
                      {fwd.suspended ? 'Askıyı kaldır' : 'Askıya al'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
