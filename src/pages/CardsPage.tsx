import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Attempt, FlashCard } from '../types';
import { ITEM_TYPE_LABELS, SUBJECT_LABELS } from '../types';
import { formatPercent } from '../utils/format';
import { uid } from '../utils/id';
import { shuffle } from '../utils/scoring';

export function CardsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, currentUser, saveAttempt } = useApp();
  const item = items.find((i) => i.id === id);

  const deck = useMemo(() => {
    const cards = item?.cards ?? [];
    return item?.settings.shuffleQuestions ? shuffle(cards) : cards;
  }, [item]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<string>>(() => new Set());
  const [unknown, setUnknown] = useState<Set<string>>(() => new Set());
  const [startedAt] = useState(() => Date.now());
  const [done, setDone] = useState(false);

  if (!item || item.type !== 'kartlar') {
    return (
      <div className="page">
        <p>Kelime kartı seti bulunamadı.</p>
        <Link to="/klasorler">Geri</Link>
      </div>
    );
  }

  if (deck.length === 0) {
    return (
      <div className="page">
        <p>Bu sette kart yok.</p>
        <Link to={`/duzenle/${item.id}`}>Düzenle</Link>
      </div>
    );
  }

  const card = deck[Math.min(index, deck.length - 1)];
  const progress = ((index + (done ? 1 : 0)) / deck.length) * 100;

  async function mark(ok: boolean) {
    const idc = card.id;
    const nextKnown = new Set(known);
    const nextUnknown = new Set(unknown);
    if (ok) {
      nextKnown.add(idc);
      nextUnknown.delete(idc);
    } else {
      nextUnknown.add(idc);
      nextKnown.delete(idc);
    }
    setKnown(nextKnown);
    setUnknown(nextUnknown);
    setFlipped(false);

    if (index >= deck.length - 1) {
      await finish(nextKnown, nextUnknown);
      return;
    }
    setIndex((i) => i + 1);
  }

  async function finish(k: Set<string>, u: Set<string>) {
    if (!item || !currentUser) return;
    const maxScore = deck.length;
    const score = k.size;
    const attempt: Attempt = {
      id: uid(),
      itemId: item.id,
      userId: currentUser.id,
      answers: deck.map((c) => ({
        questionId: c.id,
        value: k.has(c.id) ? 'bildim' : 'bilmedim',
        isCorrect: k.has(c.id),
        pointsEarned: k.has(c.id) ? 1 : 0,
      })),
      score,
      maxScore,
      percent: maxScore > 0 ? (score / maxScore) * 100 : 0,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      startedAt,
      completedAt: Date.now(),
    };
    await saveAttempt(attempt);
    setDone(true);
    // silence unused if needed
    void u;
  }

  if (done) {
    const percent = deck.length ? (known.size / deck.length) * 100 : 0;
    const missed = deck.filter((c) => unknown.has(c.id) || !known.has(c.id));
    return (
      <div className="page">
        <header className="page-hero result-hero">
          <div>
            <p className="eyebrow">Kart çalışması bitti</p>
            <h1>{formatPercent(percent)}</h1>
            <p className="lede">
              {known.size}/{deck.length} kartı bildin.
            </p>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => navigate(0)}
            >
              Tekrar çalış
            </button>
            <Link className="btn btn--ghost" to="/raporlar">
              Raporlar
            </Link>
            <Link className="btn btn--ghost" to="/klasorler">
              Klasörler
            </Link>
          </div>
        </header>

        {missed.length > 0 && (
          <section className="section">
            <h2>Tekrar etmen gerekenler</h2>
            <div className="item-grid">
              {missed.map((c) => (
                <article key={c.id} className="item-card">
                  <strong>{c.front}</strong>
                  <p className="muted">{c.back}</p>
                  {c.example && <p className="tiny">{c.example}</p>}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="page cards-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {ITEM_TYPE_LABELS.kartlar} · {SUBJECT_LABELS[item.subject]}
          </p>
          <h1>{item.title}</h1>
          <p className="muted">
            {index + 1} / {deck.length} · Bildin: {known.size} · Bilmedin:{' '}
            {unknown.size}
          </p>
        </div>
      </header>

      <div className="card-progress">
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${progress}%` }} />
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
            <span className="tiny muted">Ön yüz · dokun / tıkla</span>
            <strong className="flash-word">{card.front}</strong>
            {card.hint && <span className="muted">{card.hint}</span>}
          </div>
          <div className="flash-card__face flash-card__back">
            <span className="tiny muted">Arka yüz</span>
            <strong className="flash-word">{card.back}</strong>
            {card.example && (
              <p className="flash-example">{card.example}</p>
            )}
          </div>
        </div>
      </button>

      <div className="hero-actions card-actions">
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => void mark(false)}
        >
          Bilmedim
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setFlipped((f) => !f)}
        >
          Çevir
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void mark(true)}
        >
          Bildim
        </button>
      </div>

      <CardPeekList deck={deck} index={index} />
    </div>
  );
}

function CardPeekList({
  deck,
  index,
}: {
  deck: FlashCard[];
  index: number;
}) {
  return (
    <p className="tiny muted center-text">
      Sıradaki:{' '}
      {deck
        .slice(index + 1, index + 4)
        .map((c) => c.front)
        .join(' · ') || '—'}
    </p>
  );
}
