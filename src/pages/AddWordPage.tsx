import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DeckGate } from '../components/DeckGate';
import { PasteFormats } from '../components/PasteFormats';
import { WordCard } from '../components/WordCard';
import { StudyRules } from '../domain/rules';
import type { Deck, Word } from '../domain/types';
import { wordTitle } from '../domain/words';
import { useAutosize } from '../lib/autosize';
import { parsePairs } from '../lib/pairs';
import { languageCode } from '../lib/language';
import { normalize } from '../lib/text';
import { addWords, loadDecks, useDeck } from '../state/deck';
import { useDecks } from '../state/decks';
import { readJson, writeJson } from '../state/storage';

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; count: number; first: Word }
  | { kind: 'error'; message: string };

/** The API takes at most this many words per request. */
const MAX_BATCH = 1000;

/** Remembers "Swap front and back" between visits; lists from one source tend to share a layout. */
const SWAP_KEY = 'lexico.v1.pasteSwapped';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function AddWordPage() {
  return <DeckGate>{(_, decks) => <AddCards studying={decks} />}</DeckGate>;
}

/** Adds to any deck; the first one being studied unless `?deck=` names another. */
function AddCards({ studying }: { studying: Deck[] }) {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'list' ? 'list' : 'one';
  const decks = useDecks().decks ?? studying;
  const [targetId, setTargetId] = useState(() => params.get('deck'));
  const deck = decks.find((d) => d.id === targetId) ?? studying[0];
  // Duplicates are checked against the deck's words, so a deck not being studied is loaded too.
  const words = useDeck().loaded[deck.id]?.words ?? [];

  useEffect(() => {
    void loadDecks([deck]);
  }, [deck]);

  return (
    <div className="add-word">
      <div>
        <h1 className="display display--md">Add cards</h1>
        <p className="words__source">
          to {deck.name}, {words.length} {words.length === 1 ? 'card' : 'cards'} so far
        </p>
      </div>

      {decks.length > 1 && (
        <div className="field">
          <label className="field__label" htmlFor="target-deck">
            Deck
          </label>
          <select
            id="target-deck"
            className="input"
            value={deck.id}
            onChange={(event) => setTargetId(event.target.value)}
          >
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.language}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="How to add">
        <button
          type="button"
          role="tab"
          id="tab-one"
          aria-selected={mode === 'one'}
          aria-controls="panel-one"
          className="tab"
          onClick={() => setParams({}, { replace: true })}
        >
          One card
        </button>
        <button
          type="button"
          role="tab"
          id="tab-list"
          aria-selected={mode === 'list'}
          aria-controls="panel-list"
          className="tab"
          onClick={() => setParams({ mode: 'list' }, { replace: true })}
        >
          Paste a list
        </button>
      </div>

      {mode === 'one' ? (
        <div role="tabpanel" id="panel-one" aria-labelledby="tab-one">
          <OneCardForm deck={deck} words={words} initialTerm={params.get('term') ?? ''} />
        </div>
      ) : (
        <div role="tabpanel" id="panel-list" aria-labelledby="tab-list">
          <PasteListForm deck={deck} words={words} />
        </div>
      )}
    </div>
  );
}

/** Shown after a successful add, above either form. */
function SavedNotice({ status, lang }: { status: Extract<Status, { kind: 'saved' }>; lang?: string }) {
  return (
    <div className="form-status form-status--success" role="status">
      <p>
        {status.count === 1 ? (
          <>
            Added <strong lang={lang}>{wordTitle(status.first)}</strong>. It'll come up in your next
            session.
          </>
        ) : (
          <>
            Added <strong>{status.count} cards</strong>. They'll come up in your next sessions.
          </>
        )}
      </p>
      <Link to="/words" className="chip">
        See all cards
      </Link>
    </div>
  );
}

interface Draft {
  exampleSource: string;
  exampleTarget: string;
  term: string;
  translation: string;
}

const emptyDraft = (term = ''): Draft => ({ exampleSource: '', exampleTarget: '', term, translation: '' });

function OneCardForm({ deck, words, initialTerm }: { deck: Deck; words: Word[]; initialTerm: string }) {
  const lang = languageCode(deck.language);
  const [draft, setDraft] = useState(() => emptyDraft(initialTerm));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showErrors, setShowErrors] = useState(false);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const sourceInput = useRef<HTMLTextAreaElement>(null);
  const targetInput = useRef<HTMLTextAreaElement>(null);
  useAutosize(sourceInput, draft.exampleSource);
  useAutosize(targetInput, draft.exampleTarget);

  const edit = (field: keyof Draft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: event.target.value }));

  const source = draft.exampleSource.trim();
  const target = draft.exampleTarget.trim();
  const term = draft.term.trim();
  const translation = draft.translation.trim();
  const sameSentence = source ? words.find((w) => normalize(w.exampleSource) === normalize(source)) : undefined;
  const sameTerm = term ? words.find((w) => w.term && normalize(w.term) === normalize(term)) : undefined;
  const saving = status.kind === 'saving';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!source || !target) {
      setShowErrors(true);
      (source ? targetInput : sourceInput).current?.focus();
      return;
    }

    setStatus({ kind: 'saving' });
    try {
      const [word] = await addWords(deck, [{ exampleSource: source, exampleTarget: target, term, translation }]);
      setStatus({ kind: 'saved', count: 1, first: word });
      setDraft(emptyDraft());
      setShowErrors(false);
      setPreviewRevealed(false);
      sourceInput.current?.focus();
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  };

  const preview: Word = {
    id: 'preview',
    term,
    translation,
    exampleSource: source || 'Abre la ventana, por favor.',
    exampleTarget: target || 'Open the window, please.',
  };

  return (
    <>
      {status.kind === 'saved' && <SavedNotice status={status} lang={lang} />}

      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="example-source">
            Example sentence
          </label>
          <textarea
            id="example-source"
            ref={sourceInput}
            className="input input--area input--grow"
            rows={2}
            lang={lang}
            placeholder="e.g. Abre la ventana, por favor."
            autoFocus={!initialTerm}
            value={draft.exampleSource}
            onChange={edit('exampleSource')}
            aria-invalid={showErrors && !source}
            aria-describedby="example-source-note"
          />
          <p id="example-source-note" className="field__note" aria-live="polite">
            {showErrors && !source ? (
              <span className="field__error">Enter the example sentence.</span>
            ) : sameSentence ? (
              <span className="field__warning">This sentence is already in the deck.</span>
            ) : null}
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="example-target">
            Example in {StudyRules.nativeLanguageLabel}
          </label>
          <textarea
            id="example-target"
            ref={targetInput}
            className="input input--area input--grow"
            rows={2}
            placeholder="e.g. Open the window, please."
            value={draft.exampleTarget}
            onChange={edit('exampleTarget')}
            aria-invalid={showErrors && !target}
            aria-describedby="example-target-note"
          />
          <p id="example-target-note" className="field__note" aria-live="polite">
            {showErrors && !target && <span className="field__error">Enter the translation of the sentence.</span>}
          </p>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="term">
              Word <span className="field__optional">optional</span>
            </label>
            <input
              id="term"
              className="input"
              lang={lang}
              placeholder="e.g. la ventana"
              autoComplete="off"
              autoFocus={Boolean(initialTerm)}
              value={draft.term}
              onChange={edit('term')}
              aria-describedby="term-note"
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="translation">
              Translation <span className="field__optional">optional</span>
            </label>
            <input
              id="translation"
              className="input"
              placeholder="e.g. window"
              autoComplete="off"
              value={draft.translation}
              onChange={edit('translation')}
            />
          </div>
        </div>
        <p id="term-note" className="field__hint" aria-live="polite">
          {sameTerm ? (
            <span className="field__warning">
              Already in the deck: {sameTerm.term} = {sameTerm.translation}
            </span>
          ) : (
            'The word to learn from the sentence. Leave both empty to learn the whole sentence.'
          )}
        </p>

        {status.kind === 'error' && (
          <p className="form-status form-status--error" role="alert">
            {status.message}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add card'}
        </button>
      </form>

      <section className="add-word__preview" aria-labelledby="preview-heading">
        <div className="add-word__preview-head">
          <h2 id="preview-heading" className="eyebrow eyebrow--small">
            Card preview
          </h2>
          <button type="button" className="chip" onClick={() => setPreviewRevealed((r) => !r)}>
            {previewRevealed ? 'Show front' : 'Show back'}
          </button>
        </div>
        {/* Clicking the card turns it too; the button above is the accessible control. */}
        <div
          className="preview-card"
          data-sample={!source && !target && !term && !translation}
          onClick={() => setPreviewRevealed((r) => !r)}
          aria-hidden="true"
        >
          <WordCard word={preview} revealed={previewRevealed} lang={lang} />
        </div>
      </section>
    </>
  );
}

const LIST_PLACEHOLDER = `1. Abre la ventana, por favor. — Open the window, please.
2. ¿Dónde está la estación? — Where is the station?`;

function PasteListForm({ deck, words }: { deck: Deck; words: Word[] }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [showFormats, setShowFormats] = useState(false);
  const [swapped, setSwapped] = useState(() => readJson<boolean>(SWAP_KEY) === true);

  const toggleSwapped = () => {
    setSwapped(!swapped);
    writeJson(SWAP_KEY, !swapped);
  };

  // Front = the first part of each pasted pair, unless swapped.
  const parsed = parsePairs(text);
  const unpaired = parsed.unpaired;
  const pairs = swapped ? parsed.pairs.map(({ source, target }) => ({ source: target, target: source })) : parsed.pairs;

  // Skip sentences the deck already has, and repeats within the paste.
  const inDeck = new Set(words.map((w) => normalize(w.exampleSource)));
  const inPaste = new Set<string>();
  const rows = pairs.map((pair) => {
    const key = normalize(pair.source);
    const skip = inDeck.has(key) ? 'in deck' : inPaste.has(key) ? 'repeated' : null;
    inPaste.add(key);
    return { ...pair, skip };
  });
  const toAdd = rows.filter((row) => !row.skip);
  const saving = status.kind === 'saving';
  const tooMany = toAdd.length > MAX_BATCH;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || toAdd.length === 0 || tooMany) return;
    setStatus({ kind: 'saving' });
    try {
      const created = await addWords(
        deck,
        toAdd.map((row) => ({ exampleSource: row.source, exampleTarget: row.target })),
      );
      setStatus({ kind: 'saved', count: created.length, first: created[0] });
      setText('');
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  };

  return (
    <>
      {status.kind === 'saved' && <SavedNotice status={status} lang={languageCode(deck.language)} />}

      <form className="form" onSubmit={onSubmit}>
        <div className="field">
          <div className="field__label-row">
            <label className="field__label" htmlFor="paste">
              Sentences and their translations
            </label>
            <button
              type="button"
              className="info-btn"
              aria-label="Accepted list formats"
              aria-expanded={showFormats}
              aria-controls="paste-formats"
              onClick={() => setShowFormats((open) => !open)}
            >
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 9v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="10" cy="6.2" r="1.05" fill="currentColor" />
              </svg>
            </button>
          </div>
          {showFormats && <PasteFormats id="paste-formats" />}
          <textarea
            id="paste"
            className="input input--area input--big"
            rows={12}
            spellCheck={false}
            placeholder={LIST_PLACEHOLDER}
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-describedby="paste-hint"
          />
          <p id="paste-hint" className="field__hint">
            One card per line: the sentence, then its translation. The ⓘ button shows every format that works.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={swapped}
          className="switch"
          onClick={toggleSwapped}
          aria-describedby="swap-hint"
        >
          <span className="switch__track" aria-hidden="true">
            <span className="switch__thumb" />
          </span>
          <span className="switch__text">
            <span className="switch__label">Swap front and back</span>
            <span id="swap-hint" className="switch__hint">
              {swapped
                ? 'Front: the second part of each line. Back: the first part.'
                : 'Front: the first part of each line. Back: the second part.'}
            </span>
          </span>
        </button>

        {unpaired.length > 0 && (
          <div className="form-status form-status--warning" role="status">
            <p>
              No translation found for {unpaired.length === 1 ? 'this line' : `these ${unpaired.length} lines`}, so{' '}
              {unpaired.length === 1 ? "it won't" : "they won't"} be added:
            </p>
            <ul className="unpaired-list">
              {unpaired.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {status.kind === 'error' && (
          <p className="form-status form-status--error" role="alert">
            {status.message}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={saving || toAdd.length === 0 || tooMany}>
          {saving
            ? 'Adding…'
            : tooMany
              ? `Up to ${MAX_BATCH} cards at a time`
              : toAdd.length === 0
                ? rows.length > 0
                  ? 'Nothing new to add'
                  : 'Paste sentences to add'
                : toAdd.length === 1
                  ? 'Add 1 card'
                  : `Add ${toAdd.length} cards`}
        </button>
      </form>

      {rows.length > 0 && (
        <section className="add-word__preview" aria-labelledby="parsed-heading">
          <div className="add-word__preview-head">
            <h2 id="parsed-heading" className="eyebrow eyebrow--small">
              {toAdd.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? 'card' : 'cards'}`
                : `${toAdd.length} of ${rows.length} cards, ${rows.length - toAdd.length} skipped`}
            </h2>
            <span className="pair-list__legend" aria-hidden="true">
              front <span className="pair-list__legend-back">/ back</span>
            </span>
          </div>
          <ol className="pair-list">
            {rows.map((row, index) => (
              <li key={index} className="pair-list__item" data-skip={Boolean(row.skip)}>
                <span className="pair-list__number">{index + 1}</span>
                <span className="pair-list__text">
                  <span className="pair-list__source">
                    <span className="visually-hidden">Front: </span>
                    {row.source}
                  </span>
                  <span className="pair-list__target">
                    <span className="visually-hidden">Back: </span>
                    {row.target}
                  </span>
                </span>
                {row.skip && <span className="pair-list__skip">{row.skip === 'in deck' ? 'already in deck' : 'repeated'}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
