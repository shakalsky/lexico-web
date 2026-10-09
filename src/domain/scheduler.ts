import { StudyRules } from './rules';
import type { CardLevel, ReviewGrade, ReviewState } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A word that has never been answered: due immediately. */
export function freshReview(wordId: string): ReviewState {
  return {
    wordId,
    repetitions: 0,
    intervalDays: 0,
    easeFactor: StudyRules.defaultEaseFactor,
    dueAt: 0,
    lastReviewedAt: null,
    lapses: 0,
    timesSeen: 0,
    timesCorrect: 0,
  };
}

/** Three clean repetitions and the word has moved into long-term memory. */
export const isKnown = (review: ReviewState) =>
  review.repetitions >= StudyRules.knownRepetitionThreshold;

/** Answered wrong at some point and not yet re-established. */
export const isShaky = (review: ReviewState) => review.lapses > 0 && !isKnown(review);

export const isNew = (review: ReviewState) => review.timesSeen === 0;

export const isDue = (review: ReviewState, now: number) => review.dueAt <= now;

/** The fewest misses for each badge, hardest first. */
const LEVEL_BY_LAPSES: [number, CardLevel][] = [
  [12, 'C2'],
  [8, 'C1'],
  [5, 'B2'],
  [3, 'B1'],
  [2, 'A2'],
  [1, 'A1'],
];

/** How hard this word has proven: a new or never-missed card is `A0`, and each miss can raise it. */
export function cardLevel(review: ReviewState): CardLevel {
  if (isNew(review)) return 'A0';
  return LEVEL_BY_LAPSES.find(([min]) => review.lapses >= min)?.[1] ?? 'A0';
}

/**
 * An SM-2 derivative adapted to a two-way answer (knew it / review). A port of
 * `SpacedRepetitionScheduler` in the Flutter app: pure, returns the next state.
 */
export function schedule(current: ReviewState, grade: ReviewGrade, now: number): ReviewState {
  return grade === 'knewIt' ? promote(current, now) : relearn(current, now);
}

function promote(current: ReviewState, now: number): ReviewState {
  const repetitions = current.repetitions + 1;
  const easeFactor = Math.min(StudyRules.maxEaseFactor, current.easeFactor + 0.1);
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round(current.intervalDays * easeFactor));

  return {
    ...current,
    repetitions,
    easeFactor,
    intervalDays,
    dueAt: now + intervalDays * DAY_MS,
    lastReviewedAt: now,
    timesSeen: current.timesSeen + 1,
    timesCorrect: current.timesCorrect + 1,
  };
}

/**
 * A miss resets the ladder: the word returns later the same day and its ease
 * drops so future intervals grow more cautiously.
 */
function relearn(current: ReviewState, now: number): ReviewState {
  return {
    ...current,
    repetitions: 0,
    intervalDays: 0,
    easeFactor: Math.max(StudyRules.minEaseFactor, current.easeFactor - 0.2),
    dueAt: now + StudyRules.relearnDelayMs,
    lastReviewedAt: now,
    lapses: current.lapses + 1,
    timesSeen: current.timesSeen + 1,
  };
}
