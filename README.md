# lexico-web

Web client for Léxico: a single-page React app that studies vocabulary decks served by
[`../lexico-api`](../lexico-api). It mirrors the Flutter app (`../lexico`): same flip-and-swipe
cards, spaced-repetition rules, XP, levels and streaks.

## Run

Start the API first (see its README), then:

```sh
npm install
npm run dev          # http://localhost:5173
```

The dev and preview servers proxy `/api/*` to `http://localhost:3000/*`, dropping the prefix
(see `vite.config.ts`). The API's own paths (`/decks`, `/words/…`) would clash with this app's
pages, hence the prefix. The browser never makes a cross-origin call, so any port works. Only
when `VITE_API_BASE_URL` is an absolute URL does the API's `CORS_ORIGIN` need to list this app.

The API is described in [`../lexico-api/API.md`](../lexico-api/API.md).

## Configuration

Copy `.env.example` to `.env.local` to override:

| Variable            | Default                                              |
| ------------------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL` | `/api` (proxied to `http://localhost:3000`)          |
| `VITE_DECK_ID`      | none: the deck to open before one is picked; else the oldest |

## Screens

| Route    | What it does                                                                 |
| -------- | ---------------------------------------------------------------------------- |
| `/`      | Today, for the deck being studied: cards due, level and XP, known / shaky / accuracy, start a session |
| `/decks` | Every deck; pick the one to study, or create a new one                       |
| `/decks/:deckId` | One deck's cards, as on `/words`; study it, or delete it               |
| `/study` | A session of up to 8 cards (changeable in Settings), then a summary. Any card can be studied at any time: due cards come first, then the ones coming back soonest |
| `/words` | The deck's cards with search, level and progress filters, per-card history   |
| `/words/new` | Add cards to the deck: one at a time with a live preview, or paste a whole list |
| `/settings` | How many cards a session holds (1–100), and whether missed cards repeat at the end of the session until answered right. Remembered in this browser |

In a session: click or <kbd>Space</kbd> turns the card, drag or <kbd>→</kbd> / <kbd>←</kbd>
answers "knew it" / "review", <kbd>Esc</kbd> ends early (answers given still count).

## Data

- **Decks** come from `GET /decks` and are created with `POST /decks`. The deck being studied
  is picked on the Decks tab and remembered in this browser. A deck's language label
  ("Español", "Polski", "Spanish"…) is matched to a language code for `lang` attributes and
  readable card ids; an unrecognised label just goes without them.
- **Words** come from `GET /decks/:deckId/words`. The last successful response for each deck
  (and the deck list) is kept in localStorage, so the app still works, with a notice, when the
  API is down.
- **Answers** are sent to `POST /words/:wordId/reviews` in the background; failures show one
  notification with a Retry.
- **New cards** are saved with `POST /decks/:deckId/words`; a pasted list goes in one
  all-or-nothing request. A card needs an example sentence and its translation; the word and
  its translation are optional, and a card without a word is studied as a whole sentence. The
  API gives new cards level A1.
  - Cards with a word get an id in the seed's style (`la ventana` → `es-ventana`, `-2` if taken
    in this deck) when the deck's language is recognised; if another deck has it (409), the app
    retries once and lets the API pick.
  - Pasted lists are parsed by `src/lib/pairs.ts`; the ⓘ button on the page shows the accepted
    formats. Sentences already in the deck, or pasted twice, are skipped.
  - New cards are due straight away. Rerunning `npm run db:seed` in lexico-api deletes cards
    that aren't in the deck's JSON file, including everything added here.
- **Editing** a card (Edit in its expanded row, `PATCH /words/:wordId`) changes its sentence,
  translation, word and the word's translation, with the same rules as adding one; clearing the
  word turns it into a sentence card. Only changed fields are sent. Its id, place in the deck and
  study progress stay.
- **Deleting** a deck (button at the bottom of its page, `DELETE /decks/:deckId`) takes its
  cards with it; deleting a card (in its expanded row, `DELETE /words/:wordId`) leaves the rest
  of the deck in order. Both ask first and can't be undone. The app then drops its saved copy
  and the cards' study progress, since the API lets their ids be used again. Something already
  deleted elsewhere (404) counts as deleted.
- **Progress** (reviews, sessions, XP, streak) is stored in this browser's localStorage, like
  the Flutter app stores it on the device. The API has no progress endpoints yet, so progress
  is not shared between browsers or with the mobile app. "Reset progress" on the Words page
  clears it.

The scheduling rules live in `src/domain/` and match `lib/features/vocabulary/domain/` in the
Flutter app; change both together.

## Scripts

| Script            | What it does                         |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Dev server with hot reload           |
| `npm run build`   | Type-check and build to `dist/`      |
| `npm run preview` | Serve the built app                  |
| `npm run lint`    | Oxlint                               |
