import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loading, Unreachable } from '../components/DeckGate';
import type { Deck } from '../domain/types';
import { formatRelative, useNow } from '../lib/time';
import { loadDecks, useDeck } from '../state/deck';
import { addDeck, refreshDecks, toggleDeck, useDecks } from '../state/decks';

/** Offered in the language field alongside the languages of existing decks. */
const COMMON_LANGUAGES = ['Español', 'Polski', 'Русский', 'Українська', 'Deutsch', 'Français', 'Italiano', 'Português'];

export function DecksPage() {
  const { decks, loading, error, activeIds } = useDecks();
  const navigate = useNavigate();
  const now = useNow();
  const [creating, setCreating] = useState(false);
  const { loaded } = useDeck();

  // For the card counts.
  useEffect(() => {
    if (decks) void loadDecks(decks);
  }, [decks]);

  if (!decks) {
    return error && !loading ? <Unreachable message={error} onRetry={() => void refreshDecks()} /> : <Loading />;
  }

  const studying = decks.filter((deck) => activeIds.includes(deck.id));

  return (
    <div className="decks">
      <div className="words__head">
        <div>
          <h1 className="display display--md">Decks</h1>
          <p className="words__source">
            {decks.length === 0
              ? 'Create your first deck to start.'
              : decks.length === 1
                ? '1 deck.'
                : `${decks.length} decks. Study one or more together.`}
          </p>
        </div>
        <div className="words__actions">
          <button
            type="button"
            className="chip"
            onClick={() => void refreshDecks()}
            disabled={loading}
            aria-label="Reload decks from the API"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {decks.length > 0 && !creating && (
            <button type="button" className="chip chip--accent" onClick={() => setCreating(true)}>
              + New deck
            </button>
          )}
        </div>
      </div>

      {(creating || decks.length === 0) && (
        <NewDeckForm
          decks={decks}
          onCancel={decks.length > 0 ? () => setCreating(false) : undefined}
          // A new deck is empty, so the next step is filling it.
          onCreated={(deck) => void navigate(`/words/new?deck=${encodeURIComponent(deck.id)}`)}
        />
      )}

      {decks.length > 0 && (
        <ul className="deck-list">
          {decks.map((deck) => {
            const count = loaded[deck.id]?.words?.length;
            return (
              <li key={deck.id} className="deck-row" data-active={activeIds.includes(deck.id)}>
                <Link to={`/decks/${encodeURIComponent(deck.id)}`} className="deck-row__text">
                  <span className="deck-row__name">{deck.name}</span>
                  <span className="deck-row__meta">
                    {deck.language}
                    {count !== undefined && ` · ${count} ${count === 1 ? 'card' : 'cards'}`} · created{' '}
                    {formatRelative(Math.min(deck.createdAt, now), now)}
                  </span>
                </Link>
                <StudyToggle deck={deck} className="deck-row__badge" />
              </li>
            );
          })}
        </ul>
      )}

      {studying.length > 0 && (
        <button type="button" className="btn btn--primary" onClick={() => void navigate('/')}>
          {studying.length === 1 ? `Study ${studying[0].name}` : `Study ${studying.length} decks`}
        </button>
      )}
    </div>
  );
}

/** Adds the deck to the ones being studied, or takes it out. */
export function StudyToggle({ deck, className = 'chip' }: { deck: Deck; className?: string }) {
  const { activeIds } = useDecks();
  const active = activeIds.includes(deck.id);
  // The last deck being studied can't be taken out.
  const locked = active && activeIds.length === 1;

  return (
    <button
      type="button"
      className={className}
      aria-pressed={active}
      aria-disabled={locked}
      aria-label={`Study ${deck.name}`}
      title={locked ? 'At least one deck is always studied' : undefined}
      onClick={() => toggleDeck(deck.id)}
    >
      {active ? 'Studying' : 'Study'}
    </button>
  );
}

function NewDeckForm({
  decks,
  onCancel,
  onCreated,
}: {
  decks: Deck[];
  onCancel?: () => void;
  onCreated: (deck: Deck) => void;
}) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const languages = [...new Set([...decks.map((deck) => deck.language), ...COMMON_LANGUAGES])];

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim() || !language.trim()) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(await addDeck({ name: name.trim(), language: language.trim() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <form className="form new-deck" onSubmit={onSubmit} noValidate aria-labelledby="new-deck-heading">
      <h2 id="new-deck-heading" className="eyebrow eyebrow--small">
        New deck
      </h2>
      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="deck-name">
            Name
          </label>
          <input
            id="deck-name"
            className="input"
            placeholder="e.g. Food"
            autoComplete="off"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={showErrors && !name.trim()}
            aria-describedby="deck-name-note"
          />
          <p id="deck-name-note" className="field__note" aria-live="polite">
            {showErrors && !name.trim() && <span className="field__error">Name the deck.</span>}
          </p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="deck-language">
            Language you're learning
          </label>
          <input
            id="deck-language"
            className="input"
            list="deck-languages"
            placeholder="e.g. Polski"
            autoComplete="off"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-invalid={showErrors && !language.trim()}
            aria-describedby="deck-language-note"
          />
          <datalist id="deck-languages">
            {languages.map((lang) => (
              <option key={lang} value={lang} />
            ))}
          </datalist>
          <p id="deck-language-note" className="field__note" aria-live="polite">
            {showErrors && !language.trim() && <span className="field__error">Enter the language.</span>}
          </p>
        </div>
      </div>

      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}

      <div className="new-deck__actions">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create deck'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
