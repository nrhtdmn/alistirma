import { db } from './database';
import type { ContentItem, Folder, User } from '../types';
import { DEFAULT_DECK_OPTIONS, DEFAULT_SETTINGS } from '../types';
import { uid } from '../utils/id';

export async function ensureSeeded(): Promise<void> {
  const count = await db.users.count();
  if (count > 0) {
    const meta = await db.meta.get('app');
    if (!meta) {
      const first = await db.users.toCollection().first();
      await db.meta.put({
        id: 'app',
        currentUserId: first?.id ?? null,
        lastBackupAt: null,
      });
    }
    return;
  }

  const teacherId = uid();
  const studentId = uid();
  const parentId = uid();
  const now = Date.now();

  const users: User[] = [
    {
      id: teacherId,
      name: 'Öğretmen',
      role: 'ogretmen',
      color: '#0B4F54',
      createdAt: now,
    },
    {
      id: studentId,
      name: 'Öğrenci',
      role: 'ogrenci',
      color: '#2F5D9F',
      createdAt: now,
    },
    {
      id: parentId,
      name: 'Veli',
      role: 'veli',
      color: '#C45C26',
      createdAt: now,
    },
  ];

  const rootMath: Folder = {
    id: uid(),
    parentId: null,
    name: 'Matematik',
    ownerId: teacherId,
    color: '#0B4F54',
    order: 0,
    createdAt: now,
  };
  const rootTurkce: Folder = {
    id: uid(),
    parentId: null,
    name: 'Türkçe',
    ownerId: teacherId,
    color: '#C45C26',
    order: 1,
    createdAt: now,
  };
  const rootFen: Folder = {
    id: uid(),
    parentId: null,
    name: 'Fen',
    ownerId: teacherId,
    color: '#1E6B5C',
    order: 2,
    createdAt: now,
  };
  const subSinif1: Folder = {
    id: uid(),
    parentId: rootMath.id,
    name: '1. Sınıf',
    ownerId: teacherId,
    color: '#0F766E',
    order: 0,
    createdAt: now,
  };

  const rootIngilizce: Folder = {
    id: uid(),
    parentId: null,
    name: 'İngilizce',
    ownerId: teacherId,
    color: '#2F5D9F',
    order: 3,
    createdAt: now,
  };

  const sample: ContentItem = {
    id: uid(),
    folderId: subSinif1.id,
    ownerId: teacherId,
    type: 'alistirma',
    title: 'Toplama Alıştırması',
    description: 'Temel toplama işlemleri — örnek içerik',
    subject: 'matematik',
    gradeLevel: '1. Sınıf',
    settings: { ...DEFAULT_SETTINGS },
    createdAt: now,
    updatedAt: now,
    questions: [
      {
        id: uid(),
        type: 'coktan_secmeli',
        prompt: '2 + 3 = ?',
        points: 10,
        options: [
          { id: uid(), text: '4', isCorrect: false },
          { id: uid(), text: '5', isCorrect: true },
          { id: uid(), text: '6', isCorrect: false },
          { id: uid(), text: '7', isCorrect: false },
        ],
      },
      {
        id: uid(),
        type: 'matematik',
        prompt: 'Sonucu yazın:',
        latex: '7 + 8',
        points: 10,
        acceptedAnswers: ['15'],
      },
      {
        id: uid(),
        type: 'dogru_yanlis',
        prompt: '10 - 4 = 6',
        points: 10,
        options: [
          { id: 'true', text: 'Doğru', isCorrect: true },
          { id: 'false', text: 'Yanlış', isCorrect: false },
        ],
      },
    ],
  };

  const sampleTurkce: ContentItem = {
    id: uid(),
    folderId: rootTurkce.id,
    ownerId: teacherId,
    type: 'test',
    title: 'İsim ve Fiil',
    description: 'Temel dil bilgisi',
    subject: 'turkce',
    gradeLevel: '3. Sınıf',
    settings: { ...DEFAULT_SETTINGS },
    createdAt: now,
    updatedAt: now,
    questions: [
      {
        id: uid(),
        type: 'coktan_secmeli',
        prompt: '"Koşmak" hangi sözcük türüdür?',
        points: 10,
        options: [
          { id: uid(), text: 'İsim', isCorrect: false },
          { id: uid(), text: 'Fiil', isCorrect: true },
          { id: uid(), text: 'Sıfat', isCorrect: false },
          { id: uid(), text: 'Zarf', isCorrect: false },
        ],
      },
      {
        id: uid(),
        type: 'bosluk_doldurma',
        prompt: 'Türkiye\'nin başkenti ………\'dır.',
        points: 10,
        acceptedAnswers: ['Ankara', 'ankara'],
      },
    ],
  };

  const sampleCards: ContentItem = {
    id: uid(),
    folderId: rootIngilizce.id,
    ownerId: teacherId,
    type: 'kartlar',
    title: 'Temel Kelimeler',
    description: 'İngilizce–Türkçe kelime kartları',
    subject: 'ingilizce',
    gradeLevel: '5. Sınıf',
    settings: { ...DEFAULT_SETTINGS, shuffleQuestions: true },
    deckOptions: { ...DEFAULT_DECK_OPTIONS },
    createdAt: now,
    updatedAt: now,
    questions: [],
    cards: [
      {
        id: uid(),
        front: 'apple',
        back: 'elma',
        hint: '/ˈæp.əl/',
        example: 'I eat an apple every day.',
      },
      {
        id: uid(),
        front: 'book',
        back: 'kitap',
        example: 'This book is interesting.',
      },
      {
        id: uid(),
        front: 'friend',
        back: 'arkadaş',
        example: 'She is my best friend.',
      },
      {
        id: uid(),
        front: 'school',
        back: 'okul',
        example: 'We go to school by bus.',
      },
      {
        id: uid(),
        front: 'water',
        back: 'su',
        example: 'Please drink some water.',
      },
    ],
  };

  const sampleEs: ContentItem = {
    id: uid(),
    folderId: rootTurkce.id,
    ownerId: teacherId,
    type: 'kartlar',
    title: 'Eş Anlamlılar',
    description: 'Türkçe eş anlamlı kelimeler',
    subject: 'turkce',
    gradeLevel: '4. Sınıf',
    cardKind: 'es_anlamli',
    settings: { ...DEFAULT_SETTINGS },
    deckOptions: { ...DEFAULT_DECK_OPTIONS, enableReverse: true },
    createdAt: now,
    updatedAt: now,
    questions: [],
    cards: [
      { id: uid(), kind: 'es_anlamli', front: 'güzel', back: 'hoş, latif' },
      { id: uid(), kind: 'es_anlamli', front: 'hızlı', back: 'çabuk, süratli' },
      { id: uid(), kind: 'es_anlamli', front: 'akıllı', back: 'zeki, uslu' },
      { id: uid(), kind: 'es_anlamli', front: 'mutlu', back: 'sevinçli, mesut' },
    ],
  };

  const sampleZit: ContentItem = {
    id: uid(),
    folderId: rootTurkce.id,
    ownerId: teacherId,
    type: 'kartlar',
    title: 'Zıt Anlamlılar',
    description: 'Türkçe zıt anlamlı kelimeler',
    subject: 'turkce',
    gradeLevel: '4. Sınıf',
    cardKind: 'zit_anlamli',
    settings: { ...DEFAULT_SETTINGS },
    deckOptions: { ...DEFAULT_DECK_OPTIONS, enableReverse: true },
    createdAt: now,
    updatedAt: now,
    questions: [],
    cards: [
      { id: uid(), kind: 'zit_anlamli', front: 'sıcak', back: 'soğuk' },
      { id: uid(), kind: 'zit_anlamli', front: 'uzun', back: 'kısa' },
      { id: uid(), kind: 'zit_anlamli', front: 'açık', back: 'kapalı' },
      { id: uid(), kind: 'zit_anlamli', front: 'iyi', back: 'kötü' },
    ],
  };

  const sampleAtasozu: ContentItem = {
    id: uid(),
    folderId: rootTurkce.id,
    ownerId: teacherId,
    type: 'kartlar',
    title: 'Atasözleri',
    description: 'Atasözü ve anlamı',
    subject: 'turkce',
    gradeLevel: '5. Sınıf',
    cardKind: 'atasozu',
    settings: { ...DEFAULT_SETTINGS },
    deckOptions: { ...DEFAULT_DECK_OPTIONS, enableReverse: false },
    createdAt: now,
    updatedAt: now,
    questions: [],
    cards: [
      {
        id: uid(),
        kind: 'atasozu',
        front: 'Damlaya damlaya göl olur',
        back: 'Küçük birikimler büyük sonuç doğurur',
      },
      {
        id: uid(),
        kind: 'atasozu',
        front: 'Ayağını yorganına göre uzat',
        back: 'İmkânına göre harca / yaşa',
      },
      {
        id: uid(),
        kind: 'atasozu',
        front: 'Komşu komşunun külüne muhtaçtır',
        back: 'İnsanlar birbirine ihtiyaç duyar',
      },
    ],
  };

  const sampleDeyim: ContentItem = {
    id: uid(),
    folderId: rootTurkce.id,
    ownerId: teacherId,
    type: 'kartlar',
    title: 'Deyimler',
    description: 'Deyim ve anlamı',
    subject: 'turkce',
    gradeLevel: '5. Sınıf',
    cardKind: 'deyim',
    settings: { ...DEFAULT_SETTINGS },
    deckOptions: { ...DEFAULT_DECK_OPTIONS, enableReverse: false },
    createdAt: now,
    updatedAt: now,
    questions: [],
    cards: [
      {
        id: uid(),
        kind: 'deyim',
        front: 'Gözden düşmek',
        back: 'İtibarını / değerini yitirmek',
      },
      {
        id: uid(),
        kind: 'deyim',
        front: 'Kulak kabartmak',
        back: 'Dikkatle dinlemek',
      },
      {
        id: uid(),
        kind: 'deyim',
        front: 'Etekleri zil çalmak',
        back: 'Çok sevinmek',
      },
    ],
  };

  await db.transaction(
    'rw',
    db.users,
    db.folders,
    db.items,
    db.meta,
    async () => {
      await db.users.bulkAdd(users);
      await db.folders.bulkAdd([
        rootMath,
        rootTurkce,
        rootFen,
        rootIngilizce,
        subSinif1,
      ]);
      await db.items.bulkAdd([
        sample,
        sampleTurkce,
        sampleCards,
        sampleEs,
        sampleZit,
        sampleAtasozu,
        sampleDeyim,
      ]);
      await db.meta.put({
        id: 'app',
        currentUserId: teacherId,
        lastBackupAt: null,
      });
    },
  );
}
