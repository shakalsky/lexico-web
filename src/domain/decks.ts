import type { Deck } from './types';

/** "Food", "Food & Travel", or "3 decks" when the names would run long. */
export function deckNames(decks: Deck[]): string {
  if (decks.length <= 2) return decks.map((deck) => deck.name).join(' & ');
  return `${decks.length} decks`;
}

/** The languages of the decks, each once: "Español" or "Español, Polski". */
export function deckLanguages(decks: Deck[]): string {
  return [...new Set(decks.map((deck) => deck.language))].join(', ');
}
