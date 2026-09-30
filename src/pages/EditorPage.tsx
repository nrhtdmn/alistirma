import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MathInput } from '../components/MathField';
import { useApp } from '../context/AppContext';
import {
  DEFAULT_DECK_OPTIONS,
  DEFAULT_SETTINGS,
  GRADE_LEVELS,
  ITEM_TYPE_LABELS,
  QUESTION_TYPE_LABELS,
  SUBJECT_LABELS,
  type CardDeckOptions,
  type ChoiceOption,
  type ContentItem,
  type FlashCard,
  type ItemSettings,
  type ItemType,
  type MatchPair,
  type Question,
  type QuestionType,
  type SubjectKey,
} from '../types';
import { uid } from '../utils/id';

function emptyCard(): FlashCard {
  return {
    id: uid(),
    front: '',
    back: '',
    example: '',
    hint: '',
    tags: [],
    note: '',
  };
}

function emptyQuestion(type: QuestionType = 'coktan_secmeli'): Question {
  const base: Question = {
    id: uid(),
    type,
    prompt: '',
    points: 10,
  };
  if (type === 'coktan_secmeli' || type === 'coklu_secim') {
    base.options = [
      { id: uid(), text: '', isCorrect: type === 'coktan_secmeli' },
      { id: uid(), text: '', isCorrect: type === 'coklu_secim' },
      { id: uid(), text: '', isCorrect: false },
      { id: uid(), text: '', isCorrect: false },
    ];
  }
  if (type === 'dogru_yanlis') {
    base.options = [
      { id: 'true', text: 'Doğru', isCorrect: true },
      { id: 'false', text: 'Yanlış', isCorrect: false },
    ];
  }
  if (type === 'bosluk_doldurma' || type === 'acik_uclu' || type === 'matematik') {
    base.acceptedAnswers = [''];
  }
  if (type === 'matematik') {
    base.latex = '';
    base.allowHandwriting = true;
  }
  if (type === 'acik_uclu') {
    base.allowHandwriting = false;
  }
  if (type === 'eslestirme') {
    base.pairs = [
      { id: uid(), left: '', right: '' },
      { id: uid(), left: '', right: '' },
    ];
  }
  if (type === 'siralama') {
    base.orderItems = ['', '', ''];
  }
  if (type === 'sayisal') {
    base.numericAnswer = 0;
    base.numericTolerance = 0;
  }
  if (type === 'siniflandirma') {
    const c1 = uid();
    const c2 = uid();
    base.categories = [
      { id: c1, name: 'Grup A' },
      { id: c2, name: 'Grup B' },
    ];
    base.classifyItems = [
      { id: uid(), text: '', categoryId: c1 },
      { id: uid(), text: '', categoryId: c2 },
    ];
  }
  if (type === 'likert') {
    base.likertMin = 1;
    base.likertMax = 5;
    base.likertMinLabel = 'Kesinlikle katılmıyorum';
    base.likertMaxLabel = 'Kesinlikle katılıyorum';
  }
  if (type === 'el_yazisi') {
    base.allowHandwriting = true;
  }
  return base;
}

export function EditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { items, folders, currentUser, saveItem } = useApp();
  const isNew = id === 'yeni';

  const existing = useMemo(
    () => (isNew ? null : items.find((i) => i.id === id) ?? null),
    [items, id, isNew],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ItemType>(
    (params.get('type') as ItemType) || 'alistirma',
  );
  const [subject, setSubject] = useState<SubjectKey>(
    params.get('type') === 'kartlar' ? 'ingilizce' : 'matematik',
  );
  const [gradeLevel, setGradeLevel] = useState('Genel / Her seviye');
  const [folderId, setFolderId] = useState<string | null>(
    params.get('folder'),
  );
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [cards, setCards] = useState<FlashCard[]>([emptyCard()]);
  const [deckOptions, setDeckOptions] = useState<CardDeckOptions>({
    ...DEFAULT_DECK_OPTIONS,
  });
  const [settings, setSettings] = useState<ItemSettings>({ ...DEFAULT_SETTINGS });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isNew) {
      setLoaded(true);
      return;
    }
    if (!existing) return;
    setTitle(existing.title);
    setDescription(existing.description);
    setType(existing.type);
    setSubject(existing.subject);
    setGradeLevel(existing.gradeLevel);
    setFolderId(existing.folderId);
    setQuestions(
      existing.questions.length ? existing.questions : [emptyQuestion()],
    );
    setCards(
      existing.cards && existing.cards.length
        ? existing.cards
        : [emptyCard()],
    );
    setDeckOptions({ ...DEFAULT_DECK_OPTIONS, ...existing.deckOptions });
    setSettings(existing.settings);
    setLoaded(true);
  }, [existing, isNew]);

  function updateQuestion(qid: string, patch: Partial<Question>) {
    setQuestions((qs) =>
      qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)),
    );
  }

  function changeType(qid: string, newType: QuestionType) {
    setQuestions((qs) =>
      qs.map((q) => {
        if (q.id !== qid) return q;
        const nq = emptyQuestion(newType);
        nq.id = q.id;
        nq.prompt = q.prompt;
        nq.points = q.points;
        nq.explanation = q.explanation;
        return nq;
      }),
    );
  }

  async function handleSave() {
    if (!currentUser) return;
    if (!title.trim()) {
      alert('Başlık gerekli');
      return;
    }

    if (type === 'kartlar') {
      if (cards.some((c) => !c.front.trim() || !c.back.trim())) {
        alert('Her kartın ön ve arka yüzü dolu olmalı');
        return;
      }
    } else if (questions.some((q) => !q.prompt.trim() && !q.latex?.trim())) {
      alert('Her sorunun metni olmalı');
      return;
    }

    setSaving(true);
    const item: ContentItem = {
      id: existing?.id ?? uid(),
      folderId,
      ownerId: existing?.ownerId ?? currentUser.id,
      type,
      title: title.trim(),
      description: description.trim(),
      subject,
      gradeLevel,
      questions: type === 'kartlar' ? [] : questions,
      cards: type === 'kartlar' ? cards : undefined,
      deckOptions: type === 'kartlar' ? deckOptions : undefined,
      settings,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await saveItem(item);
    setSaving(false);
    navigate(folderId ? `/klasorler/${folderId}` : '/klasorler');
  }

  if (!isNew && !existing && loaded === false && items.length > 0) {
    return (
      <div className="page">
        <p>İçerik bulunamadı.</p>
        <Link to="/klasorler">Geri</Link>
      </div>
    );
  }

  return (
    <div className="page editor">
      <header className="page-head">
        <div>
          <p className="eyebrow">{isNew ? 'Yeni' : 'Düzenle'}</p>
          <h1>{isNew ? 'İçerik oluştur' : 'İçeriği düzenle'}</h1>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => navigate(-1)}
          >
            İptal
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="form-grid">
          <label className="field field--wide">
            <span>Başlık</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn. Kesirler Alıştırması"
            />
          </label>
          <label className="field field--wide">
            <span>Açıklama</span>
            <textarea
              className="input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Tür</span>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as ItemType)}
            >
              {Object.entries(ITEM_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ders</span>
            <select
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value as SubjectKey)}
            >
              {Object.entries(SUBJECT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Seviye</span>
            <select
              className="input"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            >
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Klasör</span>
            <select
              className="input"
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value || null)}
            >
              <option value="">Kök (klasörsüz)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {folderPath(folders, f.id)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>{type === 'kartlar' ? 'Anki / SRS ayarları' : 'Ayarlar'}</h2>
        {type === 'kartlar' ? (
          <div className="form-grid">
            <label className="field field--wide">
              <span>
                <input
                  type="checkbox"
                  checked={deckOptions.enableReverse}
                  onChange={(e) =>
                    setDeckOptions({
                      ...deckOptions,
                      enableReverse: e.target.checked,
                    })
                  }
                />{' '}
                Ters kartlar (anlam → kelime)
              </span>
            </label>
            <label className="field">
              <span>Günlük yeni kart</span>
              <input
                className="input"
                type="number"
                min={0}
                value={deckOptions.newPerDay}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    newPerDay: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Günlük tekrar (0=∞)</span>
              <input
                className="input"
                type="number"
                min={0}
                value={deckOptions.reviewsPerDay}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    reviewsPerDay: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Öğrenme adımları (dk, virgülle)</span>
              <input
                className="input"
                value={deckOptions.learningStepsMinutes.join(', ')}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    learningStepsMinutes: e.target.value
                      .split(',')
                      .map((x) => Number(x.trim()))
                      .filter((n) => n > 0),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Mezuniyet aralığı (gün)</span>
              <input
                className="input"
                type="number"
                min={1}
                value={deckOptions.graduatingIntervalDays}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    graduatingIntervalDays: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Easy aralığı (gün)</span>
              <input
                className="input"
                type="number"
                min={1}
                value={deckOptions.easyIntervalDays}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    easyIntervalDays: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Başlangıç ease %</span>
              <input
                className="input"
                type="number"
                min={130}
                value={deckOptions.startingEasePercent}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    startingEasePercent: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              <span>Leech eşiği</span>
              <input
                className="input"
                type="number"
                min={1}
                value={deckOptions.leechThreshold}
                onChange={(e) =>
                  setDeckOptions({
                    ...deckOptions,
                    leechThreshold: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field field--wide">
              <span>
                <input
                  type="checkbox"
                  checked={deckOptions.suspendLeeches}
                  onChange={(e) =>
                    setDeckOptions({
                      ...deckOptions,
                      suspendLeeches: e.target.checked,
                    })
                  }
                />{' '}
                Leech kartları otomatik askıya al
              </span>
            </label>
          </div>
        ) : (
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={settings.shuffleQuestions}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    shuffleQuestions: e.target.checked,
                  })
                }
              />
              Soruları karıştır
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.shuffleOptions}
                onChange={(e) =>
                  setSettings({ ...settings, shuffleOptions: e.target.checked })
                }
              />
              Şıkları karıştır
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.showResultsImmediately}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    showResultsImmediately: e.target.checked,
                  })
                }
              />
              Bitince sonucu göster
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.allowReview}
                onChange={(e) =>
                  setSettings({ ...settings, allowReview: e.target.checked })
                }
              />
              Gözden geçirmeye izin ver
            </label>
            <label className="inline-field">
              Süre (dk, boş=sınırsız)
              <input
                className="input input--sm"
                type="number"
                min={1}
                value={settings.timeLimitMinutes ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    timeLimitMinutes: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </label>
            <label className="inline-field">
              Geçme barajı %
              <input
                className="input input--sm"
                type="number"
                min={0}
                max={100}
                value={settings.passScorePercent}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    passScorePercent: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        )}
      </section>

      <section className="section">
        {type === 'kartlar' ? (
          <>
            <div className="section__head">
              <h2>Kelime kartları ({cards.length})</h2>
              <div className="hero-actions">
                <label className="btn btn--ghost btn--small">
                  CSV içe aktar
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    hidden
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const text = await f.text();
                      const lines = text
                        .split(/\r?\n/)
                        .map((l) => l.trim())
                        .filter(Boolean);
                      const parsed: FlashCard[] = [];
                      for (const line of lines) {
                        const parts = line.includes('\t')
                          ? line.split('\t')
                          : line.split(/;|,/).map((p) => p.trim());
                        if (parts.length < 2) continue;
                        if (
                          /^(front|ön|kelime)$/i.test(parts[0]) &&
                          parsed.length === 0
                        )
                          continue;
                        parsed.push({
                          id: uid(),
                          front: parts[0].replace(/^"|"$/g, ''),
                          back: parts[1].replace(/^"|"$/g, ''),
                          example: parts[2]?.replace(/^"|"$/g, '') ?? '',
                          hint: parts[3]?.replace(/^"|"$/g, '') ?? '',
                          tags: parts[4]
                            ? parts[4].split('|').map((t) => t.trim())
                            : [],
                        });
                      }
                      if (parsed.length) {
                        setCards((c) =>
                          c.length === 1 && !c[0].front && !c[0].back
                            ? parsed
                            : [...c, ...parsed],
                        );
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setCards((c) => [...c, emptyCard()])}
                >
                  + Kart ekle
                </button>
              </div>
            </div>
            <div className="question-list">
              {cards.map((card, idx) => (
                <article key={card.id} className="q-editor">
                  <header className="q-editor__head">
                    <strong>Kart {idx + 1}</strong>
                    <div className="hero-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() =>
                          setCards((cs) => move(cs, idx, idx - 1))
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() =>
                          setCards((cs) => move(cs, idx, idx + 1))
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() =>
                          setCards((cs) =>
                            cs.length <= 1
                              ? cs
                              : cs.filter((x) => x.id !== card.id),
                          )
                        }
                      >
                        ✕
                      </button>
                    </div>
                  </header>
                  <div className="form-grid">
                    <label className="field">
                      <span>Ön yüz (kelime / ifade)</span>
                      <input
                        className="input"
                        value={card.front}
                        onChange={(e) =>
                          setCards((cs) =>
                            cs.map((c) =>
                              c.id === card.id
                                ? { ...c, front: e.target.value }
                                : c,
                            ),
                          )
                        }
                        placeholder="apple"
                      />
                    </label>
                    <label className="field">
                      <span>Arka yüz (anlam)</span>
                      <input
                        className="input"
                        value={card.back}
                        onChange={(e) =>
                          setCards((cs) =>
                            cs.map((c) =>
                              c.id === card.id
                                ? { ...c, back: e.target.value }
                                : c,
                            ),
                          )
                        }
                        placeholder="elma"
                      />
                    </label>
                    <label className="field">
                      <span>Telaffuz / ipucu</span>
                      <input
                        className="input"
                        value={card.hint ?? ''}
                        onChange={(e) =>
                          setCards((cs) =>
                            cs.map((c) =>
                              c.id === card.id
                                ? { ...c, hint: e.target.value }
                                : c,
                            ),
                          )
                        }
                        placeholder="/ˈæp.əl/"
                      />
                    </label>
                    <label className="field">
                      <span>Örnek cümle</span>
                      <input
                        className="input"
                        value={card.example ?? ''}
                        onChange={(e) =>
                          setCards((cs) =>
                            cs.map((c) =>
                              c.id === card.id
                                ? { ...c, example: e.target.value }
                                : c,
                            ),
                          )
                        }
                        placeholder="I eat an apple every day."
                      />
                    </label>
                    <label className="field">
                      <span>Etiketler (virgülle)</span>
                      <input
                        className="input"
                        value={(card.tags ?? []).join(', ')}
                        onChange={(e) =>
                          setCards((cs) =>
                            cs.map((c) =>
                              c.id === card.id
                                ? {
                                    ...c,
                                    tags: e.target.value
                                      .split(',')
                                      .map((t) => t.trim())
                                      .filter(Boolean),
                                  }
                                : c,
                            ),
                          )
                        }
                        placeholder="yiyecek, A1"
                      />
                    </label>
                    <label className="field field--wide">
                      <span>Not</span>
                      <input
                        className="input"
                        value={card.note ?? ''}
                        onChange={(e) =>
                          setCards((cs) =>
                            cs.map((c) =>
                              c.id === card.id
                                ? { ...c, note: e.target.value }
                                : c,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="section__head">
              <h2>Sorular ({questions.length})</h2>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
              >
                + Soru ekle
              </button>
            </div>

            <div className="question-list">
              {questions.map((q, idx) => (
                <QuestionEditor
                  key={q.id}
                  index={idx}
                  question={q}
                  onChange={(patch) => updateQuestion(q.id, patch)}
                  onTypeChange={(t) => changeType(q.id, t)}
                  onRemove={() =>
                    setQuestions((qs) =>
                      qs.length <= 1 ? qs : qs.filter((x) => x.id !== q.id),
                    )
                  }
                  onMoveUp={() =>
                    setQuestions((qs) => move(qs, idx, idx - 1))
                  }
                  onMoveDown={() =>
                    setQuestions((qs) => move(qs, idx, idx + 1))
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function folderPath(
  folders: { id: string; parentId: string | null; name: string }[],
  id: string,
): string {
  const parts: string[] = [];
  let cur: string | null = id;
  while (cur) {
    const f = folders.find((x) => x.id === cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return parts.join(' / ');
}

function QuestionEditor({
  index,
  question,
  onChange,
  onTypeChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  question: Question;
  onChange: (p: Partial<Question>) => void;
  onTypeChange: (t: QuestionType) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <article className="q-editor">
      <header className="q-editor__head">
        <strong>Soru {index + 1}</strong>
        <div className="hero-actions">
          <select
            className="input input--sm"
            value={question.type}
            onChange={(e) => onTypeChange(e.target.value as QuestionType)}
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            className="input input--sm"
            type="number"
            min={1}
            title="Puan"
            value={question.points}
            onChange={(e) => onChange({ points: Number(e.target.value) })}
          />
          <button type="button" className="icon-btn" onClick={onMoveUp}>
            ↑
          </button>
          <button type="button" className="icon-btn" onClick={onMoveDown}>
            ↓
          </button>
          <button type="button" className="icon-btn danger" onClick={onRemove}>
            ✕
          </button>
        </div>
      </header>

      <label className="field">
        <span>Soru metni</span>
        <textarea
          className="input"
          rows={2}
          value={question.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
        />
      </label>

      {question.type === 'matematik' && (
        <label className="field">
          <span>Matematik ifadesi (LaTeX)</span>
          <MathInput
            value={question.latex ?? ''}
            onChange={(v) => onChange({ latex: v })}
          />
        </label>
      )}

      {(question.type === 'coktan_secmeli' ||
        question.type === 'dogru_yanlis' ||
        question.type === 'coklu_secim') && (
        <OptionsEditor
          options={question.options ?? []}
          locked={question.type === 'dogru_yanlis'}
          multi={question.type === 'coklu_secim'}
          onChange={(options) => onChange({ options })}
        />
      )}

      {(question.type === 'bosluk_doldurma' ||
        question.type === 'acik_uclu' ||
        question.type === 'matematik') && (
        <AcceptedEditor
          answers={question.acceptedAnswers ?? ['']}
          caseSensitive={!!question.caseSensitive}
          onChange={(acceptedAnswers) => onChange({ acceptedAnswers })}
          onCase={(caseSensitive) => onChange({ caseSensitive })}
          hint={
            question.type === 'acik_uclu'
              ? 'Boş bırakırsanız manuel değerlendirme gerekir'
              : 'Kabul edilen doğru cevaplar'
          }
        />
      )}

      {(question.type === 'matematik' || question.type === 'acik_uclu') && (
        <label className="tiny">
          <input
            type="checkbox"
            checked={!!question.allowHandwriting}
            onChange={(e) =>
              onChange({ allowHandwriting: e.target.checked })
            }
          />{' '}
          Kalemle yazma alanı göster
        </label>
      )}

      {question.type === 'sayisal' && (
        <div className="form-grid">
          <label className="field">
            <span>Doğru sayı</span>
            <input
              className="input"
              type="number"
              step="any"
              value={question.numericAnswer ?? 0}
              onChange={(e) =>
                onChange({ numericAnswer: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Tolerans (±)</span>
            <input
              className="input"
              type="number"
              step="any"
              min={0}
              value={question.numericTolerance ?? 0}
              onChange={(e) =>
                onChange({ numericTolerance: Number(e.target.value) })
              }
            />
          </label>
        </div>
      )}

      {question.type === 'siniflandirma' && (
        <ClassifyEditor
          categories={question.categories ?? []}
          items={question.classifyItems ?? []}
          onChange={(categories, classifyItems) =>
            onChange({ categories, classifyItems })
          }
        />
      )}

      {question.type === 'likert' && (
        <div className="form-grid">
          <label className="field">
            <span>Min</span>
            <input
              className="input"
              type="number"
              value={question.likertMin ?? 1}
              onChange={(e) =>
                onChange({ likertMin: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Max</span>
            <input
              className="input"
              type="number"
              value={question.likertMax ?? 5}
              onChange={(e) =>
                onChange({ likertMax: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Min etiketi</span>
            <input
              className="input"
              value={question.likertMinLabel ?? ''}
              onChange={(e) =>
                onChange({ likertMinLabel: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Max etiketi</span>
            <input
              className="input"
              value={question.likertMaxLabel ?? ''}
              onChange={(e) =>
                onChange({ likertMaxLabel: e.target.value })
              }
            />
          </label>
        </div>
      )}

      {question.type === 'el_yazisi' && (
        <p className="muted tiny">
          Öğrenci kalemle çizecek / yazacak. Değerlendirme manueldir.
        </p>
      )}

      {question.type === 'eslestirme' && (
        <PairsEditor
          pairs={question.pairs ?? []}
          onChange={(pairs) => onChange({ pairs })}
        />
      )}

      {question.type === 'siralama' && (
        <OrderEditor
          items={question.orderItems ?? []}
          onChange={(orderItems) => onChange({ orderItems })}
        />
      )}

      <label className="field">
        <span>Açıklama (isteğe bağlı)</span>
        <input
          className="input"
          value={question.explanation ?? ''}
          onChange={(e) => onChange({ explanation: e.target.value })}
        />
      </label>
    </article>
  );
}

function OptionsEditor({
  options,
  locked,
  multi,
  onChange,
}: {
  options: ChoiceOption[];
  locked?: boolean;
  multi?: boolean;
  onChange: (o: ChoiceOption[]) => void;
}) {
  return (
    <div className="sub-block">
      <span className="field-label">
        Şıklar {multi ? '(birden fazla doğru işaretleyin)' : ''}
      </span>
      {options.map((o, i) => (
        <div key={o.id} className="option-row">
          <input
            type={multi ? 'checkbox' : 'radio'}
            name={multi ? o.id : `correct-${options[0]?.id}`}
            checked={!!o.isCorrect}
            onChange={() =>
              onChange(
                multi
                  ? options.map((x) =>
                      x.id === o.id ? { ...x, isCorrect: !x.isCorrect } : x,
                    )
                  : options.map((x) => ({
                      ...x,
                      isCorrect: x.id === o.id,
                    })),
              )
            }
            title="Doğru şık"
          />
          <input
            className="input"
            value={o.text}
            disabled={locked}
            onChange={(e) =>
              onChange(
                options.map((x) =>
                  x.id === o.id ? { ...x, text: e.target.value } : x,
                ),
              )
            }
            placeholder={`Şık ${i + 1}`}
          />
          {!locked && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => onChange(options.filter((x) => x.id !== o.id))}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {!locked && (
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() =>
            onChange([
              ...options,
              { id: uid(), text: '', isCorrect: false },
            ])
          }
        >
          + Şık
        </button>
      )}
    </div>
  );
}

function ClassifyEditor({
  categories,
  items,
  onChange,
}: {
  categories: { id: string; name: string }[];
  items: { id: string; text: string; categoryId: string }[];
  onChange: (
    categories: { id: string; name: string }[],
    items: { id: string; text: string; categoryId: string }[],
  ) => void;
}) {
  return (
    <div className="sub-block">
      <span className="field-label">Kategoriler</span>
      {categories.map((c) => (
        <div key={c.id} className="option-row">
          <input
            className="input"
            value={c.name}
            onChange={(e) =>
              onChange(
                categories.map((x) =>
                  x.id === c.id ? { ...x, name: e.target.value } : x,
                ),
                items,
              )
            }
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              const nextCats = categories.filter((x) => x.id !== c.id);
              const fallback = nextCats[0]?.id ?? '';
              onChange(
                nextCats,
                items.map((it) =>
                  it.categoryId === c.id
                    ? { ...it, categoryId: fallback }
                    : it,
                ),
              );
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() =>
          onChange(
            [...categories, { id: uid(), name: `Grup ${categories.length + 1}` }],
            items,
          )
        }
      >
        + Kategori
      </button>

      <span className="field-label" style={{ marginTop: '0.75rem' }}>
        Maddeler (doğru kategori)
      </span>
      {items.map((it) => (
        <div key={it.id} className="option-row">
          <input
            className="input"
            value={it.text}
            placeholder="Madde"
            onChange={(e) =>
              onChange(
                categories,
                items.map((x) =>
                  x.id === it.id ? { ...x, text: e.target.value } : x,
                ),
              )
            }
          />
          <select
            className="input"
            value={it.categoryId}
            onChange={(e) =>
              onChange(
                categories,
                items.map((x) =>
                  x.id === it.id ? { ...x, categoryId: e.target.value } : x,
                ),
              )
            }
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn"
            onClick={() =>
              onChange(
                categories,
                items.filter((x) => x.id !== it.id),
              )
            }
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() =>
          onChange(categories, [
            ...items,
            {
              id: uid(),
              text: '',
              categoryId: categories[0]?.id ?? '',
            },
          ])
        }
      >
        + Madde
      </button>
    </div>
  );
}

function AcceptedEditor({
  answers,
  caseSensitive,
  onChange,
  onCase,
  hint,
}: {
  answers: string[];
  caseSensitive: boolean;
  onChange: (a: string[]) => void;
  onCase: (c: boolean) => void;
  hint: string;
}) {
  return (
    <div className="sub-block">
      <span className="field-label">{hint}</span>
      {answers.map((a, i) => (
        <div key={i} className="option-row">
          <input
            className="input"
            value={a}
            onChange={(e) => {
              const next = [...answers];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`Cevap ${i + 1}`}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => onChange(answers.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="hero-actions">
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => onChange([...answers, ''])}
        >
          + Alternatif cevap
        </button>
        <label className="tiny">
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => onCase(e.target.checked)}
          />{' '}
          Büyük/küçük harf duyarlı
        </label>
      </div>
    </div>
  );
}

function PairsEditor({
  pairs,
  onChange,
}: {
  pairs: MatchPair[];
  onChange: (p: MatchPair[]) => void;
}) {
  return (
    <div className="sub-block">
      <span className="field-label">Eşleştirme çiftleri</span>
      {pairs.map((p) => (
        <div key={p.id} className="option-row">
          <input
            className="input"
            value={p.left}
            placeholder="Sol"
            onChange={(e) =>
              onChange(
                pairs.map((x) =>
                  x.id === p.id ? { ...x, left: e.target.value } : x,
                ),
              )
            }
          />
          <span>↔</span>
          <input
            className="input"
            value={p.right}
            placeholder="Sağ"
            onChange={(e) =>
              onChange(
                pairs.map((x) =>
                  x.id === p.id ? { ...x, right: e.target.value } : x,
                ),
              )
            }
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => onChange(pairs.filter((x) => x.id !== p.id))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() =>
          onChange([...pairs, { id: uid(), left: '', right: '' }])
        }
      >
        + Çift
      </button>
    </div>
  );
}

function OrderEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (i: string[]) => void;
}) {
  return (
    <div className="sub-block">
      <span className="field-label">Doğru sıra (üstten alta)</span>
      {items.map((it, i) => (
        <div key={i} className="option-row">
          <span className="muted">{i + 1}.</span>
          <input
            className="input"
            value={it}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn--small btn--ghost"
        onClick={() => onChange([...items, ''])}
      >
        + Madde
      </button>
    </div>
  );
}
