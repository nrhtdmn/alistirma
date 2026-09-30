import Dexie, { type Table } from 'dexie';
import type {
  AppMeta,
  Assignment,
  Attempt,
  CardReviewState,
  ContentItem,
  Folder,
  ReviewLogEntry,
  User,
} from '../types';

export class AlistirmaDB extends Dexie {
  users!: Table<User, string>;
  folders!: Table<Folder, string>;
  items!: Table<ContentItem, string>;
  attempts!: Table<Attempt, string>;
  meta!: Table<AppMeta, string>;
  cardReviews!: Table<CardReviewState, string>;
  reviewLogs!: Table<ReviewLogEntry, string>;
  assignments!: Table<Assignment, string>;

  constructor() {
    super('alistirma-db');
    this.version(1).stores({
      users: 'id, name, role',
      folders: 'id, parentId, ownerId, order',
      items: 'id, folderId, ownerId, type, subject, updatedAt',
      attempts: 'id, itemId, userId, completedAt',
      meta: 'id',
    });
    this.version(2).stores({
      users: 'id, name, role',
      folders: 'id, parentId, ownerId, order',
      items: 'id, folderId, ownerId, type, subject, updatedAt',
      attempts: 'id, itemId, userId, completedAt',
      meta: 'id',
      cardReviews: 'id, userId, itemId, cardId, dueAt, state',
      reviewLogs: 'id, userId, itemId, reviewedAt',
    });
    this.version(3).stores({
      users: 'id, name, role',
      folders: 'id, parentId, ownerId, order',
      items: 'id, folderId, ownerId, type, subject, updatedAt',
      attempts: 'id, itemId, userId, completedAt',
      meta: 'id',
      cardReviews: 'id, userId, itemId, cardId, dueAt, state',
      reviewLogs: 'id, userId, itemId, reviewedAt',
      assignments: 'id, assignedBy, createdAt',
    });
  }
}

export const db = new AlistirmaDB();
