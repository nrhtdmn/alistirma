import Dexie, { type Table } from 'dexie';
import type { AppMeta, Attempt, ContentItem, Folder, User } from '../types';

export class AlistirmaDB extends Dexie {
  users!: Table<User, string>;
  folders!: Table<Folder, string>;
  items!: Table<ContentItem, string>;
  attempts!: Table<Attempt, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('alistirma-db');
    this.version(1).stores({
      users: 'id, name, role',
      folders: 'id, parentId, ownerId, order',
      items: 'id, folderId, ownerId, type, subject, updatedAt',
      attempts: 'id, itemId, userId, completedAt',
      meta: 'id',
    });
  }
}

export const db = new AlistirmaDB();
