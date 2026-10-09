import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Loading, Unreachable } from '../components/DeckGate';
import type { Deck } from '../domain/types';
import { loadDecks, useDeck } from '../state/deck';
import { refreshDecks, removeDeck, useDecks } from '../state/decks';
import { resetReviews } from '../state/progress';
import { StudyToggle } from './DecksPage';
import { WordList } from './WordsPage';

/** The cards of one deck, whether or not it is being studied. */
export function DeckWordsPage() {
  const { deckId } = useParams();
  const { decks, loading, error } = useDecks();

  if (!decks) {
    return error && !loading ? <Unreachable message={error} onRetry={() => void refreshDecks()} /> : <Loading />;
  }
  const deck = decks.find((d) => d.id === deckId);
  return deck ? <DeckWords deck={deck} /> : <Navigate to="/decks" replace />;
}

function DeckWords({ deck }: { deck: Deck }) {
  const entry = useDeck().loaded[deck.id];

  useEffect(() => {
    void loadDecks([deck]);
  }, [deck]);

  if (!entry?.words) {
    return entry?.error && !entry.loading ? (
      <Unreachable message={entry.error} onRetry={() => void loadDecks([deck])} />
    ) : (
      <Loading />
    );
  }

  const words = entry.words;
  return (
    <WordList
      title={deck.name}
      words={words}
      decks={[deck]}
      load={entry}
      onRefresh={() => void loadDecks([deck])}
      actions={<StudyToggle deck={deck} />}
      addDeckId={deck.id}
      onReset={() => {
        if (window.confirm(`Reset study progress for every card in ${deck.name}? The cards stay; XP and streak are kept.`)) {
          resetReviews(words.map((word) => word.id));
        }
      }}
      footer={<DeleteDeckButton deck={deck} cardCount={words.length} />}
    />
  );
}

/** Deletes the deck and its cards through the API once confirmed; the page then goes back to the deck list. */
function DeleteDeckButton({ deck, cardCount }: { deck: Deck; cardCount: number }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    const what = cardCount === 0 ? deck.name : `${deck.name} and its ${cardCount === 1 ? 'card' : `${cardCount} cards`}`;
    if (deleting || !window.confirm(`Delete ${what}? Their study progress goes too. This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      // Once the deck is out of the list, DeckWordsPage redirects to /decks.
      await removeDeck(deck.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  return (
    <>
      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--danger"
        onClick={() => void onDelete()}
        disabled={deleting}
      >
        {deleting ? 'Deleting…' : 'Delete deck'}
      </button>
    </>
  );
}
