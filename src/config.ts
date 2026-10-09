/** Endpoint configuration. Override with `VITE_*` variables, see `.env.example`. */
export const config = {
  /** Same-origin by default; the Vite dev and preview servers proxy `/api` to lexico-api. */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, ''),
  /** The deck to open before one has been picked on the Decks tab, if it exists. */
  defaultDeckId: import.meta.env.VITE_DECK_ID,
  requestTimeoutMs: 8000,
} as const;
