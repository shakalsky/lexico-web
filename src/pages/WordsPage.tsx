import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { WordChanges } from '../api/words';
import { DeckGate } from '../components/DeckGate';
import { StudyRules } from '../domain/rules';
import { isDue } from '../domain/scheduler';
import { reviewFor, wordStatus, type WordStatus } from '../domain/stats';
import { deckNames } from '../domain/decks';
import type { Deck, ReviewState, Word } from '../domain/types';
import { wordMeaning, wordTitle } from '../domain/words';
import { useAutosize } from '../lib/autosize';
import { normalize } from '../lib/text';
import { formatRelative, useNow } from '../lib/time';
import { refreshWords, removeWord, updateWord, useDeck, useWordLang, type DeckState } from '../state/deck';
import { resetProgress, useProgress } from '../state/progress';

const STATUSES: WordStatus[] = ['new', 'learning', 'shaky', 'known'];

export function WordsPage() {
  return <DeckGate>{(words, decks) => <StudiedWords words={words} decks={decks} />}</DeckGate>;
}

/** The words of every deck being studied. */
function StudiedWords({ words, decks }: { words: Word[]; decks: Deck[] }) {
  const loaded = useDeck();
  return (
    <WordList
      title="Words"
      words={words}
      decks={decks}
      load={loaded}
      onRefresh={() => void refreshWords()}
      onReset={() => {
        if (window.confirm('Reset all study progress, XP and streak in this browser? The words stay.')) resetProgress();
      }}
    />
  );
}

/**
 * A searchable, filterable list of cards with their progress. `addDeckId`
 * makes the "add" links add to that deck.
 */
export function WordList({
  title,
  words,
  decks,
  load,
  onRefresh,
  actions,
  addDeckId,
  onReset,
  footer,
}: {
  title: string;
  words: Word[];
  decks: Deck[];
  load: Pick<DeckState, 'source' | 'fetchedAt' | 'loading'>;
  onRefresh: () => void;
  /** Shown before the add link. */
  actions?: ReactNode;
  addDeckId?: string;
  /** Offers a "Reset progress" button that calls this. */
  onReset?: () => void;
  /** Shown after the reset button. */
  footer?: ReactNode;
}) {
  const { reviews } = useProgress();
  const now = useNow();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WordStatus | null>(null);

  const rows = words.map((word) => {
    const review = reviewFor(reviews, word.id);
    return { word, review, status: wordStatus(review) };
  });
  const statusCounts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));

  const needle = normalize(query.trim());
  const visible = rows.filter(
    (row) =>
      (!status || row.status === status) &&
      (!needle ||
        normalize(
          `${row.word.term} ${row.word.translation} ${row.word.exampleSource} ${row.word.exampleTarget}`,
        ).includes(needle)),
  );

  return (
    <div className="words">
      <div className="words__head">
        <div>
          <h1 className="display display--md">{title}</h1>
          <p className="words__source">
            {words.length} {words.length === 1 ? 'card' : 'cards'} in {deckNames(decks)}
            {load.fetchedAt && (
              <>
                {' · '}
                {load.source === 'api' ? 'loaded' : 'saved copy from'} {formatRelative(Math.min(load.fetchedAt, now), now)}
              </>
            )}
          </p>
        </div>
        <div className="words__actions">
          <button
            type="button"
            className="chip"
            onClick={onRefresh}
            disabled={load.loading}
            aria-label="Reload words from the API"
          >
            {load.loading ? 'Loading…' : 'Refresh'}
          </button>
          {actions}
          <Link to={addHref({ deck: addDeckId })} className="chip chip--accent">
            + Add cards
          </Link>
        </div>
      </div>

      <input
        type="search"
        className="input"
        placeholder="Search words and sentences"
        aria-label="Search words"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="chips" role="group" aria-label="Filter by progress">
        <FilterChip label="Any progress" pressed={status === null} onClick={() => setStatus(null)} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            label={`${s[0].toUpperCase()}${s.slice(1)} ${statusCounts[s]}`}
            pressed={status === s}
            onClick={() => setStatus(status === s ? null : s)}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="words__empty">
          <p>No words match.</p>
          {query.trim() && (
            <Link to={addHref({ deck: addDeckId, term: query.trim() })} className="chip chip--accent">
              Add a card for “{query.trim()}”
            </Link>
          )}
        </div>
      ) : (
        <ul className="word-list">
          {visible.map(({ word, review, status: s }) => (
            <li key={word.id}>
              <WordRow word={word} review={review} status={s} now={now} showDeck={decks.length > 1} />
            </li>
          ))}
        </ul>
      )}

      {onReset && (
        <button type="button" className="btn btn--ghost btn--danger" onClick={onReset}>
          Reset progress
        </button>
      )}
      {footer}
    </div>
  );
}

function addHref(params: { deck?: string; term?: string }): string {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return query.size > 0 ? `/words/new?${query}` : '/words/new';
}

function FilterChip({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} onClick={onClick}>
      {label}
    </button>
  );
}

function WordRow({
  word,
  review,
  status,
  now,
  showDeck,
}: {
  word: Word;
  review: ReviewState;
  status: WordStatus;
  now: number;
  /** Name the word's deck, when several are open. */
  showDeck: boolean;
}) {
  const lang = useWordLang(word.id);
  const { deckOf, loaded } = useDeck();
  const deck = deckOf.get(word.id);
  const due = isDue(review, now);
  const [editing, setEditing] = useState(false);

  return (
    <details className="word-row">
      <summary className="word-row__summary">
        <span className={word.term ? 'word-row__term' : 'word-row__term word-row__term--sentence'} lang={lang}>
          {wordTitle(word)}
        </span>
        <span className="word-row__translation">{wordMeaning(word)}</span>
        <span className="word-row__tags">
          <span className={`status status--${status}`}>{status}</span>
        </span>
      </summary>
      <div className="word-row__body">
        {editing ? (
          <EditWordForm
            word={word}
            deckWords={(deck && loaded[deck.id]?.words) || []}
            lang={lang}
            onDone={() => setEditing(false)}
          />
        ) : (
          <>
            {/* A sentence card already shows both sentences in its summary line. */}
            {word.exampleSource && (word.term || word.translation) && (
              <blockquote className="word-row__example">
                <p lang={lang}>{word.exampleSource}</p>
                <p className="word-row__example-target">{word.exampleTarget}</p>
              </blockquote>
            )}
            <dl className="word-row__facts">
              {showDeck && deck && (
                <div>
                  <dt>Deck</dt>
                  <dd>{deck.name}</dd>
                </div>
              )}
              <div>
                <dt>Seen</dt>
                <dd>{review.timesSeen === 1 ? 'once' : `${review.timesSeen} times`}</dd>
              </div>
              <div>
                <dt>Right</dt>
                <dd>{review.timesCorrect}</dd>
              </div>
              <div>
                <dt>Next review</dt>
                <dd>{due ? 'due now' : formatRelative(review.dueAt, now)}</dd>
              </div>
            </dl>
            <div className="word-row__actions">
              <button type="button" className="chip" onClick={() => setEditing(true)}>
                Edit
              </button>
              <DeleteWordButton word={word} />
            </div>
          </>
        )}
      </div>
    </details>
  );
}

const TEXT_FIELDS = ['exampleSource', 'exampleTarget', 'term', 'translation'] as const;

/** Edits the card's text in place, as on the add page. Only the fields that changed are sent. */
function EditWordForm({
  word,
  deckWords,
  lang,
  onDone,
}: {
  word: Word;
  /** For the "already in the deck" warning. */
  deckWords: Word[];
  lang?: string;
  /** Saved, cancelled, or nothing changed. */
  onDone: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Required<WordChanges>>(() => ({
    exampleSource: word.exampleSource,
    exampleTarget: word.exampleTarget,
    term: word.term,
    translation: word.translation,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const sourceInput = useRef<HTMLTextAreaElement>(null);
  const targetInput = useRef<HTMLTextAreaElement>(null);
  useAutosize(sourceInput, draft.exampleSource);
  useAutosize(targetInput, draft.exampleTarget);

  const edit = (field: keyof WordChanges) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: event.target.value }));

  const source = draft.exampleSource.trim();
  const target = draft.exampleTarget.trim();
  const sameSentence = source
    ? deckWords.find((w) => w.id !== word.id && normalize(w.exampleSource) === normalize(source))
    : undefined;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!source || !target) {
      setShowErrors(true);
      (source ? targetInput : sourceInput).current?.focus();
      return;
    }
    const changes: WordChanges = {};
    for (const field of TEXT_FIELDS) {
      const value = draft[field].trim();
      if (value !== word[field]) changes[field] = value;
    }
    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateWord(word.id, changes);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <form
      className="form word-row__edit"
      onSubmit={onSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) onDone();
      }}
      noValidate
      aria-label={`Edit ${wordTitle(word)}`}
    >
      <div className="field">
        <label className="field__label" htmlFor={`${id}-source`}>
          Example sentence
        </label>
        <textarea
          id={`${id}-source`}
          ref={sourceInput}
          className="input input--area input--grow"
          rows={2}
          lang={lang}
          autoFocus
          value={draft.exampleSource}
          onChange={edit('exampleSource')}
          aria-invalid={showErrors && !source}
          aria-describedby={`${id}-source-note`}
        />
        <p id={`${id}-source-note`} className="field__note" aria-live="polite">
          {showErrors && !source ? (
            <span className="field__error">Enter the example sentence.</span>
          ) : sameSentence ? (
            <span className="field__warning">This sentence is already in the deck.</span>
          ) : null}
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${id}-target`}>
          Example in {StudyRules.nativeLanguageLabel}
        </label>
        <textarea
          id={`${id}-target`}
          ref={targetInput}
          className="input input--area input--grow"
          rows={2}
          value={draft.exampleTarget}
          onChange={edit('exampleTarget')}
          aria-invalid={showErrors && !target}
          aria-describedby={`${id}-target-note`}
        />
        <p id={`${id}-target-note`} className="field__note" aria-live="polite">
          {showErrors && !target && <span className="field__error">Enter the translation of the sentence.</span>}
        </p>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor={`${id}-term`}>
            Word <span className="field__optional">optional</span>
          </label>
          <input
            id={`${id}-term`}
            className="input"
            lang={lang}
            autoComplete="off"
            value={draft.term}
            onChange={edit('term')}
            aria-describedby={`${id}-term-hint`}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-translation`}>
            Translation <span className="field__optional">optional</span>
          </label>
          <input
            id={`${id}-translation`}
            className="input"
            autoComplete="off"
            value={draft.translation}
            onChange={edit('translation')}
          />
        </div>
      </div>
      <p id={`${id}-term-hint`} className="field__hint">
        Leave the word empty to learn the whole sentence. Study progress is kept.
      </p>

      {error && (
        <p className="form-status form-status--error" role="alert">
          {error}
        </p>
      )}

      <div className="word-row__actions">
        <button type="submit" className="chip chip--accent" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="chip" onClick={onDone} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Deletes the card through the API once confirmed. On success the row goes with it. */
function DeleteWordButton({ word }: { word: Word }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (deleting || !window.confirm(`Delete “${wordTitle(word)}”? Its study progress goes too. This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await removeWord(word.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  };

  return (
    <>
      <button type="button" className="chip chip--danger" onClick={() => void onDelete()} disabled={deleting}>
        {deleting ? 'Deleting…' : 'Delete card'}
      </button>
      {error && (
        <p className="word-row__error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
