import type { CardLevel } from '../domain/types';

/** The little A1 / B2 chip in the corner of a card. */
export function LevelTag({ level }: { level: CardLevel }) {
  return <span className={`level-tag level-tag--${level.toLowerCase()}`}>{level}</span>;
}

/** One of the small numbers under the XP bar. */
export function StatTile({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="stat-tile">
      <span className={accent ? 'stat-tile__value stat-tile__value--accent' : 'stat-tile__value'}>{value}</span>
      <span className="stat-tile__label">{label}</span>
    </div>
  );
}

/** "12 day streak" with the slow breathing dot. */
export function StreakPill({ days }: { days: number }) {
  return (
    <span className="streak-pill">
      <span className="streak-pill__dot" aria-hidden="true" />
      {days === 1 ? '1 day streak' : `${days} day streak`}
    </span>
  );
}

/** A glowing progress track; `progress` is `0…1`. */
export function ProgressBar({ progress, label, thin = false }: { progress: number; label: string; thin?: boolean }) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <div
      className={thin ? 'progress progress--thin' : 'progress'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className="progress__fill" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />;
}
