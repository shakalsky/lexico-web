export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

/** Council of Europe proficiency band, as named on a card's badge. */
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** A card's badge: `A0` until it has been missed, then a CEFR band that rises with each miss. */
export type CardLevel = 'A0' | CefrLevel;

/** A set of cards in one language. */
export interface Deck {
  id: string;
  /** Shown to the learner, e.g. "Food". */
  name: string;
  /** A display label for the language being learned, e.g. "Español"; not a language code. */
  language: string;
  /** Epoch ms. */
  createdAt: number;
}

/** A word as it exists in the deck, independent of how well it is known. */
export interface Word {
  id: string;
  /** The foreign-language word, e.g. `el atardecer`. */
  term: string;
  /** The learner's language, e.g. `sunset`. */
  translation: string;
  /** Example sentence in the language being learned. */
  exampleSource: string;
  /** The same sentence translated. */
  exampleTarget: string;
}

/** The only two answers a swipe can produce. */
export type ReviewGrade = 'knewIt' | 'needsReview';

/** Everything the scheduler knows about one word's history. Times are epoch ms. */
export interface ReviewState {
  wordId: string;
  /** Consecutive correct answers with no lapse in between. */
  repetitions: number;
  /** Days until the next showing; `0` means "again in this same day". */
  intervalDays: number;
  /** SM-2 style multiplier: how fast this word's interval grows. */
  easeFactor: number;
  dueAt: number;
  lastReviewedAt: number | null;
  lapses: number;
  timesSeen: number;
  timesCorrect: number;
}

/** One finished (or abandoned) sitting, as logged for XP and streaks. */
export interface SessionLog {
  startedAt: number;
  endedAt: number;
  reviewedCount: number;
  correctCount: number;
  xpEarned: number;
}

/** One answered card within the running session. */
export interface ReviewOutcome {
  word: Word;
  grade: ReviewGrade;
}

/** What the learner sees once the stack is empty. */
export interface SessionSummary {
  reviewedCount: number;
  correctCount: number;
  xpEarned: number;
  /** Streak length after this session was logged. */
  streakDays: number;
  /** Words marked "review", the list to revisit. */
  missedWords: Word[];
}
