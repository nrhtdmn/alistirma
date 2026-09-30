import { saveAs } from 'file-saver';
import { db } from '../db/database';
import type { Attempt, ContentItem, ExportBundle, User } from '../types';
import { DEFAULT_SETTINGS, USER_COLORS } from '../types';
import type { AssignmentResultsBundle } from '../utils/shareAssignments';
import type { ExamShareBundle } from '../utils/shareExam';

export async function exportAll(): Promise<void> {
  const [users, folders, items, attempts, cardReviews, reviewLogs, assignments] =
    await Promise.all([
      db.users.toArray(),
      db.folders.toArray(),
      db.items.toArray(),
      db.attempts.toArray(),
      db.cardReviews.toArray(),
      db.reviewLogs.toArray(),
      db.assignments.toArray(),
    ]);
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: Date.now(),
    app: 'Alıştırma',
    users,
    folders,
    items,
    attempts,
    cardReviews,
    reviewLogs,
    assignments,
  };
  downloadJson(bundle, `alistirma-yedek-${dateStamp()}.json`);
}

export async function exportItems(itemIds: string[]): Promise<void> {
  const items = await db.items.bulkGet(itemIds);
  const clean = items.filter(Boolean);
  const folderIds = [
    ...new Set(clean.map((i) => i!.folderId).filter(Boolean)),
  ] as string[];
  const folders = await collectFolderAncestors(folderIds);
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: Date.now(),
    app: 'Alıştırma',
    folders,
    items: clean as NonNullable<(typeof items)[number]>[],
  };
  downloadJson(bundle, `alistirma-icerik-${dateStamp()}.json`);
}

export async function exportFolderTree(folderId: string): Promise<void> {
  const allFolders = await db.folders.toArray();
  const ids = new Set<string>();
  const collect = (id: string) => {
    ids.add(id);
    allFolders.filter((f) => f.parentId === id).forEach((c) => collect(c.id));
  };
  collect(folderId);
  const folders = allFolders.filter((f) => ids.has(f.id));
  const items = await db.items
    .filter((i) => i.folderId !== null && ids.has(i.folderId))
    .toArray();
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: Date.now(),
    app: 'Alıştırma',
    folders,
    items,
  };
  downloadJson(bundle, `alistirma-klasor-${dateStamp()}.json`);
}

export async function exportAttempts(attemptIds: string[]): Promise<void> {
  const attempts = (await db.attempts.bulkGet(attemptIds)).filter(Boolean);
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: Date.now(),
    app: 'Alıştırma',
    attempts: attempts as NonNullable<(typeof attempts)[number]>[],
  };
  downloadJson(bundle, `alistirma-sonuclar-${dateStamp()}.json`);
}

export type ImportMode = 'merge' | 'replace';

export async function importBundle(
  file: File,
  mode: ImportMode = 'merge',
): Promise<{
  users: number;
  folders: number;
  items: number;
  attempts: number;
  cardReviews: number;
  reviewLogs: number;
  kind?: string;
  studentName?: string;
}> {
  const text = await file.text();
  const raw = JSON.parse(text) as
    | ExportBundle
    | ExamShareBundle
    | AssignmentResultsBundle;

  if (raw && 'kind' in raw && raw.kind === 'alistirma-atama-sonuclari') {
    return importAssignmentResults(raw as AssignmentResultsBundle, mode);
  }

  if (
    raw &&
    'kind' in raw &&
    raw.kind === 'alistirma-sinav-sonucu' &&
    raw.attempt
  ) {
    const attempt = raw.attempt as Attempt;
    const snap = raw.itemSnapshot;
    const studentName =
      'student' in raw && raw.student?.name ? raw.student.name : undefined;
    if (mode === 'replace') {
      await clearAllTables();
    }
    await db.transaction('rw', db.users, db.items, db.attempts, async () => {
      if (studentName) {
        await ensureStudentUser(attempt.userId, studentName);
      }
      if (snap && !(await db.items.get(snap.id))) {
        const item: ContentItem = {
          id: snap.id,
          folderId: null,
          ownerId: attempt.userId,
          type: snap.type,
          title: snap.title,
          description: '',
          subject: snap.subject,
          gradeLevel: snap.gradeLevel,
          questions: snap.questions,
          settings: snap.settings ?? { ...DEFAULT_SETTINGS },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.items.put(item);
      }
      await db.attempts.put(attempt);
    });
    return {
      users: studentName ? 1 : 0,
      folders: 0,
      items: snap ? 1 : 0,
      attempts: 1,
      cardReviews: 0,
      reviewLogs: 0,
      kind: 'sinav-sonucu',
      studentName,
    };
  }

  const data = raw as ExportBundle;
  if (!data || data.version !== 1) {
    throw new Error('Geçersiz dosya formatı');
  }

  if (mode === 'replace') {
    await clearAllTables();
  }

  const users = data.users ?? [];
  const folders = data.folders ?? [];
  const items = data.items ?? [];
  const attempts = data.attempts ?? [];
  const cardReviews = data.cardReviews ?? [];
  const reviewLogs = data.reviewLogs ?? [];
  const assignments = data.assignments ?? [];

  await db.transaction('rw', db.tables, async () => {
    if (users.length) await db.users.bulkPut(users);
    if (folders.length) await db.folders.bulkPut(folders);
    if (items.length) await db.items.bulkPut(items);
    if (attempts.length) await db.attempts.bulkPut(attempts);
    if (cardReviews.length) await db.cardReviews.bulkPut(cardReviews);
    if (reviewLogs.length) await db.reviewLogs.bulkPut(reviewLogs);
    if (assignments.length) await db.assignments.bulkPut(assignments);
  });

  await db.meta.put({
    id: 'app',
    currentUserId: (await db.meta.get('app'))?.currentUserId ?? null,
    lastBackupAt: Date.now(),
  });

  return {
    users: users.length,
    folders: folders.length,
    items: items.length,
    attempts: attempts.length,
    cardReviews: cardReviews.length,
    reviewLogs: reviewLogs.length,
  };
}

async function importAssignmentResults(
  bundle: AssignmentResultsBundle,
  mode: ImportMode,
): Promise<{
  users: number;
  folders: number;
  items: number;
  attempts: number;
  cardReviews: number;
  reviewLogs: number;
  kind: string;
  studentName: string;
}> {
  if (mode === 'replace') {
    await clearAllTables();
  }

  const now = Date.now();
  await db.transaction(
    'rw',
    db.users,
    db.items,
    db.attempts,
    db.assignments,
    async () => {
      await ensureStudentUser(
        bundle.student.id,
        bundle.student.name,
        bundle.student.color,
        bundle.student.role,
      );

      for (const snap of bundle.items) {
        const existing = await db.items.get(snap.id);
        if (!existing) {
          const item: ContentItem = {
            id: snap.id,
            folderId: null,
            ownerId: bundle.student.id,
            type: snap.type,
            title: snap.title,
            description: snap.description ?? '',
            subject: snap.subject,
            gradeLevel: snap.gradeLevel,
            questions: snap.questions ?? [],
            cards: snap.cards,
            cardKind: snap.cardKind,
            deckOptions: snap.deckOptions,
            settings: snap.settings ?? { ...DEFAULT_SETTINGS },
            createdAt: now,
            updatedAt: now,
          };
          await db.items.put(item);
        }
      }

      if (bundle.attempts.length) {
        await db.attempts.bulkPut(bundle.attempts);
      }

      if (bundle.assignments?.length) {
        for (const a of bundle.assignments) {
          const existing = await db.assignments.get(a.id);
          if (existing) {
            const studentIds = existing.studentIds.includes(bundle.student.id)
              ? existing.studentIds
              : [...existing.studentIds, bundle.student.id];
            await db.assignments.put({ ...existing, studentIds });
          }
        }
      }
    },
  );

  return {
    users: 1,
    folders: 0,
    items: bundle.items.length,
    attempts: bundle.attempts.length,
    cardReviews: 0,
    reviewLogs: 0,
    kind: 'atama-sonuclari',
    studentName: bundle.student.name,
  };
}

async function ensureStudentUser(
  id: string,
  name: string,
  color?: string,
  role: User['role'] = 'ogrenci',
) {
  const existing = await db.users.get(id);
  if (existing) return;
  const user: User = {
    id,
    name,
    role,
    color: color ?? USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)],
    createdAt: Date.now(),
  };
  await db.users.put(user);
}

async function clearAllTables() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all([
      db.users.clear(),
      db.folders.clear(),
      db.items.clear(),
      db.attempts.clear(),
      db.cardReviews.clear(),
      db.reviewLogs.clear(),
      db.assignments.clear(),
    ]);
  });
}

async function collectFolderAncestors(folderIds: string[]) {
  const all = await db.folders.toArray();
  const byId = new Map(all.map((f) => [f.id, f]));
  const result = new Map<string, (typeof all)[number]>();
  for (const id of folderIds) {
    let cur: string | null = id;
    while (cur) {
      const f = byId.get(cur);
      if (!f || result.has(f.id)) break;
      result.set(f.id, f);
      cur = f.parentId;
    }
  }
  return [...result.values()];
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  saveAs(blob, filename);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
