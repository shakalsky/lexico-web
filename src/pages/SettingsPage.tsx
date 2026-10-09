import { useState } from 'react';
import {
  SESSION_LENGTH_MAX,
  SESSION_LENGTH_MIN,
  setRepeatMissed,
  setSessionLength,
  useSettings,
} from '../state/settings';

const SESSION_PRESETS = [5, 10, 15, 20, 30];

export function SettingsPage() {
  return (
    <div className="settings">
      <h1 className="display display--md">Settings</h1>
      <SessionLengthField />
      <RepeatMissedSwitch />
    </div>
  );
}

function RepeatMissedSwitch() {
  const { repeatMissed } = useSettings();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={repeatMissed}
      className="switch settings__switch"
      onClick={() => setRepeatMissed(!repeatMissed)}
      aria-describedby="repeat-missed-hint"
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className="switch__text">
        <span className="switch__label">Repeat missed words</span>
        <span id="repeat-missed-hint" className="switch__hint">
          {repeatMissed
            ? 'A word marked "review" goes back to the end of the session until you get it right.'
            : 'Each word comes up once per session, right or wrong.'}
        </span>
      </span>
    </button>
  );
}

/** Saved as soon as it changes; there is no Save button. */
function SessionLengthField() {
  const { sessionLength } = useSettings();
  // What's typed, so the box can be cleared on the way to a new number.
  const [draft, setDraft] = useState<string | null>(null);

  const value = Number(draft);
  const invalid =
    draft !== null && (draft.trim() === '' || !Number.isInteger(value) || value < SESSION_LENGTH_MIN || value > SESSION_LENGTH_MAX);

  return (
    <section className="form settings__section" aria-labelledby="session-length-label">
      <div className="field">
        <label id="session-length-label" className="field__label" htmlFor="session-length">
          Words per session
        </label>
        <div className="chips" role="group" aria-label="Common session lengths">
          {SESSION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="chip"
              aria-pressed={draft === null && sessionLength === preset}
              onClick={() => {
                setDraft(null);
                setSessionLength(preset);
              }}
            >
              {preset}
            </button>
          ))}
        </div>
        <input
          id="session-length"
          className="input settings__number"
          type="number"
          inputMode="numeric"
          min={SESSION_LENGTH_MIN}
          max={SESSION_LENGTH_MAX}
          step={1}
          value={draft ?? String(sessionLength)}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const n = Number(next);
            if (next.trim() !== '' && Number.isInteger(n) && n >= SESSION_LENGTH_MIN && n <= SESSION_LENGTH_MAX) {
              setSessionLength(n);
            }
          }}
          // Leaving the box shows what was actually saved.
          onBlur={() => setDraft(null)}
          aria-invalid={invalid}
          aria-describedby="session-length-note"
        />
        <p id="session-length-note" className="field__note" aria-live="polite">
          {invalid ? (
            <span className="field__error">
              Enter a whole number from {SESSION_LENGTH_MIN} to {SESSION_LENGTH_MAX}.
            </span>
          ) : (
            <span className="field__hint">
              Each session holds up to {sessionLength} {sessionLength === 1 ? 'card' : 'cards'}, fewer if the decks
              are smaller. Saved in this browser.
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
