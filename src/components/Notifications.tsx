import { dismissNotification, useNotifications } from '../state/notifications';

/** App-wide notices, pinned to the top of the window on every page. */
export function Notifications() {
  const notifications = useNotifications();

  return (
    <div className="notifications" role="alert" aria-live="assertive">
      {notifications.map((notification) => (
        <div key={notification.key} className="notification">
          <div className="notification__text">
            <p className="notification__title">{notification.title}</p>
            {notification.detail && <p className="notification__detail">{notification.detail}</p>}
          </div>
          {notification.action && (
            <button type="button" className="chip" onClick={notification.action.run}>
              {notification.action.label}
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label="Dismiss"
            onClick={() => dismissNotification(notification.key)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
