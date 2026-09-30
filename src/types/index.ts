export type UserRole = 'ogretmen' | 'ogrenci' | 'veli' | 'diger';

export type ItemType = 'alistirma' | 'sinav' | 'test' | 'quiz' | 'kartlar';

export type QuestionType =
  | 'coktan_secmeli'
  | 'coklu_secim'
  | 'dogru_yanlis'
  | 'bosluk_doldurma'
  | 'acik_uclu'
  | 'eslestirme'
  | 'siralama'
  | 'matematik'
  | 'sayisal'
  | 'siniflandirma'
  | 'likert'
  | 'el_yazisi';

export type SubjectKey =
  | 'turkce'
  | 'matematik'
  | 'fen'
  | 'sosyal'
  | 'ingilizce'
  | 'almanca'
  | 'fransizca'
  | 'tarih'
  | 'cografya'
  | 'biyoloji'
  | 'fizik'
  | 'kimya'
  | 'felsefe'
  | 'din'
  | 'muzik'
  | 'resim'
  | 'beden'
  | 'bilgisayar'
  | 'ekonomi'
  | 'psikoloji'
  | 'diger';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  color: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  ownerId: string;
  color: string;
  order: number;
  createdAt: number;
}

export interface ChoiceOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface ClassifyCategory {
  id: string;
  name: string;
}

export interface ClassifyItem {
  id: string;
  text: string;
  categoryId: string;
}

/** Öğrenci cevabı: metin + isteğe bağlı kalem çizimi */
export interface HybridAnswer {
  text?: string;
  drawing?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  explanation?: string;
  options?: ChoiceOption[];
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  pairs?: MatchPair[];
  orderItems?: string[];
  latex?: string;
  imageData?: string;
  numericAnswer?: number;
  numericTolerance?: number;
  categories?: ClassifyCategory[];
  classifyItems?: ClassifyItem[];
  likertMin?: number;
  likertMax?: number;
  likertMinLabel?: string;
  likertMaxLabel?: string;
  allowHandwriting?: boolean;
}

export interface ItemSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultsImmediately: boolean;
  timeLimitMinutes: number | null;
  passScorePercent: number;
  allowReview: boolean;
}

export interface FlashCard {
  id: string;
  /** Ön yüz — kelime / soru / deyim */
  front: string;
  /** Arka yüz — anlam / eş / zıt / açıklama */
  back: string;
  /** Örnek cümle (isteğe bağlı) */
  example?: string;
  /** Telaffuz / ipucu */
  hint?: string;
  /** Etiketler */
  tags?: string[];
  /** Ek not */
  note?: string;
  /** Kart türü */
  kind?: CardKind;
}

export type CardKind =
  | 'kelime'
  | 'es_anlamli'
  | 'zit_anlamli'
  | 'atasozu'
  | 'deyim';

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  kelime: 'Kelime',
  es_anlamli: 'Eş anlamlı',
  zit_anlamli: 'Zıt anlamlı',
  atasozu: 'Atasözü',
  deyim: 'Deyim',
};

/** Öğretmenin öğrenciye verdiği sınav / içerik ataması */
export interface Assignment {
  id: string;
  title: string;
  note: string;
  /** Bir veya birden fazla içerik (sınav, test, alıştırma, kart…) */
  itemIds: string[];
  /** Bir veya birden fazla öğrenci */
  studentIds: string[];
  assignedBy: string;
  dueAt: number | null;
  createdAt: number;
}

/** Anki tarzı deste ayarları */
export interface CardDeckOptions {
  /** Ters kart üret (anlam → kelime) */
  enableReverse: boolean;
  /** Günlük yeni kart limiti */
  newPerDay: number;
  /** Günlük tekrar limiti (0 = sınırsız) */
  reviewsPerDay: number;
  /** Öğrenme adımları (dakika) örn. 1, 10 */
  learningStepsMinutes: number[];
  /** Mezuniyet aralığı (gün) */
  graduatingIntervalDays: number;
  /** Easy ile mezuniyet aralığı (gün) */
  easyIntervalDays: number;
  /** Başlangıç ease % (250 = 2.5) */
  startingEasePercent: number;
  /** Easy bonusu (1.3 = %30) */
  easyBonus: number;
  /** Hard çarpanı */
  hardIntervalFactor: number;
  /** Interval modifier */
  intervalModifier: number;
  /** Maksimum aralık (gün) */
  maxIntervalDays: number;
  /** Leech eşiği (lapse sayısı) */
  leechThreshold: number;
  /** Leech olunca askıya al */
  suspendLeeches: boolean;
}

export const DEFAULT_DECK_OPTIONS: CardDeckOptions = {
  enableReverse: true,
  newPerDay: 20,
  reviewsPerDay: 200,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  startingEasePercent: 250,
  easyBonus: 1.3,
  hardIntervalFactor: 1.2,
  intervalModifier: 1,
  maxIntervalDays: 36500,
  leechThreshold: 8,
  suspendLeeches: true,
};

export type SrsCardState = 'new' | 'learning' | 'review' | 'relearning';
export type CardDirection = 'forward' | 'reverse';
export type SrsRating = 1 | 2 | 3 | 4; // Again Hard Good Easy

export interface CardReviewState {
  id: string;
  userId: string;
  itemId: string;
  cardId: string;
  direction: CardDirection;
  state: SrsCardState;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  learningStep: number;
  dueAt: number;
  lastReviewedAt: number | null;
  suspended: boolean;
  buriedUntil: number | null;
  isLeech: boolean;
}

export interface ReviewLogEntry {
  id: string;
  userId: string;
  itemId: string;
  cardId: string;
  direction: CardDirection;
  rating: SrsRating;
  previousState: SrsCardState;
  newState: SrsCardState;
  previousInterval: number;
  newInterval: number;
  easeFactor: number;
  reviewedAt: number;
  timeTakenMs: number;
}

export interface ContentItem {
  id: string;
  folderId: string | null;
  ownerId: string;
  type: ItemType;
  title: string;
  description: string;
  subject: SubjectKey;
  gradeLevel: string;
  questions: Question[];
  /** Kelime kartları (type === 'kartlar') */
  cards?: FlashCard[];
  /** Deste varsayılan kart türü */
  cardKind?: CardKind;
  deckOptions?: CardDeckOptions;
  settings: ItemSettings;
  createdAt: number;
  updatedAt: number;
}

export interface AnswerRecord {
  questionId: string;
  /** string | string[] | Record matching answers */
  value: unknown;
  isCorrect: boolean | null;
  pointsEarned: number;
  feedback?: string;
}

export interface Attempt {
  id: string;
  itemId: string;
  userId: string;
  answers: AnswerRecord[];
  score: number;
  maxScore: number;
  percent: number;
  durationSeconds: number;
  startedAt: number;
  completedAt: number;
}

export interface AppMeta {
  id: string;
  currentUserId: string | null;
  lastBackupAt: number | null;
}

export interface ExportBundle {
  version: 1;
  exportedAt: number;
  app: string;
  users?: User[];
  folders?: Folder[];
  items?: ContentItem[];
  attempts?: Attempt[];
  cardReviews?: CardReviewState[];
  reviewLogs?: ReviewLogEntry[];
  assignments?: Assignment[];
}

export const DEFAULT_SETTINGS: ItemSettings = {
  shuffleQuestions: false,
  shuffleOptions: false,
  showResultsImmediately: true,
  timeLimitMinutes: null,
  passScorePercent: 50,
  allowReview: true,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ogretmen: 'Öğretmen',
  ogrenci: 'Öğrenci',
  veli: 'Veli',
  diger: 'Diğer',
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  alistirma: 'Alıştırma',
  sinav: 'Sınav',
  test: 'Test',
  quiz: 'Quiz',
  kartlar: 'Kelime kartları',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  coktan_secmeli: 'Çoktan seçmeli',
  coklu_secim: 'Çoklu seçim',
  dogru_yanlis: 'Doğru / Yanlış',
  bosluk_doldurma: 'Boşluk doldurma',
  acik_uclu: 'Açık uçlu',
  eslestirme: 'Eşleştirme',
  siralama: 'Sıralama',
  matematik: 'Matematik',
  sayisal: 'Sayısal cevap',
  siniflandirma: 'Sınıflandırma',
  likert: 'Likert ölçeği',
  el_yazisi: 'El yazısı / çizim',
};

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  turkce: 'Türkçe',
  matematik: 'Matematik',
  fen: 'Fen Bilimleri',
  sosyal: 'Sosyal Bilgiler',
  ingilizce: 'İngilizce',
  almanca: 'Almanca',
  fransizca: 'Fransızca',
  tarih: 'Tarih',
  cografya: 'Coğrafya',
  biyoloji: 'Biyoloji',
  fizik: 'Fizik',
  kimya: 'Kimya',
  felsefe: 'Felsefe',
  din: 'Din Kültürü',
  muzik: 'Müzik',
  resim: 'Görsel Sanatlar',
  beden: 'Beden Eğitimi',
  bilgisayar: 'Bilişim',
  ekonomi: 'Ekonomi',
  psikoloji: 'Psikoloji',
  diger: 'Diğer',
};

export const GRADE_LEVELS = [
  '1. Sınıf',
  '2. Sınıf',
  '3. Sınıf',
  '4. Sınıf',
  '5. Sınıf',
  '6. Sınıf',
  '7. Sınıf',
  '8. Sınıf',
  '9. Sınıf',
  '10. Sınıf',
  '11. Sınıf',
  '12. Sınıf',
  'Lise Hazırlık',
  'Önlisans',
  'Lisans',
  'Yüksek Lisans',
  'Doktora',
  'Genel / Her seviye',
];

export const USER_COLORS = [
  '#0B4F54',
  '#1E6B5C',
  '#C45C26',
  '#2F5D9F',
  '#7A3E6D',
  '#3D6B3D',
  '#B45309',
  '#0F766E',
];
