import { postReview } from '../api/words';
import { clearNotification, notify } from './notifications';

interface PendingReview {
  wordId: string;
  correct: boolean;
}

const NOTICE_KEY = 'review-failed';

/** Answers the server didn't take, kept until they're retried or the notice is closed. */
let failed: PendingReview[] = [];
let lastError = '';

/**
 * Sends an answer to the server's per-word counters without holding up the
 * session. Success is silent; failures gather into one notification with a retry.
 * Progress in this browser is saved separately, so a failure here loses nothing locally.
 */
export function sendReview(wordId: string, correct: boolean) {
  postReview(wordId, correct).catch((error: unknown) => {
    failed.push({ wordId, correct });
    lastError = error instanceof Error ? error.message : String(error);
    showFailureNotice();
  });
}

function showFailureNotice() {
  notify({
    key: NOTICE_KEY,
    title:
      failed.length === 1
        ? "An answer wasn't saved to the server"
        : `${failed.length} answers weren't saved to the server`,
    detail: lastError,
    action: { label: 'Retry', run: retryFailed },
    onDismiss: () => {
      failed = [];
    },
  });
}

function retryFailed() {
  const retrying = failed;
  failed = [];
  clearNotification(NOTICE_KEY);
  for (const review of retrying) sendReview(review.wordId, review.correct);
}
