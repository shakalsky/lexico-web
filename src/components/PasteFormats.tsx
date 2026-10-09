import { Fragment } from 'react';
import { parsePairs } from '../lib/pairs';

interface FormatExample {
  title: string;
  note: string;
  text: string;
}

/** Each example is run through the real parser, so the card counts shown can't drift from it. */
const EXAMPLES: FormatExample[] = [
  {
    title: 'A dash between them',
    note: 'An em dash, an en dash, or a hyphen with spaces around it.',
    text: 'Hola. — Hello.\nTengo frío - I am cold.',
  },
  {
    title: 'A bar or a tab',
    note: 'Two columns copied from a spreadsheet are split by a tab.',
    text: 'Hola | Hello\nGracias\tThank you',
  },
  {
    title: 'A numbered list',
    note: 'The numbers are dropped. Blank lines between items are fine.',
    text: '1. Hola. — Hello.\n\n2. Gracias. — Thank you.',
  },
  {
    title: 'The translation on its own line',
    note: 'Sentence first, then its translation, with or without a blank line between.',
    text: 'Hola, ¿qué tal?\n\nHi, how are you?',
  },
];

/** Shows tabs, which are otherwise invisible, as ⇥. */
function ExampleText({ text }: { text: string }) {
  const parts = text.split('\t');
  return (
    <pre className="formats__text">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="formats__tab" title="tab">
              ⇥
            </span>
          )}
          {part}
        </Fragment>
      ))}
    </pre>
  );
}

/** The accepted ways to paste a list, opened from the info button next to the paste box. */
export function PasteFormats({ id }: { id: string }) {
  return (
    <section id={id} className="formats" aria-label="Accepted list formats">
      <ul className="formats__grid">
        {EXAMPLES.map((example) => {
          const cards = parsePairs(example.text).pairs.length;
          return (
            <li key={example.title} className="formats__example">
              <div className="formats__head">
                <span className="formats__title">{example.title}</span>
                <span className="formats__count">
                  {cards} {cards === 1 ? 'card' : 'cards'}
                </span>
              </div>
              <ExampleText text={example.text} />
              <p className="formats__note">{example.note}</p>
            </li>
          );
        })}
      </ul>
      <ul className="formats__rules">
        <li>A hyphen inside a word, like e-mail, doesn't split a line.</li>
        <li>Lines without a translation are listed in a warning and skipped.</li>
        <li>Sentences already in the deck, or pasted twice, are skipped.</li>
      </ul>
    </section>
  );
}
