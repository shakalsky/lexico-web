import type { Word } from './types';

// A word saved without a `term` is a sentence card: the example sentence is what
// gets learned. These pick what to show for a word in lists and messages.

/** The word, or the whole sentence for a sentence card. */
export const wordTitle = (word: Word) => word.term || word.exampleSource;

/** The translation, or the translated sentence for a sentence card. */
export const wordMeaning = (word: Word) => word.translation || word.exampleTarget;
