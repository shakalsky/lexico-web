/**
 * The tunable numbers of the learning loop. Same values as `StudyRules` and
 * `ReviewState` in the Flutter app, so progress means the same thing on both.
 */
export const StudyRules = {
  /** How many cards one sitting holds, until the learner picks their own in Settings. */
  sessionLength: 8,
  xpPerCorrectAnswer: 12,
  xpPerLevel: 900,
  /** A missed word comes back after this long, still within the session day. */
  relearnDelayMs: 10 * 60 * 1000,
  defaultEaseFactor: 2.5,
  minEaseFactor: 1.3,
  maxEaseFactor: 2.8,
  /** Clean repetitions after which a word counts as known. */
  knownRepetitionThreshold: 3,
  /** The learner's language, shown on the back of a card. Decks only say which language is learned. */
  nativeLanguageLabel: 'English',
} as const;
