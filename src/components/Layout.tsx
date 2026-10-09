import { Link, NavLink, Outlet } from 'react-router';
import { formatRelative, useNow } from '../lib/time';
import { refreshWords, useDeck } from '../state/deck';
import { refreshDecks, useDecks } from '../state/decks';

/** Header, offline notice and the current page. The study screen goes without it. */
export function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          léxico
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Today
          </NavLink>
          <NavLink to="/decks">Decks</NavLink>
          <NavLink to="/words">Words</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <OfflineNotice />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

/** The API is down but a saved copy of the decks or words is on screen. */
function OfflineNotice() {
  const open = useDeck();
  const decks = useDecks();
  const now = useNow();

  const wordsStale = Boolean(open.error && open.words);
  const decksStale = Boolean(decks.error && decks.decks);
  if (!wordsStale && !decksStale) return null;

  const savedAt =
    wordsStale && open.fetchedAt ? ` from ${formatRelative(Math.min(open.fetchedAt, now), now)}` : '';

  return (
    <div className="notice" role="status">
      <p>
        Showing a saved copy{savedAt}. {wordsStale ? open.error : decks.error}
      </p>
      <button
        type="button"
        className="chip"
        onClick={() => {
          void refreshDecks();
          void refreshWords();
        }}
        disabled={open.loading || decks.loading}
      >
        Retry
      </button>
    </div>
  );
}
