import { normalize } from './text';

/** Languages whose names are recognised, as BCP 47 codes. */
const CODES = [
  'ar', 'be', 'bg', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'eu', 'fa', 'fi', 'fr', 'ga', 'gl', 'he',
  'hi', 'hr', 'hu', 'is', 'it', 'ja', 'ko', 'lt', 'lv', 'nb', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr',
  'sv', 'tr', 'uk', 'zh',
];

let index: Map<string, string> | null = null;

/** Every language's own name ("polski"), English name ("Polish") and code ("pl"), mapped to its code. */
function nameIndex(): Map<string, string> {
  if (index) return index;
  index = new Map();
  const english = new Intl.DisplayNames(['en'], { type: 'language' });
  for (const code of CODES) {
    const native = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    for (const name of [native, english.of(code), code]) {
      if (name) index.set(normalize(name), code);
    }
  }
  return index;
}

/**
 * The code for a deck's language label: "Español", "Spanish" or "es" → "es".
 * `undefined` when the label isn't recognised. Used for `lang` attributes
 * (screen readers, spell-check) and readable card ids.
 */
export function languageCode(label: string): string | undefined {
  return nameIndex().get(normalize(label.trim()));
}
