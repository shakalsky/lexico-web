import { StudyRules } from './rules';
import { freshReview, isDue, isKnown, isNew, isShaky } from './scheduler';
import type { ReviewState, SessionLog, Word } from './types';

/** The numbers behind the home screen. */
export interface LearnerStats {
  dueCount: number;
  knownCount: number;
  shakyCount: number;
  accuracyPercent: number;
  streakDays: number;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  /** `0…1` share of the current level completed. */
  levelProgress: number;
}

export type WordStatus = 'new' | 'learning' | 'shaky' | 'known';

export function reviewFor(reviews: Record<string, ReviewState>, wordId: string): ReviewState {
  return reviews[wordId] ?? freshReview(wordId);
}

export function wordStatus(review: ReviewState): WordStatus {
  if (isNew(review)) return 'new';
  if (isKnown(review)) return 'known';
  if (isShaky(review)) return 'shaky';
  return 'learning';
}

/**
 * The stack for one sitting. Any card can be studied at any time: the schedule
 * only decides the order. Due cards come first (oldest first), then the ones
 * coming back soonest, so a card just missed returns before one well known.
 * Deck order breaks ties.
 */
export function sessionCards(
  words: Word[],
  reviews: Record<string, ReviewState>,
  limit: number = StudyRules.sessionLength,
): Word[] {
  return words
    .map((word, position) => ({ word, position, review: reviewFor(reviews, word.id) }))
    .sort(
      (a, b) =>
        a.review.dueAt - b.review.dueAt || a.position - b.position,
    )
    .slice(0, limit)
    .map(({ word }) => word);
}

export function learnerStats(
  words: Word[],
  reviews: Record<string, ReviewState>,
  sessions: SessionLog[],
  now: number,
): LearnerStats {
  let dueCount = 0;
  let knownCount = 0;
  let shakyCount = 0;
  let timesSeen = 0;
  let timesCorrect = 0;

  for (const word of words) {
    const review = reviewFor(reviews, word.id);
    if (isDue(review, now)) dueCount++;
    if (isKnown(review)) knownCount++;
    if (isShaky(review)) shakyCount++;
    timesSeen += review.timesSeen;
    timesCorrect += review.timesCorrect;
  }

  const totalXp = sessions.reduce((sum, session) => sum + session.xpEarned, 0);

  return {
    dueCount,
    knownCount,
    shakyCount,
    accuracyPercent: timesSeen === 0 ? 0 : Math.round((timesCorrect / timesSeen) * 100),
    streakDays: streakFromDays(
      sessions.map((session) => session.endedAt),
      now,
    ),
    totalXp,
    level: Math.floor(totalXp / StudyRules.xpPerLevel) + 1,
    xpIntoLevel: totalXp % StudyRules.xpPerLevel,
    levelProgress: (totalXp % StudyRules.xpPerLevel) / StudyRules.xpPerLevel,
  };
}

const startOfDay = (time: number) => {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** Whole calendar days from `earlier` to `later`, immune to DST shifts. */
const daysBetween = (later: number, earlier: number) =>
  Math.round((startOfDay(later) - startOfDay(earlier)) / (24 * 60 * 60 * 1000));

/**
 * Counts consecutive study days ending today or yesterday. An older last
 * session means the streak has already lapsed.
 */
export function streakFromDays(studyTimes: number[], now: number): number {
  const days = [...new Set(studyTimes.map(startOfDay))].sort((a, b) => b - a);
  if (days.length === 0) return 0;
  if (daysBetween(now, days[0]) > 1) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(days[i - 1], days[i]) !== 1) break;
    streak++;
  }
  return streak;
}
