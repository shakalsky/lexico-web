import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` so due counts stay honest. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "in 9 minutes", "tomorrow", "3 days ago". */
export function formatRelative(time: number, now: number): string {
  const diff = time - now;
  for (const [unit, ms] of steps) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return diff > 0 ? 'in a moment' : 'just now';
}
