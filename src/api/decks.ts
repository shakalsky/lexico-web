import type { Deck } from '../domain/types';
import { ApiError, postJson, request, requestDelete } from './http';

/** Wire format of a deck, see `lexico-api/API.md`. */
interface DeckDto {
  id: string;
  name: string;
  language: string;
  created_at: string;
}

function toDeck(dto: DeckDto): Deck {
  return { id: dto.id, name: dto.name, language: dto.language, createdAt: Date.parse(dto.created_at) };
}

/** Every deck, oldest first. */
export async function fetchDecks(): Promise<Deck[]> {
  const decks = await request('/decks', 'decks');
  if (!Array.isArray(decks)) throw new ApiError('The API sent a response this app does not understand.');
  return (decks as DeckDto[]).map(toDeck);
}

/** Creates an empty deck; the API gives it an id. */
export async function createDeck(input: { name: string; language: string }): Promise<Deck> {
  return toDeck((await request('/decks', 'deck', postJson(input))) as DeckDto);
}

/** Deletes the deck and every word in it, for good. A deck that is already gone counts as deleted. */
export async function deleteDeck(deckId: string): Promise<void> {
  try {
    await requestDelete(`/decks/${encodeURIComponent(deckId)}`);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}
