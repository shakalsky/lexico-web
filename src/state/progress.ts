import { useSyncExternalStore } from 'react';
import { schedule } from '../domain/scheduler';
import { reviewFor, streakFromDays } from '../domain/stats';
import type { ReviewGrade, ReviewState, SessionLog } from '../domain/types';
import { readJson, removeKey, writeJson } from './storage';

/**
 * The learner's history. The API only serves deck content, so, like the
 * Flutter app, progress stays on the device: here, in localStorage.
 */
export interface Progress {
  reviews: Record<string, ReviewState>;
  sessions: SessionLog[];
}

const storageKey = 'lexico.v1.progress';
const empty: Progress = { reviews: {}, sessions: [] };

function load(): Progress {
  const stored = readJson<Progress>(storageKey);
  return stored && typeof stored.reviews === 'object' && Array.isArray(stored.sessions) ? stored : empty;
}

let progress = load();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: Progress) {
  progress = next;
  writeJson(storageKey, next);
  emit();
}

// Keep tabs in step: an answer given in one tab shows up in the others.
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  progress = load();
  emit();
});

/** Runs one answer through the scheduler and stores the result. */
export function recordReview(wordId: string, grade: ReviewGrade, now: number): ReviewState {
  const next = schedule(reviewFor(progress.reviews, wordId), grade, now);
  commit({ ...progress, reviews: { ...progress.reviews, [wordId]: next } });
  return next;
}

/** Logs a sitting and returns the streak length that results. */
export function logSession(session: SessionLog): number {
  const sessions = [...progress.sessions, session];
  commit({ ...progress, sessions });
  return streakFromDays(
    sessions.map((s) => s.endedAt),
    session.endedAt,
  );
}

/** Forgets the schedule of these cards, so they come back as new. XP and streak stay. */
export function resetReviews(wordIds: string[]) {
  const reviews = { ...progress.reviews };
  for (const id of wordIds) delete reviews[id];
  commit({ ...progress, reviews });
}

export function resetProgress() {
  removeKey(storageKey);
  progress = empty;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, () => progress);
}
