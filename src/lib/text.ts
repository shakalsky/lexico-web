/** Folds accents and case so "cariño" matches "carino". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

const SPANISH_ARTICLE = /^(el|la|los|las|lo|un|una|unos|unas)\s+/;

/**
 * The id style used in `lexico-api/data/decks`: `el atardecer` → `es-atardecer`.
 * Returns `null` when the term has nothing to build a slug from.
 */
export function wordIdFor(term: string, lang: string): string | null {
  let base = normalize(term.trim());
  if (lang === 'es') base = base.replace(SPANISH_ARTICLE, '');
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug ? `${lang}-${slug}` : null;
}

/** `base`, or `base-2`, `base-3`… whichever is free. */
export function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
