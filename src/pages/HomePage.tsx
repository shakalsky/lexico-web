import { Link } from 'react-router';
import { DeckGate } from '../components/DeckGate';
import { ProgressBar, StatTile, StreakPill } from '../components/ui';
import { deckLanguages, deckNames } from '../domain/decks';
import { StudyRules } from '../domain/rules';
import { learnerStats } from '../domain/stats';
import type { Deck, Word } from '../domain/types';
import { useNow } from '../lib/time';
import { useProgress } from '../state/progress';

export function HomePage() {
  return <DeckGate>{(words, decks) => <Home words={words} decks={decks} />}</DeckGate>;
}

function Home({ words, decks }: { words: Word[]; decks: Deck[] }) {
  const { reviews, sessions } = useProgress();
  const now = useNow();
  const stats = learnerStats(words, reviews, sessions, now);
  const anyDue = stats.dueCount > 0;

  return (
    <div className="home">
      <div className="home__top">
        <span className="eyebrow">Today · {deckNames(decks)}</span>
        <StreakPill days={stats.streakDays} />
      </div>

      <h1 className="display display--xl home__headline">
        {stats.dueCount === 1 ? '1 word' : `${stats.dueCount} words`}
        <br />
        <em>{anyDue ? 'waiting for you' : 'all reviewed'}</em>
      </h1>
      {words.length > 0 && (
        // The headline only counts what's due, so say where the rest of the cards are.
        <p className="home__due">
          {stats.dueCount === words.length
            ? `All ${words.length} due`
            : `${stats.dueCount} of ${words.length} due · ${words.length - stats.dueCount} scheduled later`}
        </p>
      )}

      <div className="home__level">
        <span>
          Level {stats.level} · {deckLanguages(decks)}
        </span>
        <span>
          <strong>{stats.xpIntoLevel}</strong> / {StudyRules.xpPerLevel} XP
        </span>
      </div>
      <ProgressBar progress={stats.levelProgress} label={`Level ${stats.level} progress`} />

      <div className="stat-row">
        <StatTile value={`${stats.knownCount}`} label="known" />
        <StatTile value={`${stats.shakyCount}`} label="shaky" />
        <StatTile value={`${stats.accuracyPercent}%`} label="accuracy" accent />
      </div>

      <div className="home__cta">
        <p className="hint">
          {words.length === 0
            ? decks.length === 1
              ? 'This deck has no cards yet.'
              : 'These decks have no cards yet.'
            : anyDue
              ? 'Turn the card to check. Swipe right if you knew it.'
              : 'Nothing is due, but you can practise any time. The cards coming back soonest go first.'}
        </p>
        {words.length === 0 ? (
          <Link to="/words/new" className="btn btn--primary">
            Add cards
          </Link>
        ) : (
          <Link to="/study" className="btn btn--primary">
            Start session
          </Link>
        )}
      </div>
    </div>
  );
}
