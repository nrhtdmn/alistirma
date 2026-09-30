import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import { ensureSeeded } from '../db/seed';
import type { Attempt, ContentItem, Folder, User } from '../types';
import { uid } from '../utils/id';
import { USER_COLORS } from '../types';

interface AppState {
  ready: boolean;
  users: User[];
  folders: Folder[];
  items: ContentItem[];
  attempts: Attempt[];
  currentUser: User | null;
  setCurrentUserId: (id: string) => Promise<void>;
  addUser: (data: Omit<User, 'id' | 'createdAt'>) => Promise<string>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addFolder: (data: {
    name: string;
    parentId: string | null;
    color?: string;
  }) => Promise<string>;
  updateFolder: (folder: Folder) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  saveItem: (item: ContentItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  saveAttempt: (attempt: Attempt) => Promise<void>;
  deleteAttempt: (id: string) => Promise<void>;
  refresh: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSeeded();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const sub = liveQuery(async () => {
      const [u, f, i, a, m] = await Promise.all([
        db.users.toArray(),
        db.folders.toArray(),
        db.items.toArray(),
        db.attempts.toArray(),
        db.meta.get('app'),
      ]);
      return { u, f, i, a, currentUserId: m?.currentUserId ?? null };
    }).subscribe({
      next: (data) => {
        setUsers(data.u.sort((a, b) => a.name.localeCompare(b.name, 'tr')));
        setFolders(data.f);
        setItems(data.i.sort((a, b) => b.updatedAt - a.updatedAt));
        setAttempts(data.a.sort((a, b) => b.completedAt - a.completedAt));
        setCurrentUserIdState(data.currentUserId);
      },
      error: console.error,
    });
    return () => sub.unsubscribe();
  }, [ready, tick]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? users[0] ?? null,
    [users, currentUserId],
  );

  const setCurrentUserId = useCallback(async (id: string) => {
    const meta = (await db.meta.get('app')) ?? {
      id: 'app',
      currentUserId: null,
      lastBackupAt: null,
    };
    await db.meta.put({ ...meta, currentUserId: id });
  }, []);

  const addUser = useCallback(
    async (data: Omit<User, 'id' | 'createdAt'>) => {
      const id = uid();
      await db.users.add({ ...data, id, createdAt: Date.now() });
      return id;
    },
    [],
  );

  const updateUser = useCallback(async (user: User) => {
    await db.users.put(user);
  }, []);

  const deleteUser = useCallback(
    async (id: string) => {
      if (users.length <= 1) throw new Error('En az bir kullanıcı kalmalı');
      await db.users.delete(id);
      if (currentUserId === id) {
        const next = users.find((u) => u.id !== id);
        if (next) await setCurrentUserId(next.id);
      }
    },
    [users, currentUserId, setCurrentUserId],
  );

  const addFolder = useCallback(
    async (data: { name: string; parentId: string | null; color?: string }) => {
      if (!currentUser) throw new Error('Önce bir kullanıcı seçin');
      const parentId = data.parentId ?? null;
      if (parentId) {
        const parent = await db.folders.get(parentId);
        if (!parent) throw new Error('Üst klasör bulunamadı');
      }
      const siblings = await db.folders
        .filter((f) => f.parentId === parentId)
        .toArray();
      const id = uid();
      await db.folders.add({
        id,
        parentId,
        name: data.name.trim(),
        ownerId: currentUser.id,
        color: data.color ?? USER_COLORS[siblings.length % USER_COLORS.length],
        order: siblings.length,
        createdAt: Date.now(),
      });
      return id;
    },
    [currentUser],
  );

  const updateFolder = useCallback(async (folder: Folder) => {
    await db.folders.put(folder);
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    const all = await db.folders.toArray();
    const toDelete = new Set<string>();
    const walk = (fid: string) => {
      toDelete.add(fid);
      all.filter((f) => f.parentId === fid).forEach((c) => walk(c.id));
    };
    walk(id);
    await db.transaction('rw', db.folders, db.items, async () => {
      await db.folders.bulkDelete([...toDelete]);
      const itemIds = (
        await db.items
          .filter((i) => i.folderId !== null && toDelete.has(i.folderId))
          .toArray()
      ).map((i) => i.id);
      await db.items.bulkDelete(itemIds);
    });
  }, []);

  const saveItem = useCallback(async (item: ContentItem) => {
    await db.items.put({ ...item, updatedAt: Date.now() });
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    await db.transaction('rw', db.items, db.attempts, async () => {
      await db.items.delete(id);
      const att = await db.attempts.where('itemId').equals(id).primaryKeys();
      await db.attempts.bulkDelete(att);
    });
  }, []);

  const saveAttempt = useCallback(async (attempt: Attempt) => {
    await db.attempts.put(attempt);
  }, []);

  const deleteAttempt = useCallback(async (id: string) => {
    await db.attempts.delete(id);
  }, []);

  const value: AppState = {
    ready,
    users,
    folders,
    items,
    attempts,
    currentUser,
    setCurrentUserId,
    addUser,
    updateUser,
    deleteUser,
    addFolder,
    updateFolder,
    deleteFolder,
    saveItem,
    deleteItem,
    saveAttempt,
    deleteAttempt,
    refresh: () => setTick((t) => t + 1),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp AppProvider içinde kullanılmalı');
  return ctx;
}
