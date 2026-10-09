import type { Word } from '../domain/types';
import { ApiError, patchJson, postJson, request, requestDelete } from './http';

/**
 * Wire format of one word, see `lexico-api/API.md`. The server's counters
 * (`shows_count`, …) aren't read: progress here comes from this browser.
 */
interface WordDto {
  id: string;
  /** `null` for a sentence card. */
  question_short: string | null;
  answer_short: string | null;
  question_example: string;
  answer_example: string;
}

/**
 * A word to add. Only the example is required: without a `term` it becomes a
 * sentence card. The API generates a missing `id`.
 */
export interface NewWord {
  id?: string;
  term?: string;
  translation?: string;
  exampleSource: string;
  exampleTarget: string;
}

function toWord(dto: WordDto): Word {
  return {
    id: dto.id,
    term: dto.question_short ?? '',
    translation: dto.answer_short ?? '',
    exampleSource: dto.question_example,
    exampleTarget: dto.answer_example,
  };
}

const wordsPath = (deckId: string) => `/decks/${encodeURIComponent(deckId)}/words`;

async function wordList(promise: Promise<unknown>): Promise<Word[]> {
  const words = await promise;
  if (!Array.isArray(words)) throw new ApiError('The API sent a response this app does not understand.');
  return (words as WordDto[]).map(toWord);
}

/** Every word in the deck, in deck order. */
export function fetchDeckWords(deckId: string): Promise<Word[]> {
  return wordList(request(wordsPath(deckId), 'words'));
}

/** Appends words to the end of the deck, all or nothing. Resolves with them as stored. */
export function addDeckWords(deckId: string, words: NewWord[]): Promise<Word[]> {
  // Empty fields are left out (`undefined` drops out of the JSON) so the API stores them as null.
  const body = {
    words: words.map((word) => ({
      id: word.id,
      question_short: word.term || undefined,
      answer_short: word.translation || undefined,
      question_example: word.exampleSource,
      answer_example: word.exampleTarget,
    })),
  };
  return wordList(request(wordsPath(deckId), 'words', postJson(body)));
}

/** The fields of a word that can change after it is added. Left out means unchanged. */
export type WordChanges = Partial<Pick<Word, 'term' | 'translation' | 'exampleSource' | 'exampleTarget'>>;

/**
 * Edits a word's text; its id, deck, place in the deck and counters stay.
 * An empty `term` turns it into a sentence card. Resolves with the word as stored.
 */
export async function editWord(wordId: string, changes: WordChanges): Promise<Word> {
  // Empty fields are sent as null to clear them; `undefined` drops out of the JSON and keeps them.
  const body = {
    question_short: changes.term === undefined ? undefined : changes.term || null,
    answer_short: changes.translation === undefined ? undefined : changes.translation || null,
    question_example: changes.exampleSource,
    answer_example: changes.exampleTarget,
  };
  return toWord((await request(`/words/${encodeURIComponent(wordId)}`, 'word', patchJson(body))) as WordDto);
}

/**
 * Deletes one word, for good; the rest of its deck keeps its order. A word
 * that is already gone counts as deleted.
 */
export async function deleteWord(wordId: string): Promise<void> {
  try {
    await requestDelete(`/words/${encodeURIComponent(wordId)}`);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

/**
 * Records one answer to a card on the server (`shows_count` plus `successes_count`
 * or `failures_count`). `keepalive` lets it finish even if the tab closes right after.
 */
export async function postReview(wordId: string, correct: boolean): Promise<void> {
  await request(`/words/${encodeURIComponent(wordId)}/reviews`, 'word', {
    ...postJson({ correct }),
    keepalive: true,
  });
}
