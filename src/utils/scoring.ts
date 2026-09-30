import type { AnswerRecord, HybridAnswer, Question } from '../types';

function normalize(text: string, caseSensitive: boolean): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return caseSensitive ? t : t.toLocaleLowerCase('tr-TR');
}

function answersMatch(
  given: string,
  accepted: string[],
  caseSensitive: boolean,
): boolean {
  const g = normalize(given, caseSensitive);
  return accepted.some((a) => normalize(a, caseSensitive) === g);
}

export function extractTextAnswer(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as HybridAnswer).text ?? '');
  }
  return '';
}

export function extractDrawing(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'drawing' in value) {
    return String((value as HybridAnswer).drawing ?? '');
  }
  return '';
}

export function gradeQuestion(
  question: Question,
  value: unknown,
): AnswerRecord {
  const base = {
    questionId: question.id,
    value,
    isCorrect: null as boolean | null,
    pointsEarned: 0,
  };

  switch (question.type) {
    case 'coktan_secmeli':
    case 'dogru_yanlis': {
      const selected = String(value ?? '');
      const correct = question.options?.find((o) => o.isCorrect);
      const ok = !!correct && selected === correct.id;
      return {
        ...base,
        isCorrect: ok,
        pointsEarned: ok ? question.points : 0,
      };
    }
    case 'coklu_secim': {
      const selected = new Set((value as string[]) ?? []);
      const correctIds = (question.options ?? [])
        .filter((o) => o.isCorrect)
        .map((o) => o.id);
      if (correctIds.length === 0) {
        return {
          ...base,
          isCorrect: null,
          pointsEarned: 0,
          feedback: 'Manuel değerlendirme',
        };
      }
      const allCorrect =
        correctIds.length === selected.size &&
        correctIds.every((id) => selected.has(id));
      let hit = 0;
      for (const id of correctIds) if (selected.has(id)) hit += 1;
      let wrong = 0;
      for (const id of selected) if (!correctIds.includes(id)) wrong += 1;
      const ratio = Math.max(0, (hit - wrong) / correctIds.length);
      const earned = Math.round(question.points * ratio * 100) / 100;
      return {
        ...base,
        isCorrect: allCorrect,
        pointsEarned: earned,
      };
    }
    case 'bosluk_doldurma':
    case 'acik_uclu':
    case 'matematik': {
      const text = extractTextAnswer(value);
      const drawing = extractDrawing(value);
      if (!text.trim() && !drawing) {
        return { ...base, isCorrect: false, pointsEarned: 0 };
      }
      const accepted = question.acceptedAnswers ?? [];
      if (accepted.length === 0 || !text.trim()) {
        return {
          ...base,
          isCorrect: null,
          pointsEarned: 0,
          feedback: drawing
            ? 'El yazısı — manuel değerlendirme'
            : 'Manuel değerlendirme gerekir',
        };
      }
      const ok = answersMatch(text, accepted, !!question.caseSensitive);
      return {
        ...base,
        isCorrect: ok,
        pointsEarned: ok ? question.points : 0,
      };
    }
    case 'sayisal': {
      const raw = extractTextAnswer(value).replace(',', '.');
      const num = Number(raw);
      if (raw.trim() === '' || Number.isNaN(num)) {
        return { ...base, isCorrect: false, pointsEarned: 0 };
      }
      const expected = question.numericAnswer ?? 0;
      const tol = question.numericTolerance ?? 0;
      const ok = Math.abs(num - expected) <= tol;
      return {
        ...base,
        isCorrect: ok,
        pointsEarned: ok ? question.points : 0,
      };
    }
    case 'eslestirme': {
      const map = (value ?? {}) as Record<string, string>;
      const pairs = question.pairs ?? [];
      if (pairs.length === 0) {
        return { ...base, isCorrect: true, pointsEarned: question.points };
      }
      let correctCount = 0;
      for (const p of pairs) {
        if (map[p.id] === p.right) correctCount += 1;
      }
      const ratio = correctCount / pairs.length;
      const earned = Math.round(question.points * ratio * 100) / 100;
      return {
        ...base,
        isCorrect: ratio === 1,
        pointsEarned: earned,
      };
    }
    case 'siralama': {
      const given = (value ?? []) as string[];
      const expected = question.orderItems ?? [];
      if (expected.length === 0) {
        return { ...base, isCorrect: true, pointsEarned: question.points };
      }
      const ok =
        given.length === expected.length &&
        given.every((g, i) => g === expected[i]);
      return {
        ...base,
        isCorrect: ok,
        pointsEarned: ok ? question.points : 0,
      };
    }
    case 'siniflandirma': {
      const map = (value ?? {}) as Record<string, string>;
      const items = question.classifyItems ?? [];
      if (items.length === 0) {
        return { ...base, isCorrect: true, pointsEarned: question.points };
      }
      let hit = 0;
      for (const it of items) {
        if (map[it.id] === it.categoryId) hit += 1;
      }
      const ratio = hit / items.length;
      return {
        ...base,
        isCorrect: ratio === 1,
        pointsEarned: Math.round(question.points * ratio * 100) / 100,
      };
    }
    case 'likert': {
      const n = Number(value);
      const min = question.likertMin ?? 1;
      const max = question.likertMax ?? 5;
      if (!n || n < min || n > max) {
        return { ...base, isCorrect: null, pointsEarned: 0 };
      }
      // Likert genelde doğru/yanlış değil — tam puan verilir (katılım)
      return {
        ...base,
        isCorrect: true,
        pointsEarned: question.points,
        feedback: `Seçim: ${n}`,
      };
    }
    case 'el_yazisi': {
      const drawing = extractDrawing(value) || (typeof value === 'string' ? value : '');
      if (!drawing) {
        return { ...base, isCorrect: false, pointsEarned: 0 };
      }
      return {
        ...base,
        isCorrect: null,
        pointsEarned: 0,
        feedback: 'El yazısı — öğretmen değerlendirmesi gerekir',
      };
    }
    default:
      return base;
  }
}

export function gradeAttempt(
  questions: Question[],
  answers: Record<string, unknown>,
): { records: AnswerRecord[]; score: number; maxScore: number; percent: number } {
  const records = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const score = records.reduce((s, r) => s + r.pointsEarned, 0);
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return { records, score, maxScore, percent };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
