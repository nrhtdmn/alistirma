import { saveAs } from 'file-saver';
import type {
  Assignment,
  Attempt,
  ContentItem,
  User,
} from '../types';
import {
  ITEM_TYPE_LABELS,
} from '../types';
import { formatDate, formatPercent } from './format';

export interface AssignmentResultsBundle {
  version: 1;
  kind: 'alistirma-atama-sonuclari';
  exportedAt: number;
  app: string;
  student: Pick<User, 'id' | 'name' | 'role' | 'color'>;
  /** Özet satırlar (okunabilir) */
  summary: Array<{
    assignmentTitle: string;
    itemTitle: string;
    itemType: string;
    percent: number;
    score: number;
    maxScore: number;
    completedAt: number;
  }>;
  /** İçe aktarım için */
  attempts: Attempt[];
  items: Array<
    Pick<
      ContentItem,
      | 'id'
      | 'title'
      | 'type'
      | 'subject'
      | 'gradeLevel'
      | 'questions'
      | 'settings'
      | 'cards'
      | 'cardKind'
      | 'deckOptions'
      | 'description'
    >
  >;
  assignments?: Array<
    Pick<Assignment, 'id' | 'title' | 'note' | 'itemIds' | 'dueAt' | 'createdAt'>
  >;
}

export function buildAssignmentResultsBundle(
  student: User,
  assignments: Assignment[],
  items: ContentItem[],
  attempts: Attempt[],
): AssignmentResultsBundle {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const relevantItemIds = new Set(
    assignments.flatMap((a) => a.itemIds),
  );

  const myAttempts = attempts.filter(
    (t) => t.userId === student.id && relevantItemIds.has(t.itemId),
  );

  // Her içerik için en son denemeyi al
  const latestByItem = new Map<string, Attempt>();
  for (const t of myAttempts) {
    const prev = latestByItem.get(t.itemId);
    if (!prev || t.completedAt > prev.completedAt) {
      latestByItem.set(t.itemId, t);
    }
  }
  const selectedAttempts = [...latestByItem.values()];

  const itemSnaps = selectedAttempts
    .map((t) => itemById.get(t.itemId))
    .filter(Boolean)
    .map((it) => ({
      id: it!.id,
      title: it!.title,
      type: it!.type,
      subject: it!.subject,
      gradeLevel: it!.gradeLevel,
      questions: it!.questions,
      settings: it!.settings,
      cards: it!.cards,
      cardKind: it!.cardKind,
      deckOptions: it!.deckOptions,
      description: it!.description,
    }));

  const summary: AssignmentResultsBundle['summary'] = [];
  for (const a of assignments) {
    for (const itemId of a.itemIds) {
      const att = latestByItem.get(itemId);
      const item = itemById.get(itemId);
      if (!att || !item) continue;
      summary.push({
        assignmentTitle: a.title,
        itemTitle: item.title,
        itemType: ITEM_TYPE_LABELS[item.type],
        percent: att.percent,
        score: att.score,
        maxScore: att.maxScore,
        completedAt: att.completedAt,
      });
    }
  }

  return {
    version: 1,
    kind: 'alistirma-atama-sonuclari',
    exportedAt: Date.now(),
    app: 'Alıştırma',
    student: {
      id: student.id,
      name: student.name,
      role: student.role,
      color: student.color,
    },
    summary,
    attempts: selectedAttempts,
    items: itemSnaps,
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      note: a.note,
      itemIds: a.itemIds,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
    })),
  };
}

export function assignmentResultsText(bundle: AssignmentResultsBundle): string {
  const lines = [
    `Alıştırma — Atama Sonuçları`,
    ``,
    `Öğrenci: ${bundle.student.name}`,
    `Tarih: ${formatDate(bundle.exportedAt)}`,
    `Tamamlanan: ${bundle.summary.length}`,
    ``,
  ];
  for (const row of bundle.summary) {
    lines.push(
      `• ${row.assignmentTitle} / ${row.itemTitle} (${row.itemType})`,
      `  ${row.score}/${row.maxScore} (${formatPercent(row.percent)}) — ${formatDate(row.completedAt)}`,
    );
  }
  if (bundle.summary.length === 0) {
    lines.push(`Henüz tamamlanmış sınav yok.`);
  }
  lines.push(``, `Alıştırma uygulaması ile paylaşıldı.`);
  return lines.join('\n');
}

export async function shareAssignmentResults(
  student: User,
  assignments: Assignment[],
  items: ContentItem[],
  attempts: Attempt[],
): Promise<'shared' | 'downloaded' | 'copied'> {
  const bundle = buildAssignmentResultsBundle(
    student,
    assignments,
    items,
    attempts,
  );
  if (bundle.attempts.length === 0) {
    throw new Error('Paylaşılacak tamamlanmış sınav yok');
  }

  const text = assignmentResultsText(bundle);
  const fileName = `atama-sonuclari-${safeName(student.name)}-${dateStamp()}.json`;
  const jsonBlob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json',
  });
  const jsonFile = new File([jsonBlob], fileName, {
    type: 'application/json',
  });

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [jsonFile] })) {
        await navigator.share({
          title: `${student.name} — Atama sonuçları`,
          text,
          files: [jsonFile],
        });
        return 'shared';
      }
      await navigator.share({
        title: `${student.name} — Atama sonuçları`,
        text,
      });
      saveAs(jsonBlob, fileName);
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
    }
  }

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
