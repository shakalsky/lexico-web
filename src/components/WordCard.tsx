import { StudyRules } from '../domain/rules';
import { cardLevel } from '../domain/scheduler';
import { reviewFor } from '../domain/stats';
import type { Word } from '../domain/types';
import { useWordLang } from '../state/deck';
import { useProgress } from '../state/progress';
import { LevelTag } from './ui';

/**
 * A card that turns over to reveal the translation. Both faces are always rendered.
 * A word saved without a term is a sentence card: the example sentence takes the
 * headline on the front, and its translation the headline on the back.
 */
export function WordCard({
  word,
  revealed,
  lang: langOverride,
}: {
  word: Word;
  revealed: boolean;
  /** For a card that isn't in an open deck yet, like the preview of one being added. */
  lang?: string;
}) {
  const deckLang = useWordLang(word.id);
  const lang = langOverride ?? deckLang;
  const level = cardLevel(reviewFor(useProgress().reviews, word.id));
  const frontBody = word.term ? word.exampleSource : '';
  const backBody = word.translation ? word.exampleTarget : '';

  return (
    <div className="word-card" data-revealed={revealed}>
      <div className="word-card__inner">
        <div className="word-card__face word-card__face--front" aria-hidden={revealed}>
          <div className="word-card__meta">
            <LevelTag level={level} />
          </div>
          <p className={word.term ? 'word-card__term' : 'word-card__term word-card__term--sentence'} lang={lang}>
            {word.term || word.exampleSource}
          </p>
          {frontBody && (
            <>
              <hr className="word-card__rule" />
              <p className="word-card__example" lang={lang}>
                {frontBody}
              </p>
            </>
          )}
          <FlipHint label="Tap to turn over" />
        </div>

        <div className="word-card__face word-card__face--back" aria-hidden={!revealed}>
          <div className="word-card__meta">
            <span className="word-card__pos">{StudyRules.nativeLanguageLabel}</span>
            <LevelTag level={level} />
          </div>
          <p
            className={
              word.translation
                ? 'word-card__term word-card__term--back'
                : 'word-card__term word-card__term--back word-card__term--sentence'
            }
          >
            {word.translation || word.exampleTarget}
          </p>
          <p className="word-card__source-term" lang={lang}>
            {word.term || word.exampleSource}
          </p>
          {backBody && (
            <>
              <hr className="word-card__rule" />
              <p className="word-card__example">{backBody}</p>
            </>
          )}
          <FlipHint label="Tap to turn back" />
        </div>
      </div>
    </div>
  );
}

function FlipHint({ label }: { label: string }) {
  return (
    <span className="flip-hint">
      <span className="flip-hint__icon" aria-hidden="true">
        ↻
      </span>
      {label}
    </span>
  );
}
