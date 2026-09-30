import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { DrawingPad } from '../components/DrawingPad';
import { MathDisplay, MathInput } from '../components/MathField';
import { useApp } from '../context/AppContext';
import type { Attempt, HybridAnswer, Question } from '../types';
import { ITEM_TYPE_LABELS, SUBJECT_LABELS } from '../types';
import { formatDuration, formatPercent } from '../utils/format';
import { uid } from '../utils/id';
import { extractDrawing, extractTextAnswer, gradeAttempt, shuffle } from '../utils/scoring';

export function TakePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, currentUser, saveAttempt } = useApp();
  const item = items.find((i) => i.id === id);

  const [startedAt] = useState(() => Date.now());
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState<Attempt | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const questions = useMemo(() => {
    if (!item) return [];
    let qs = [...item.questions];
    if (item.settings.shuffleQuestions) qs = shuffle(qs);
    if (item.settings.shuffleOptions) {
      qs = qs.map((q) =>
        q.options
          ? { ...q, options: shuffle(q.options) }
          : q.type === 'siralama' && q.orderItems
            ? { ...q, orderItems: shuffle(q.orderItems) }
            : q,
      );
    } else if (item) {
      qs = qs.map((q) =>
        q.type === 'siralama' && q.orderItems
          ? { ...q, orderItems: shuffle([...q.orderItems]) }
          : q,
      );
    }
    return qs;
  }, [item]);

  useEffect(() => {
    if (!item?.settings.timeLimitMinutes) return;
    setSecondsLeft(item.settings.timeLimitMinutes * 60);
  }, [item]);

  useEffect(() => {
    if (secondsLeft === null || submitted) return;
    if (secondsLeft <= 0) {
      void finish();
      return;
    }
    const t = window.setTimeout(() => setSecondsLeft((s) => (s ?? 1) - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted]);

  async function finish() {
    if (!item || !currentUser || submitted) return;
    const graded = gradeAttempt(item.questions, answers);
    const attempt: Attempt = {
      id: uid(),
      itemId: item.id,
      userId: currentUser.id,
      answers: graded.records,
      score: graded.score,
      maxScore: graded.maxScore,
      percent: graded.percent,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      startedAt,
      completedAt: Date.now(),
    };
    await saveAttempt(attempt);
    setSubmitted(attempt);
  }

  if (!item) {
    return (
      <div className="page">
        <p>İçerik bulunamadı.</p>
        <Link to="/">Ana sayfa</Link>
      </div>
    );
  }

  if (item.type === 'kartlar') {
    return <Navigate to={`/kartlar/${item.id}`} replace />;
  }

  if (submitted && item.settings.showResultsImmediately) {
    const passed = submitted.percent >= item.settings.passScorePercent;
    return (
      <div className="page">
        <header className="page-hero result-hero">
          <div>
            <p className="eyebrow">Sonuç</p>
            <h1>{passed ? 'Tebrikler!' : 'Devam et'}</h1>
            <p className="lede">
              {submitted.score}/{submitted.maxScore} puan —{' '}
              {formatPercent(submitted.percent)} ·{' '}
              {formatDuration(submitted.durationSeconds)}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="btn btn--primary" to="/raporlar">
              Raporlara git
            </Link>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate(0)}
            >
              Tekrar çöz
            </button>
            <Link className="btn btn--ghost" to="/klasorler">
              Klasörler
            </Link>
          </div>
        </header>

        {item.settings.allowReview && (
          <section className="section">
            <h2>Gözden geçirme</h2>
            <div className="question-list">
              {item.questions.map((q, i) => {
                const rec = submitted.answers.find((a) => a.questionId === q.id);
                return (
                  <article
                    key={q.id}
                    className={`q-take ${
                      rec?.isCorrect === true
                        ? 'is-correct'
                        : rec?.isCorrect === false
                          ? 'is-wrong'
                          : 'is-pending'
                    }`}
                  >
                    <header>
                      <strong>
                        {i + 1}. {q.prompt}
                      </strong>
                      <span className="tag">
                        {rec?.isCorrect === true
                          ? 'Doğru'
                          : rec?.isCorrect === false
                            ? 'Yanlış'
                            : 'Manuel'}
                      </span>
                    </header>
                    {q.latex && <MathDisplay latex={q.latex} display />}
                    <p className="muted tiny">
                      Senin cevabın:{' '}
                      {formatAnswer(rec?.value)} ·{' '}
                      {rec?.pointsEarned}/{q.points} puan
                    </p>
                    {extractDrawing(rec?.value) && (
                      <img
                        className="answer-drawing"
                        src={extractDrawing(rec?.value)}
                        alt="El yazısı cevabı"
                      />
                    )}
                    {q.explanation && (
                      <p className="explain">{q.explanation}</p>
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

  if (submitted) {
    return (
      <div className="page">
        <h1>Cevapların kaydedildi</h1>
        <p className="muted">Sonuçlar hemen gösterilmiyor.</p>
        <Link className="btn btn--primary" to="/raporlar">
          Raporlar
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {ITEM_TYPE_LABELS[item.type]} · {SUBJECT_LABELS[item.subject]}
          </p>
          <h1>{item.title}</h1>
          <p className="muted">
            {item.gradeLevel} · {questions.length} soru
            {secondsLeft !== null && (
              <> · Kalan süre: {formatDuration(secondsLeft)}</>
            )}
          </p>
        </div>
      </header>

      {item.description && <p className="lede">{item.description}</p>}

      <div className="question-list">
        {questions.map((q, i) => (
          <QuestionTaker
            key={q.id}
            index={i}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
          />
        ))}
      </div>

      <div className="sticky-bar">
        <button type="button" className="btn btn--primary" onClick={finish}>
          Bitir ve kaydet
        </button>
      </div>
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    if (value.startsWith('data:image')) return '[El yazısı]';
    return value;
  }
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    const h = value as HybridAnswer;
    const parts: string[] = [];
    if (h.text) parts.push(h.text);
    if (h.drawing) parts.push('[El yazısı]');
    if (parts.length) return parts.join(' · ');
    return JSON.stringify(value);
  }
  return String(value);
}

function asHybrid(value: unknown): HybridAnswer {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as HybridAnswer;
  }
  if (typeof value === 'string') {
    if (value.startsWith('data:image')) return { drawing: value };
    return { text: value };
  }
  return { text: '', drawing: '' };
}

function QuestionTaker({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const hybrid = asHybrid(value);
  const showPad =
    question.type === 'el_yazisi' ||
    question.type === 'matematik' ||
    !!question.allowHandwriting;

  return (
    <article className="q-take">
      <header>
        <strong>
          {index + 1}. {question.prompt}
        </strong>
        <span className="tag tag--soft">{question.points} puan</span>
      </header>

      {question.latex && <MathDisplay latex={question.latex} display />}

      {(question.type === 'coktan_secmeli' ||
        question.type === 'dogru_yanlis') && (
        <div className="choice-list">
          {(question.options ?? []).map((o) => (
            <label key={o.id} className="choice">
              <input
                type="radio"
                name={question.id}
                checked={value === o.id}
                onChange={() => onChange(o.id)}
              />
              <span>{o.text}</span>
            </label>
          ))}
        </div>
      )}

      {question.type === 'coklu_secim' && (
        <div className="choice-list">
          {(question.options ?? []).map((o) => {
            const selected = (value as string[]) ?? [];
            const checked = selected.includes(o.id);
            return (
              <label key={o.id} className="choice">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? selected.filter((id) => id !== o.id)
                        : [...selected, o.id],
                    )
                  }
                />
                <span>{o.text}</span>
              </label>
            );
          })}
        </div>
      )}

      {(question.type === 'bosluk_doldurma' ||
        question.type === 'acik_uclu') && (
        <textarea
          className="input"
          rows={question.type === 'acik_uclu' ? 4 : 2}
          value={extractTextAnswer(value)}
          onChange={(e) =>
            onChange(
              question.allowHandwriting
                ? { ...hybrid, text: e.target.value }
                : e.target.value,
            )
          }
          placeholder="Cevabını yaz…"
        />
      )}

      {question.type === 'matematik' && (
        <MathInput
          value={extractTextAnswer(value)}
          onChange={(text) => onChange({ ...hybrid, text })}
          placeholder="Cevabı yaz (sayı veya LaTeX)"
        />
      )}

      {question.type === 'sayisal' && (
        <input
          className="input"
          type="number"
          step="any"
          value={extractTextAnswer(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sayısal cevap"
        />
      )}

      {question.type === 'likert' && (
        <div className="likert">
          <span className="tiny muted">{question.likertMinLabel}</span>
          <div className="likert-scale">
            {Array.from(
              {
                length:
                  (question.likertMax ?? 5) - (question.likertMin ?? 1) + 1,
              },
              (_, i) => (question.likertMin ?? 1) + i,
            ).map((n) => (
              <label key={n} className={`likert-opt ${value === n ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name={question.id}
                  checked={value === n}
                  onChange={() => onChange(n)}
                />
                {n}
              </label>
            ))}
          </div>
          <span className="tiny muted">{question.likertMaxLabel}</span>
        </div>
      )}

      {question.type === 'siniflandirma' && (
        <ClassifyTaker
          question={question}
          value={(value as Record<string, string>) ?? {}}
          onChange={onChange}
        />
      )}

      {question.type === 'eslestirme' && (
        <MatchTaker
          question={question}
          value={(value as Record<string, string>) ?? {}}
          onChange={onChange}
        />
      )}

      {question.type === 'siralama' && (
        <OrderTaker
          items={(value as string[]) ?? question.orderItems ?? []}
          onChange={onChange}
        />
      )}

      {showPad && (
        <DrawingPad
          label={
            question.type === 'matematik'
              ? 'Çözümü kalemle yaz'
              : 'El yazısı / çizim alanı'
          }
          value={extractDrawing(value) || hybrid.drawing}
          onChange={(drawing) => {
            if (question.type === 'el_yazisi') {
              onChange({ drawing });
            } else if (
              question.type === 'matematik' ||
              question.allowHandwriting
            ) {
              onChange({ ...hybrid, drawing });
            } else {
              onChange(drawing);
            }
          }}
        />
      )}
    </article>
  );
}

function ClassifyTaker({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const items = useMemo(() => {
    return shuffle([...(question.classifyItems ?? [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  return (
    <div className="classify-list">
      {items.map((it) => (
        <div key={it.id} className="option-row">
          <span className="match-left">{it.text}</span>
          <select
            className="input"
            value={value[it.id] ?? ''}
            onChange={(e) => onChange({ ...value, [it.id]: e.target.value })}
          >
            <option value="">Kategori seç…</option>
            {(question.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function MatchTaker({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const rights = useMemo(() => {
    const r = (question.pairs ?? []).map((p) => p.right);
    return shuffle(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  return (
    <div className="match-list">
      {(question.pairs ?? []).map((p) => (
        <div key={p.id} className="option-row">
          <span className="match-left">{p.left}</span>
          <select
            className="input"
            value={value[p.id] ?? ''}
            onChange={(e) => onChange({ ...value, [p.id]: e.target.value })}
          >
            <option value="">Seç…</option>
            {rights.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function OrderTaker({
  items,
  onChange,
}: {
  items: string[];
  onChange: (v: string[]) => void;
}) {
  function swap(i: number, j: number) {
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div className="order-list">
      {items.map((it, i) => (
        <div key={`${it}-${i}`} className="option-row">
          <span className="muted">{i + 1}.</span>
          <span className="grow">{it}</span>
          <button type="button" className="icon-btn" onClick={() => swap(i, i - 1)}>
            ↑
          </button>
          <button type="button" className="icon-btn" onClick={() => swap(i, i + 1)}>
            ↓
          </button>
        </div>
      ))}
    </div>
  );
}
