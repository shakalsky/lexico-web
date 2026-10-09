import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Deck, Word } from '../domain/types';
import { refreshWords, useDeck } from '../state/deck';
import { refreshDecks, useDecks } from '../state/decks';
import { Spinner } from './ui';

/**
 * Renders `children` with the open decks and their words once loaded;
 * until then a spinner, an error, or a way to create the first deck.
 */
export function DeckGate({ children }: { children: (words: Word[], decks: Deck[]) => ReactNode }) {
  const decks = useDecks();
  const open = useDeck();

  if (!decks.decks) {
    return decks.error && !decks.loading ? (
      <Unreachable message={decks.error} onRetry={() => void refreshDecks()} />
    ) : (
      <Loading />
    );
  }

  if (open.decks.length === 0) {
    return (
      <div className="center-view">
        <h1 className="display display--md">No decks yet</h1>
        <p className="center-view__message">Create a deck, then add cards to it.</p>
        <Link to="/decks" className="btn btn--primary">
          Create a deck
        </Link>
      </div>
    );
  }

  if (open.words) return children(open.words, open.decks);

  return open.error && !open.loading ? (
    <Unreachable message={open.error} onRetry={() => void refreshWords()} />
  ) : (
    <Loading />
  );
}

export function Loading() {
  return (
    <div className="center-view">
      <Spinner />
    </div>
  );
}

export function Unreachable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="center-view">
      <h1 className="display display--md">The library is out of reach</h1>
      <p className="center-view__message">{message}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
