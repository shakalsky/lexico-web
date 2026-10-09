import { useSyncExternalStore } from 'react';
import { StudyRules } from '../domain/rules';
import { readJson, writeJson } from './storage';

/** The learner's preferences, kept in this browser like their progress. */
export interface Settings {
  /** How many cards one sitting holds. */
  sessionLength: number;
  /** A card marked "review" goes back to the end of the session until it's answered right. */
  repeatMissed: boolean;
}

export const SESSION_LENGTH_MIN = 1;
export const SESSION_LENGTH_MAX = 100;

const storageKey = 'lexico.v1.settings';
const defaults: Settings = { sessionLength: StudyRules.sessionLength, repeatMissed: false };

/** A whole number within bounds; anything else falls back to the default. */
export function clampSessionLength(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaults.sessionLength;
  return Math.min(SESSION_LENGTH_MAX, Math.max(SESSION_LENGTH_MIN, Math.round(value)));
}

function load(): Settings {
  const stored = readJson<Partial<Settings>>(storageKey);
  return {
    sessionLength: clampSessionLength(stored?.sessionLength),
    repeatMissed: typeof stored?.repeatMissed === 'boolean' ? stored.repeatMissed : defaults.repeatMissed,
  };
}

let settings = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: Settings) {
  settings = next;
  writeJson(storageKey, next);
  emit();
}

// Keep tabs in step, as with progress.
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  settings = load();
  emit();
});

export function setSessionLength(value: number) {
  const sessionLength = clampSessionLength(value);
  if (sessionLength !== settings.sessionLength) commit({ ...settings, sessionLength });
}

export function setRepeatMissed(repeatMissed: boolean) {
  if (repeatMissed !== settings.repeatMissed) commit({ ...settings, repeatMissed });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings);
}
