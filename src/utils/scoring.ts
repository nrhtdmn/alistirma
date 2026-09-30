import type { AnswerRecord, Question } from '../types';

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
    case 'bosluk_doldurma':
    case 'acik_uclu':
    case 'matematik': {
      const text = String(value ?? '');
      if (!text.trim()) {
        return { ...base, isCorrect: false, pointsEarned: 0 };
      }
      const accepted = question.acceptedAnswers ?? [];
      if (accepted.length === 0) {
        return {
          ...base,
          isCorrect: null,
          pointsEarned: 0,
          feedback: 'Manuel değerlendirme gerekir',
        };
      }
      const ok = answersMatch(text, accepted, !!question.caseSensitive);
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
