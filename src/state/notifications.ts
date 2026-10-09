import { useSyncExternalStore } from 'react';

export interface Notification {
  /** Posting again with the same key replaces the notification instead of stacking another. */
  key: string;
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
  /** Called when the person closes it. */
  onDismiss?: () => void;
}

let notifications: Notification[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function notify(notification: Notification) {
  const index = notifications.findIndex((n) => n.key === notification.key);
  notifications =
    index === -1
      ? [...notifications, notification]
      : notifications.map((n, i) => (i === index ? notification : n));
  emit();
}

/** Removes it without running `onDismiss`; for code that has resolved the problem itself. */
export function clearNotification(key: string) {
  notifications = notifications.filter((n) => n.key !== key);
  emit();
}

/** The person closed it. */
export function dismissNotification(key: string) {
  const notification = notifications.find((n) => n.key === key);
  clearNotification(key);
  notification?.onDismiss?.();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotifications(): Notification[] {
  return useSyncExternalStore(subscribe, () => notifications);
}
