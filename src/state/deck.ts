import { useSyncExternalStore } from 'react';
import { ApiError } from '../api/http';
import { addDeckWords, deleteWord, editWord, fetchDeckWords, type NewWord, type WordChanges } from '../api/words';
import type { Deck, Word } from '../domain/types';
import { languageCode } from '../lib/language';
import { uniqueId, wordIdFor } from '../lib/text';
import { resetReviews } from './progress';
import { readJson, removeKey, writeJson } from './storage';

/** A deck and its words, whether it is being studied or only looked at. */
export interface DeckWords {
  deck: Deck;
  /** `null` until the first successful load, from the API or the saved copy. */
  words: Word[] | null;
  source: 'api' | 'cache' | null;
  /** When the words currently shown were fetched from the API. */
  fetchedAt: number | null;
  loading: boolean;
  /** The last failed load. Stale words may still be shown alongside it. */
  error: string | null;
}

/** The open decks and their words. Which decks are open is decided in `./decks`. */
export interface DeckState {
  /** In the order of the deck list. */
  open: DeckWords[];
  decks: Deck[];
  /** Every open deck's words together. `null` while one is on its first load, or when none could load. */
  words: Word[] | null;
  /** `'cache'` if any of the words shown come from a saved copy. */
  source: 'api' | 'cache' | null;
  /** The oldest fetch among the words shown. */
  fetchedAt: number | null;
  loading: boolean;
  /** The first failed load among the open decks. */
  error: string | null;
  /** Every deck loaded so far, open or not, by id. */
  loaded: Record<string, DeckWords>;
  /** The deck each loaded word belongs to. */
  deckOf: Map<string, Deck>;
}

interface CachedWords {
  words: Word[];
  fetchedAt: number;
}

const cacheKey = (deckId: string) => `lexico.v1.deck.${deckId}`;

function readCache(deckId: string): CachedWords | null {
  const cached = readJson<CachedWords>(cacheKey(deckId));
  return cached && Array.isArray(cached.words) && typeof cached.fetchedAt === 'number' ? cached : null;
}

function derive(loaded: Record<string, DeckWords>, openIds: string[]): DeckState {
  const open = openIds.map((id) => loaded[id]);
  const pending = open.some((d) => d.words === null && !d.error);
  const ready = open.filter((d): d is DeckWords & { words: Word[] } => d.words !== null);
  const fetched = ready.flatMap((d) => (d.fetchedAt === null ? [] : [d.fetchedAt]));
  const deckOf = new Map<string, Deck>();
  for (const d of Object.values(loaded)) for (const word of d.words ?? []) deckOf.set(word.id, d.deck);
  return {
    open,
    decks: open.map((d) => d.deck),
    words: pending || ready.length === 0 ? null : ready.flatMap((d) => d.words),
    source: ready.length === 0 ? null : ready.some((d) => d.source === 'cache') ? 'cache' : 'api',
    fetchedAt: fetched.length > 0 ? Math.min(...fetched) : null,
    loading: open.some((d) => d.loading),
    error: open.find((d) => d.error)?.error ?? null,
    loaded,
    deckOf,
  };
}

let openIds: string[] = [];
let state: DeckState = derive({}, openIds);
const listeners = new Set<() => void>();

function commit(loaded: Record<string, DeckWords>) {
  state = derive(loaded, openIds);
  for (const listener of listeners) listener();
}

function patchDeck(deckId: string, patch: Partial<DeckWords>) {
  const current = state.loaded[deckId];
  if (current) commit({ ...state.loaded, [deckId]: { ...current, ...patch } });
}

/** Adds the decks not seen yet, from their saved copies, and updates the details of the others. */
function withDecks(decks: Deck[]): Record<string, DeckWords> {
  let loaded = state.loaded;
  for (const deck of decks) {
    const existing = loaded[deck.id];
    if (existing?.deck === deck) continue;
    if (existing) {
      loaded = { ...loaded, [deck.id]: { ...existing, deck } };
      continue;
    }
    const cached = readCache(deck.id);
    loaded = {
      ...loaded,
      [deck.id]: {
        deck,
        words: cached?.words ?? null,
        source: cached ? 'cache' : null,
        fetchedAt: cached?.fetchedAt ?? null,
        loading: false,
        error: null,
      },
    };
  }
  return loaded;
}

/**
 * Switches to another set of decks to study. A newly opened deck shows its
 * saved copy at once and the API refresh replaces it when it lands.
 */
export function openDecks(decks: Deck[]) {
  if (decks.length === state.open.length && decks.every((deck, i) => deck === state.open[i].deck)) return;
  const added = decks.filter((deck) => !openIds.includes(deck.id));
  const loaded = withDecks(decks);
  openIds = decks.map((deck) => deck.id);
  commit(loaded);
  for (const deck of added) void refreshOne(deck.id);
}

/**
 * Loads decks whether or not they are being studied, for the deck list's
 * counts and a deck's own word list: the saved copy at once, then the API's.
 */
export function loadDecks(decks: Deck[]): Promise<void> {
  const loaded = withDecks(decks);
  if (loaded !== state.loaded) commit(loaded);
  return Promise.all(decks.map((deck) => refreshOne(deck.id))).then(() => undefined);
}

const inFlight = new Map<string, Promise<void>>();

/** Network first; the copy saved from the last successful fetch is the fallback. */
function refreshOne(deckId: string): Promise<void> {
  const running = inFlight.get(deckId);
  if (running) return running;

  const promise = (async () => {
    patchDeck(deckId, { loading: true, error: null });
    try {
      const words = await fetchDeckWords(deckId);
      // The deck may have been deleted while its words were on the way.
      if (!state.loaded[deckId]) return;
      const fetchedAt = Date.now();
      writeJson(cacheKey(deckId), { words, fetchedAt } satisfies CachedWords);
      patchDeck(deckId, { words, source: 'api', fetchedAt, loading: false });
    } catch (error) {
      patchDeck(deckId, { loading: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();
  inFlight.set(deckId, promise);
  void promise.finally(() => {
    if (inFlight.get(deckId) === promise) inFlight.delete(deckId);
  });
  return promise;
}

/** Reloads the words of every open deck. */
export async function refreshWords(): Promise<void> {
  await Promise.all(openIds.map((id) => refreshOne(id)));
}

/**
 * Saves new words to a deck in one request (all or nothing) and shows them
 * straight away. Words with a term get a readable id like `es-gato` when the
 * deck's language is recognised; the rest get one from the API.
 */
export async function addWords(deck: Deck, newWords: Omit<NewWord, 'id'>[]): Promise<Word[]> {
  const lang = languageCode(deck.language);
  const taken = new Set(state.loaded[deck.id]?.words?.map((w) => w.id));
  const withIds = newWords.map((word) => {
    const base = word.term && lang ? wordIdFor(word.term, lang) : null;
    if (!base) return word;
    const id = uniqueId(base, taken);
    taken.add(id);
    return { ...word, id };
  });

  let created: Word[];
  try {
    created = await addDeckWords(deck.id, withIds);
  } catch (error) {
    // Ids are unique across all decks, so a readable id can clash with a word
    // this deck doesn't show. Let the API pick them rather than fail.
    const usedReadableIds = withIds.some((word) => 'id' in word);
    if (!(error instanceof ApiError && error.status === 409) || !usedReadableIds) throw error;
    created = await addDeckWords(deck.id, newWords);
  }

  const entry = state.loaded[deck.id];
  const before = entry ? entry.words : (readCache(deck.id)?.words ?? null);
  const words = [...(before ?? []), ...created];
  const fetchedAt = entry?.fetchedAt ?? Date.now();
  writeJson(cacheKey(deck.id), { words, fetchedAt } satisfies CachedWords);
  patchDeck(deck.id, { words, fetchedAt });
  return created;
}

/**
 * Deletes a word through the API, then from its deck here. Its study progress
 * goes too: the API lets the id be used again, and a new card shouldn't inherit it.
 */
export async function removeWord(wordId: string): Promise<void> {
  await deleteWord(wordId);
  resetReviews([wordId]);
  rewriteDeckOf(wordId, (words) => words.filter((word) => word.id !== wordId));
}

/**
 * Saves changes to a word's text through the API and shows them straight away.
 * It keeps its id, place in the deck and study progress.
 */
export async function updateWord(wordId: string, changes: WordChanges): Promise<Word> {
  const edited = await editWord(wordId, changes);
  rewriteDeckOf(wordId, (words) => words.map((word) => (word.id === wordId ? edited : word)));
  return edited;
}

/** Changes the words of the deck holding this word, here and in its saved copy. */
function rewriteDeckOf(wordId: string, change: (words: Word[]) => Word[]) {
  for (const entry of Object.values(state.loaded)) {
    if (!entry.words?.some((word) => word.id === wordId)) continue;
    const words = change(entry.words);
    const fetchedAt = entry.fetchedAt ?? Date.now();
    writeJson(cacheKey(entry.deck.id), { words, fetchedAt } satisfies CachedWords);
    patchDeck(entry.deck.id, { words, fetchedAt });
  }
}

/**
 * Drops a deleted deck's words, saved copy and study progress. Call it once
 * the deck is out of the list, so that it is no longer open.
 */
export function forgetDeck(deckId: string) {
  const words = state.loaded[deckId]?.words ?? readCache(deckId)?.words ?? [];
  resetReviews(words.map((word) => word.id));
  removeKey(cacheKey(deckId));
  const loaded = { ...state.loaded };
  delete loaded[deckId];
  commit(loaded);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDeck(): DeckState {
  return useSyncExternalStore(subscribe, () => state);
}

/** The language code of the deck a word belongs to, for `lang` attributes; `undefined` if unrecognised. */
export function useWordLang(wordId: string): string | undefined {
  const deck = useDeck().deckOf.get(wordId);
  return deck ? languageCode(deck.language) : undefined;
}
