import type {
  CardDeckOptions,
  CardDirection,
  CardReviewState,
  SrsRating,
} from '../types';
import { DEFAULT_DECK_OPTIONS } from '../types';

const MINUTE = 60_000;
const DAY = 86_400_000;

export function reviewStateId(
  userId: string,
  itemId: string,
  cardId: string,
  direction: CardDirection,
): string {
  return `${userId}:${itemId}:${cardId}:${direction}`;
}

export function createNewReviewState(
  userId: string,
  itemId: string,
  cardId: string,
  direction: CardDirection,
  opts: CardDeckOptions = DEFAULT_DECK_OPTIONS,
): CardReviewState {
  return {
    id: reviewStateId(userId, itemId, cardId, direction),
    userId,
    itemId,
    cardId,
    direction,
    state: 'new',
    easeFactor: opts.startingEasePercent / 100,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    learningStep: 0,
    dueAt: Date.now(),
    lastReviewedAt: null,
    suspended: false,
    buriedUntil: null,
    isLeech: false,
  };
}

export function formatInterval(ms: number): string {
  if (ms < MINUTE) return '<1 dk';
  if (ms < DAY) {
    const m = Math.round(ms / MINUTE);
    if (m < 60) return `${m} dk`;
    const h = Math.round(m / 60);
    return `${h} sa`;
  }
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d} g`;
  if (d < 365) return `${Math.round(d / 30)} ay`;
  return `${(d / 365).toFixed(1)} y`;
}

function clampEase(ef: number): number {
  return Math.max(1.3, ef);
}

function applyIntervalModifier(days: number, opts: CardDeckOptions): number {
  return Math.min(
    opts.maxIntervalDays,
    Math.max(1, Math.round(days * opts.intervalModifier)),
  );
}

/** Önizleme: bu puan verilirse ne kadar sonra gelecek */
export function previewInterval(
  state: CardReviewState,
  rating: SrsRating,
  opts: CardDeckOptions = DEFAULT_DECK_OPTIONS,
): string {
  const next = schedule(state, rating, opts, Date.now());
  const delta = Math.max(0, next.dueAt - Date.now());
  return formatInterval(delta);
}

export function schedule(
  state: CardReviewState,
  rating: SrsRating,
  opts: CardDeckOptions = DEFAULT_DECK_OPTIONS,
  now = Date.now(),
): CardReviewState {
  const next: CardReviewState = {
    ...state,
    lastReviewedAt: now,
  };
  const steps = opts.learningStepsMinutes.length
    ? opts.learningStepsMinutes
    : [1, 10];

  const isLearning =
    state.state === 'new' ||
    state.state === 'learning' ||
    state.state === 'relearning';

  if (isLearning) {
    return scheduleLearning(next, rating, opts, steps, now);
  }

  return scheduleReview(next, rating, opts, steps, now);
}

function scheduleLearning(
  state: CardReviewState,
  rating: SrsRating,
  opts: CardDeckOptions,
  steps: number[],
  now: number,
): CardReviewState {
  // Again
  if (rating === 1) {
    const lapses =
      state.state === 'relearning' || state.repetitions > 0
        ? state.lapses + 1
        : state.lapses;
    const isLeech = lapses >= opts.leechThreshold;
    return {
      ...state,
      state: state.repetitions > 0 ? 'relearning' : 'learning',
      learningStep: 0,
      lapses,
      isLeech,
      suspended: isLeech && opts.suspendLeeches ? true : state.suspended,
      easeFactor: clampEase(state.easeFactor - 0.2),
      dueAt: now + steps[0] * MINUTE,
      intervalDays: 0,
    };
  }

  // Hard — tekrar aynı adım, biraz daha uzun
  if (rating === 2) {
    const stepIdx = Math.min(state.learningStep, steps.length - 1);
    const minutes = Math.max(steps[stepIdx] * 1.5, steps[0]);
    return {
      ...state,
      state: state.state === 'new' ? 'learning' : state.state,
      dueAt: now + minutes * MINUTE,
    };
  }

  // Good — sonraki adım veya mezuniyet
  if (rating === 3) {
    const nextStep = state.learningStep + 1;
    if (nextStep >= steps.length) {
      const days = applyIntervalModifier(opts.graduatingIntervalDays, opts);
      return {
        ...state,
        state: 'review',
        learningStep: 0,
        repetitions: Math.max(1, state.repetitions + 1),
        intervalDays: days,
        dueAt: now + days * DAY,
      };
    }
    return {
      ...state,
      state: state.state === 'new' ? 'learning' : state.state,
      learningStep: nextStep,
      dueAt: now + steps[nextStep] * MINUTE,
    };
  }

  // Easy — doğrudan mezuniyet
  const days = applyIntervalModifier(opts.easyIntervalDays, opts);
  return {
    ...state,
    state: 'review',
    learningStep: 0,
    repetitions: Math.max(1, state.repetitions + 1),
    easeFactor: clampEase(state.easeFactor + 0.15),
    intervalDays: days,
    dueAt: now + days * DAY,
  };
}

function scheduleReview(
  state: CardReviewState,
  rating: SrsRating,
  opts: CardDeckOptions,
  steps: number[],
  now: number,
): CardReviewState {
  // Again — lapse → relearning
  if (rating === 1) {
    const lapses = state.lapses + 1;
    const isLeech = lapses >= opts.leechThreshold;
    return {
      ...state,
      state: 'relearning',
      learningStep: 0,
      lapses,
      isLeech,
      suspended: isLeech && opts.suspendLeeches ? true : state.suspended,
      easeFactor: clampEase(state.easeFactor - 0.2),
      intervalDays: 0,
      dueAt: now + steps[0] * MINUTE,
    };
  }

  let ease = state.easeFactor;
  let interval = state.intervalDays || 1;

  if (rating === 2) {
    // Hard
    ease = clampEase(ease - 0.15);
    interval = applyIntervalModifier(
      Math.max(1, interval * opts.hardIntervalFactor),
      opts,
    );
  } else if (rating === 3) {
    // Good
    interval = applyIntervalModifier(Math.max(1, interval * ease), opts);
  } else {
    // Easy
    ease = clampEase(ease + 0.15);
    interval = applyIntervalModifier(
      Math.max(1, interval * ease * opts.easyBonus),
      opts,
    );
  }

  return {
    ...state,
    state: 'review',
    easeFactor: ease,
    intervalDays: interval,
    repetitions: state.repetitions + 1,
    learningStep: 0,
    dueAt: now + interval * DAY,
  };
}

export function isDue(state: CardReviewState, now = Date.now()): boolean {
  if (state.suspended) return false;
  if (state.buriedUntil && state.buriedUntil > now) return false;
  return state.dueAt <= now;
}

export function startOfLocalDay(ts = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
