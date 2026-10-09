export interface SentencePair {
  source: string;
  target: string;
}

export interface ParsedPairs {
  pairs: SentencePair[];
  /** Lines that couldn't be matched with a translation. */
  unpaired: string[];
}

/** "1. ", "12) " at the start of a line. */
const NUMBERING = /^\d+\s*[.)]\s*/;

/**
 * What can sit between a sentence and its translation, strongest first: a tab
 * (spreadsheet columns), a bar, an em or en dash, or a hyphen with spaces on
 * both sides (a bare hyphen is part of words like "e-mail").
 */
const SEPARATORS = [/\t+/, /\s*\|\s*/, /\s*[—–]\s*/, /\s+-\s+/];

function splitInline(text: string): SentencePair | null {
  for (const separator of SEPARATORS) {
    const match = separator.exec(text);
    if (!match) continue;
    const source = text.slice(0, match.index).trim();
    const target = text.slice(match.index + match[0].length).trim();
    if (source && target) return { source, target };
  }
  return null;
}

/**
 * Reads pasted sentence/translation pairs. Accepts one pair per line split by
 * a separator, or the sentence and its translation on separate lines (blank
 * lines between them are fine). List numbering is ignored and, when present,
 * marks where each pair starts, so a translation may wrap onto the next line.
 */
export function parsePairs(input: string): ParsedPairs {
  const lines = input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const numbered = lines.some((line) => NUMBERING.test(line));
  const pairs: SentencePair[] = [];
  const unpaired: string[] = [];

  if (numbered) {
    // Each number starts an entry; following unnumbered lines belong to it.
    const entries: string[][] = [];
    for (const line of lines) {
      if (NUMBERING.test(line) || entries.length === 0) entries.push([line.replace(NUMBERING, '')]);
      else entries[entries.length - 1].push(line);
    }
    for (const [first, ...rest] of entries) {
      const inline = splitInline(first);
      if (inline) {
        pairs.push({ source: inline.source, target: [inline.target, ...rest].join(' ') });
      } else if (rest.length > 0) {
        pairs.push({ source: first, target: rest.join(' ') });
      } else {
        unpaired.push(first);
      }
    }
    return { pairs, unpaired };
  }

  // Unnumbered: lines with a separator stand alone; the rest pair up in order,
  // sentence then translation.
  let pending: string | null = null;
  for (const line of lines) {
    const inline = splitInline(line);
    if (inline) {
      if (pending !== null) unpaired.push(pending);
      pending = null;
      pairs.push(inline);
    } else if (pending === null) {
      pending = line;
    } else {
      pairs.push({ source: pending, target: line });
      pending = null;
    }
  }
  if (pending !== null) unpaired.push(pending);
  return { pairs, unpaired };
}
