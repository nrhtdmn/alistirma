import { saveAs } from 'file-saver';
import type { Attempt, ContentItem, User } from '../types';
import {
  ITEM_TYPE_LABELS,
  SUBJECT_LABELS,
} from '../types';
import { formatDate, formatDuration, formatPercent } from './format';
import { extractDrawing, extractTextAnswer } from './scoring';

export interface ExamShareBundle {
  version: 1;
  kind: 'alistirma-sinav-sonucu';
  exportedAt: number;
  app: string;
  exam: {
    title: string;
    type: string;
    subject: string;
    gradeLevel: string;
  };
  student: {
    name: string;
    role?: string;
  };
  result: {
    score: number;
    maxScore: number;
    percent: number;
    durationSeconds: number;
    completedAt: number;
    passed: boolean;
    passScorePercent: number;
  };
  answers: Array<{
    no: number;
    prompt: string;
    answer: string;
    hasDrawing: boolean;
    isCorrect: boolean | null;
    pointsEarned: number;
    points: number;
  }>;
  /** İçe aktarım için ham kayıt */
  attempt: Attempt;
  itemSnapshot?: Pick<
    ContentItem,
    'id' | 'title' | 'type' | 'subject' | 'gradeLevel' | 'questions' | 'settings'
  >;
}

function answerLabel(value: unknown): string {
  if (value == null || value === '') return '—';
  const text = extractTextAnswer(value);
  const drawing = extractDrawing(value);
  if (text && drawing) return `${text} [el yazısı var]`;
  if (drawing) return '[El yazısı / çizim]';
  if (text) return text;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function buildExamShareBundle(
  item: ContentItem,
  attempt: Attempt,
  user: User | null,
): ExamShareBundle {
  const passed = attempt.percent >= item.settings.passScorePercent;
  return {
    version: 1,
    kind: 'alistirma-sinav-sonucu',
    exportedAt: Date.now(),
    app: 'Alıştırma',
    exam: {
      title: item.title,
      type: ITEM_TYPE_LABELS[item.type],
      subject: SUBJECT_LABELS[item.subject],
      gradeLevel: item.gradeLevel,
    },
    student: {
      name: user?.name ?? 'Öğrenci',
      role: user?.role,
    },
    result: {
      score: attempt.score,
      maxScore: attempt.maxScore,
      percent: attempt.percent,
      durationSeconds: attempt.durationSeconds,
      completedAt: attempt.completedAt,
      passed,
      passScorePercent: item.settings.passScorePercent,
    },
    answers: item.questions.map((q, i) => {
      const rec = attempt.answers.find((a) => a.questionId === q.id);
      return {
        no: i + 1,
        prompt: q.prompt,
        answer: answerLabel(rec?.value),
        hasDrawing: !!extractDrawing(rec?.value),
        isCorrect: rec?.isCorrect ?? null,
        pointsEarned: rec?.pointsEarned ?? 0,
        points: q.points,
      };
    }),
    attempt,
    itemSnapshot: {
      id: item.id,
      title: item.title,
      type: item.type,
      subject: item.subject,
      gradeLevel: item.gradeLevel,
      questions: item.questions,
      settings: item.settings,
    },
  };
}

export function examShareText(bundle: ExamShareBundle): string {
  const lines = [
    `Alıştırma — Sınav Sonucu`,
    ``,
    `Öğrenci: ${bundle.student.name}`,
    `Sınav: ${bundle.exam.title}`,
    `Tür: ${bundle.exam.type} · ${bundle.exam.subject}`,
    `Seviye: ${bundle.exam.gradeLevel}`,
    ``,
    `Puan: ${bundle.result.score}/${bundle.result.maxScore} (${formatPercent(bundle.result.percent)})`,
    `Durum: ${bundle.result.passed ? 'Geçti' : 'Geçemedi'} (baraj %${bundle.result.passScorePercent})`,
    `Süre: ${formatDuration(bundle.result.durationSeconds)}`,
    `Tarih: ${formatDate(bundle.result.completedAt)}`,
    ``,
    `--- Cevaplar ---`,
  ];
  for (const a of bundle.answers) {
    const mark =
      a.isCorrect === true ? '✓' : a.isCorrect === false ? '✗' : '?';
    lines.push(
      `${a.no}. [${mark}] ${a.prompt}`,
      `   Cevap: ${a.answer} (${a.pointsEarned}/${a.points})`,
    );
  }
  lines.push(``, `Alıştırma uygulaması ile paylaşıldı.`);
  return lines.join('\n');
}

export async function shareExamResult(
  item: ContentItem,
  attempt: Attempt,
  user: User | null,
): Promise<'shared' | 'downloaded' | 'copied'> {
  const bundle = buildExamShareBundle(item, attempt, user);
  const text = examShareText(bundle);
  const fileName = `sinav-sonucu-${safeName(item.title)}-${dateStamp()}.json`;
  const jsonBlob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const jsonFile = new File([jsonBlob], fileName, {
    type: 'application/json',
  });

  // 1) Native share (telefon / destekleyen tarayıcı)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [jsonFile] })) {
        await navigator.share({
          title: `${item.title} — Sonuç`,
          text,
          files: [jsonFile],
        });
        return 'shared';
      }
      await navigator.share({
        title: `${item.title} — Sonuç`,
        text,
      });
      // Metin paylaşıldı; JSON'u da indir
      saveAs(jsonBlob, fileName);
      return 'shared';
    } catch (e) {
      // Kullanıcı iptal ettiyse sessiz çık
      if (e instanceof Error && e.name === 'AbortError') {
        throw e;
      }
    }
  }

  // 2) Panoya metin + JSON indir
  try {
    await navigator.clipboard.writeText(text);
    saveAs(jsonBlob, fileName);
    return 'copied';
  } catch {
    saveAs(jsonBlob, fileName);
    return 'downloaded';
  }
}

function safeName(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9ğüşıöç\-]+/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
