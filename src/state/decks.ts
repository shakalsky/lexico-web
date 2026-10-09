import { useSyncExternalStore } from 'react';
import { createDeck, deleteDeck, fetchDecks } from '../api/decks';
import { config } from '../config';
import type { Deck } from '../domain/types';
import { forgetDeck, openDecks } from './deck';
import { readJson, writeJson } from './storage';

/** The list of decks and which ones are being studied. */
export interface DecksState {
  /** `null` until the first successful load, from the API or the saved copy. */
  decks: Deck[] | null;
  loading: boolean;
  /** The last failed load. A saved list may still be shown alongside it. */
  error: string | null;
  /** The decks Today, Words and sessions work on. Never empty while there are decks. */
  activeIds: string[];
}

const decksKey = 'lexico.v1.decks';
/** The decks the learner picked last, remembered in this browser. */
const pickedKey = 'lexico.v1.activeDecks';
/** Where the single picked deck was kept before several could be studied at once. */
const legacyPickedKey = 'lexico.v1.activeDeck';

function pickedIds(): string[] {
  const picked = readJson<unknown>(pickedKey);
  if (Array.isArray(picked)) return picked.filter((id): id is string => typeof id === 'string');
  const legacy = readJson<unknown>(legacyPickedKey);
  return typeof legacy === 'string' ? [legacy] : [];
}

/** The picked decks that still exist, else the configured default, else the oldest. */
function activeIdsFor(decks: Deck[] | null): string[] {
  if (!decks || decks.length === 0) return [];
  const picked = pickedIds().filter((id) => decks.some((deck) => deck.id === id));
  if (picked.length > 0) return picked;
  const fallback = config.defaultDeckId;
  return [fallback && decks.some((deck) => deck.id === fallback) ? fallback : decks[0].id];
}

/** In the order of the deck list. */
const activeDecks = (s: DecksState) => s.decks?.filter((deck) => s.activeIds.includes(deck.id)) ?? [];

const cached = readJson<Deck[]>(decksKey);
const initialDecks = Array.isArray(cached) ? cached : null;
let state: DecksState = { decks: initialDecks, loading: false, error: null, activeIds: activeIdsFor(initialDecks) };
openDecks(activeDecks(state));

const listeners = new Set<() => void>();

function update(patch: Partial<DecksState>) {
  state = { ...state, ...patch };
  openDecks(activeDecks(state));
  for (const listener of listeners) listener();
}

function saveList(decks: Deck[]) {
  writeJson(decksKey, decks);
  update({ decks, activeIds: activeIdsFor(decks) });
}

let inFlight: Promise<void> | null = null;

export function refreshDecks(): Promise<void> {
  inFlight ??= (async () => {
    update({ loading: true, error: null });
    try {
      const decks = await fetchDecks();
      update({ loading: false });
      saveList(decks);
    } catch (error) {
      update({ loading: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function pick(activeIds: string[]) {
  writeJson(pickedKey, activeIds);
  update({ activeIds });
}

/** Adds the deck to the ones being studied, or takes it out; the last one stays. */
export function toggleDeck(id: string) {
  if (!state.activeIds.includes(id)) {
    pick([...state.activeIds, id]);
  } else if (state.activeIds.length > 1) {
    pick(state.activeIds.filter((active) => active !== id));
  }
}

/** Creates an empty deck through the API and adds it to the ones being studied. */
export async function addDeck(input: { name: string; language: string }): Promise<Deck> {
  const deck = await createDeck(input);
  writeJson(pickedKey, [...state.activeIds, deck.id]);
  saveList([...(state.decks ?? []), deck]);
  return deck;
}

/**
 * Deletes the deck and its words through the API, then everything this browser
 * kept about them. If it was the only deck being studied, the fallback takes over.
 */
export async function removeDeck(deckId: string): Promise<void> {
  await deleteDeck(deckId);
  writeJson(pickedKey, state.activeIds.filter((id) => id !== deckId));
  saveList((state.decks ?? []).filter((deck) => deck.id !== deckId));
  forgetDeck(deckId);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDecks(): DecksState {
  return useSyncExternalStore(subscribe, () => state);
}
