import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { DeckGate } from '../components/DeckGate';
import { SwipeDeck, type SwipeDeckHandle } from '../components/SwipeDeck';
import { ProgressBar } from '../components/ui';
import { StudyRules } from '../domain/rules';
import { sessionCards } from '../domain/stats';
import type { Deck, ReviewGrade, ReviewOutcome, ReviewState, SessionSummary, Word } from '../domain/types';
import { wordMeaning, wordTitle } from '../domain/words';
import { logSession, recordReview, useProgress } from '../state/progress';
import { sendReview } from '../state/reviews';
import { useSettings } from '../state/settings';

type Session =
  | { phase: 'empty' }
  | {
      phase: 'studying';
      cards: Word[];
      index: number;
      revealed: boolean;
      outcomes: ReviewOutcome[];
      startedAt: number;
    }
  | { phase: 'finished'; summary: SessionSummary };

interface Toast {
  message: string;
  positive: boolean;
  visible: boolean;
}

const TOAST_MS = 1100;

/** Empty only when the decks have no cards at all; nothing has to be due. */
function startSession(words: Word[], reviews: Record<string, ReviewState>, length: number): Session {
  const cards = sessionCards(words, reviews, length);
  if (cards.length === 0) return { phase: 'empty' };
  return { phase: 'studying', cards, index: 0, revealed: false, outcomes: [], startedAt: Date.now() };
}

/** Logs the sitting, awards XP and builds the summary shown at the end. */
function finishSession(outcomes: ReviewOutcome[], startedAt: number, endedAt: number): SessionSummary {
  const correctCount = outcomes.filter((o) => o.grade === 'knewIt').length;
  const xpEarned = correctCount * StudyRules.xpPerCorrectAnswer;
  const streakDays = logSession({ startedAt, endedAt, reviewedCount: outcomes.length, correctCount, xpEarned });
  return {
    reviewedCount: outcomes.length,
    correctCount,
    xpEarned,
    streakDays,
    // A word repeated until it was right is listed once.
    missedWords: [
      ...new Map(outcomes.filter((o) => o.grade === 'needsReview').map((o) => [o.word.id, o.word])).values(),
    ],
  };
}

export function StudyPage() {
  return (
    <div className="app app--focus">
      <DeckGate>{(words, decks) => <StudySession words={words} decks={decks} />}</DeckGate>
    </div>
  );
}

function StudySession({ words, decks }: { words: Word[]; decks: Deck[] }) {
  const navigate = useNavigate();
  const { reviews } = useProgress();
  const { sessionLength, repeatMissed } = useSettings();
  const [session, setSession] = useState<Session>(() => startSession(words, reviews, sessionLength));
  const [toast, setToast] = useState<Toast>({ message: '', positive: true, visible: false });
  const deck = useRef<SwipeDeckHandle>(null);

  // Answers already given still count when the learner leaves early (✕, Esc,
  // the back button), so the partial sitting is logged on the way out.
  const latest = useRef(session);
  useLayoutEffect(() => {
    latest.current = session;
  });
  useEffect(
    () => () => {
      const current = latest.current;
      if (current.phase === 'studying' && current.outcomes.length > 0) {
        finishSession(current.outcomes, current.startedAt, Date.now());
      }
    },
    [],
  );

  useEffect(() => {
    if (!toast.visible) return;
    const id = setTimeout(() => setToast((t) => ({ ...t, visible: false })), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const flip = () => setSession((s) => (s.phase === 'studying' ? { ...s, revealed: !s.revealed } : s));

  const answer = (grade: ReviewGrade) => {
    if (session.phase !== 'studying') return;
    const word = session.cards[session.index];
    const now = Date.now();
    recordReview(word.id, grade, now);
    sendReview(word.id, grade === 'knewIt');
    const outcomes = [...session.outcomes, { word, grade }];
    const requeue = repeatMissed && grade === 'needsReview';
    const cards = requeue ? [...session.cards, word] : session.cards;

    if (session.index + 1 >= cards.length) {
      setToast((t) => ({ ...t, visible: false }));
      setSession({ phase: 'finished', summary: finishSession(outcomes, session.startedAt, now) });
      return;
    }

    setSession({ ...session, cards, index: session.index + 1, revealed: false, outcomes });
    setToast(
      grade === 'knewIt'
        ? { message: `knew it · +${StudyRules.xpPerCorrectAnswer} XP`, positive: true, visible: true }
        : {
            message: `${requeue ? 'again at the end' : 'saved for review'} · ${wordMeaning(word)}`,
            positive: false,
            visible: true,
          },
    );
  };

  const quit = () => void navigate('/');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        void navigate('/');
        return;
      }
      if (session.phase !== 'studying') return;
      // Real buttons handle Space and Enter themselves.
      const onButton = event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement;
      if ((event.key === ' ' || event.key === 'Enter') && !onButton) {
        event.preventDefault();
        setSession((s) => (s.phase === 'studying' ? { ...s, revealed: !s.revealed } : s));
      } else if (event.key === 'ArrowLeft') {
        deck.current?.swipe('needsReview');
      } else if (event.key === 'ArrowRight') {
        deck.current?.swipe('knewIt');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session.phase, navigate]);

  if (session.phase === 'empty') return <EmptyDeck several={decks.length > 1} />;

  if (session.phase === 'finished') {
    return <Summary summary={session.summary} onAnotherRound={() => setSession(startSession(words, reviews, sessionLength))} />;
  }

  const { cards, index, revealed } = session;
  // Each card still queued is a different word not finished yet, so a miss
  // sent back to the end moves neither the bar nor the count.
  const total = new Set(cards.map((word) => word.id)).size;
  const done = total - (cards.length - index);

  return (
    <div className="study">
      <div className="study__header">
        <button type="button" className="icon-btn" onClick={quit} aria-label="End session">
          ✕
        </button>
        <ProgressBar progress={done / total} label="Session progress" thin />
        <span className="study__position">
          {done + 1}/{total}
        </span>
      </div>

      <SwipeDeck
        ref={deck}
        cards={cards.slice(index)}
        startIndex={index}
        revealed={revealed}
        onFlip={flip}
        onAnswered={answer}
      />

      <div className="answer-row">
        <button
          type="button"
          className="answer-btn answer-btn--review"
          onClick={() => deck.current?.swipe('needsReview')}
          aria-label="Needs review"
        >
          ✕
        </button>
        <span className="answer-row__label">
          review
          <br />
          or knew it
        </span>
        <button
          type="button"
          className="answer-btn answer-btn--knew"
          onClick={() => deck.current?.swipe('knewIt')}
          aria-label="Knew it"
        >
          ✓
        </button>
      </div>

      <div
        className={toast.positive ? 'toast toast--positive' : 'toast toast--negative'}
        data-visible={toast.visible}
        aria-live="polite"
      >
        {toast.message}
      </div>

      <p className="keys-hint">
        <kbd>Space</kbd> turn over · <kbd>←</kbd> review · <kbd>→</kbd> knew it · <kbd>Esc</kbd> end
      </p>
    </div>
  );
}

/** Shown when a session is asked for but the decks have no cards. */
function EmptyDeck({ several }: { several: boolean }) {
  return (
    <div className="center-view">
      <h1 className="display display--md">{several ? 'These decks have' : 'This deck has'} no cards yet</h1>
      <p className="center-view__message">Add some, and they're ready to study straight away.</p>
      <Link to="/words/new" className="btn btn--primary">
        Add cards
      </Link>
      <Link to="/" className="btn btn--ghost">
        Back to today
      </Link>
    </div>
  );
}

/** The end-of-session screen: score, XP, streak and the words to revisit. */
function Summary({ summary, onAnotherRound }: { summary: SessionSummary; onAnotherRound: () => void }) {
  const accuracy = summary.reviewedCount === 0 ? 0 : Math.round((summary.correctCount / summary.reviewedCount) * 100);

  return (
    <div className="summary">
      <span className="eyebrow">Session complete</span>
      <div className="summary__score">
        <span className="display summary__percent">{accuracy}%</span>
        <span className="summary__detail">
          {summary.correctCount} of {summary.reviewedCount} right
        </span>
      </div>

      <div className="stat-row stat-row--two">
        <div className="summary-tile summary-tile--accent">
          <span className="summary-tile__value">+{summary.xpEarned}</span>
          <span className="summary-tile__label">XP earned</span>
        </div>
        <div className="summary-tile">
          <span className="summary-tile__value">{summary.streakDays}</span>
          <span className="summary-tile__label">day streak</span>
        </div>
      </div>

      <h2 className="eyebrow eyebrow--small">{summary.missedWords.length > 0 ? 'Coming back soon' : 'Nothing to revisit'}</h2>
      {summary.missedWords.length > 0 ? (
        <ul className="missed-list">
          {summary.missedWords.map((word) => (
            <li key={word.id} className="missed-list__item">
              <span className="missed-list__term">{wordTitle(word)}</span>
              <span className="missed-list__translation">{wordMeaning(word)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="summary__clean">Every card in this round landed. Well done.</p>
      )}

      <div className="summary__actions">
        <button type="button" className="btn btn--primary" onClick={onAnotherRound}>
          Another round
        </button>
        <Link to="/" className="btn btn--ghost">
          Done for today
        </Link>
      </div>
    </div>
  );
}
