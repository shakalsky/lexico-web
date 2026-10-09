import {
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
  type Ref,
} from 'react';
import type { ReviewGrade, Word } from '../domain/types';
import { wordMeaning, wordTitle } from '../domain/words';
import { WordCard } from './WordCard';

/** Lets the answer buttons and keyboard answer the same way a swipe does. */
export interface SwipeDeckHandle {
  swipe: (grade: ReviewGrade) => void;
}

interface SwipeDeckProps {
  /** Top card first; only the first three are painted. */
  cards: Word[];
  /**
   * Where the top card sits in the session. Cards are keyed by position, not
   * word, so a missed word that comes round again is dealt as a fresh card.
   */
  startIndex: number;
  revealed: boolean;
  onFlip: () => void;
  /** Called as soon as the top card is answered. */
  onAnswered: (grade: ReviewGrade) => void;
  ref?: Ref<SwipeDeckHandle>;
}

/** How far a card must travel before the release counts as an answer. */
const COMMIT_DISTANCE = 88;
/** A quick flick counts even if it is short, in px per ms. */
const FLING_VELOCITY = 0.6;
/** Movement below this is a tap, which turns the card over. */
const TAP_SLOP = 6;

interface Gesture {
  pointerId: number;
  startX: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  dragging: boolean;
}

/**
 * The card stack: the top card is draggable, two more peek behind it. An
 * answered card is dropped at once, with no fly-out.
 */
export function SwipeDeck({ cards, startIndex, revealed, onFlip, onAnswered, ref }: SwipeDeckProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<Gesture | null>(null);

  const commit = (grade: ReviewGrade) => {
    if (cards.length === 0) return;
    setDx(0);
    onAnswered(grade);
  };

  useImperativeHandle(ref, () => ({ swipe: commit }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    const offset = event.clientX - g.startX;
    if (!g.dragging) {
      if (Math.abs(offset) < TAP_SLOP) return;
      g.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    const elapsed = event.timeStamp - g.lastTime;
    if (elapsed > 0) g.velocity = (event.clientX - g.lastX) / elapsed;
    g.lastX = event.clientX;
    g.lastTime = event.timeStamp;
    setDx(offset);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.pointerId !== event.pointerId) return;
    gesture.current = null;

    if (!g.dragging) {
      onFlip();
      return;
    }
    setDragging(false);

    const offset = event.clientX - g.startX;
    // A finger that stopped before lifting has no fling left in it.
    const velocity = event.timeStamp - g.lastTime > 100 ? 0 : g.velocity;
    const flungRight = velocity > FLING_VELOCITY;
    const flungLeft = velocity < -FLING_VELOCITY;

    if (Math.abs(offset) > COMMIT_DISTANCE || flungRight || flungLeft) {
      const right = flungLeft ? false : flungRight || offset > 0;
      commit(right ? 'knewIt' : 'needsReview');
    } else {
      setDx(0);
    }
  };

  const onPointerCancel = () => {
    gesture.current = null;
    setDragging(false);
    setDx(0);
  };

  const stampOpacity = Math.min(1, Math.abs(dx) / (COMMIT_DISTANCE * 1.02));

  return (
    <div className="deck">
      {cards.slice(0, 3).map((word, depth) =>
        depth === 0 ? (
          <div
            key={startIndex + depth}
            className="deck-card deck-card--top"
            data-dragging={dragging}
            style={{ transform: `translate(${dx}px, ${Math.abs(dx) * 0.06}px) rotate(${dx / 22}deg)`, zIndex: 3 }}
            role="button"
            tabIndex={0}
            aria-label={revealed ? `${wordMeaning(word)}. Turn card back` : `${wordTitle(word)}. Turn card over`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <WordCard word={word} revealed={revealed} />
            <span className="stamp stamp--knew" style={{ opacity: dx > 0 ? stampOpacity : 0 }} aria-hidden="true">
              knew it
            </span>
            <span className="stamp stamp--review" style={{ opacity: dx < 0 ? stampOpacity : 0 }} aria-hidden="true">
              review
            </span>
          </div>
        ) : (
          <div
            key={startIndex + depth}
            className="deck-card"
            style={{
              transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.04})`,
              opacity: depth === 2 ? 0.45 : 1,
              zIndex: 3 - depth,
            }}
            aria-hidden="true"
          >
            <WordCard word={word} revealed={false} />
          </div>
        ),
      )}
    </div>
  );
}
