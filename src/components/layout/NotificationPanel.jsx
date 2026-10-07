import React, { useRef, useEffect, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '../../state/NotificationContext';
import { formatReminderLabel } from '../../domain/noteDomain.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import { notificationsOn, setNotificationsOn } from '../../services/notificationPrefs.js';
import { isErp, iconFor, labelFor, toneFor, useOpenNotification } from './notificationDisplay.js';

/** "Oct 05, 2026" for a date, "Oct 05, 2026, 3:04 PM" for a reply time. */
function erpTimeLabel(notification) {
  if (!notification.dueAt) return '';
  if (notification.kind === 'reply') return new Date(notification.dueAt).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return formatDateDisplay(String(notification.dueAt).slice(0, 10));
}

/**
 * The top header Bell's IN-APP notification dropdown: Note reminders (an optional per-note
 * Reminder becoming due — notificationService.checkDueReminders()) and the ERP reminders feed
 * (Onboarding/Offboarding tasks due today or overdue, start and end / final working dates within
 * 7 days, unseen candidate replies — notificationService.syncErpReminders()). Clicking one marks it
 * read and opens what it's about. No email is involved anywhere here.
 *
 * Shows UNREAD notifications only — this dropdown represents "things that still need
 * attention," not a permanent history. Read notifications are never destructively deleted from
 * storage (notificationService.getAll() still returns everything); they are simply filtered out
 * of what this panel displays. See NotificationContext's `unreadNotifications`.
 */
export default function NotificationPanel({ isOpen, onClose }) {
  const { unreadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const openNotification = useOpenNotification();
  const panelRef = useRef(null);
  const [alertsOn, setAlertsOn] = useState(notificationsOn);

  // Re-read when the panel opens: the switch is shared with the gateway and other Rizurf apps.
  useEffect(() => { if (isOpen) setAlertsOn(notificationsOn()); }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Most pressing first: overdue/due now (oldest due first), then everything else by due date.
  const sorted = [...unreadNotifications].sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));

  const handleNotificationClick = (notification) => {
    onClose();
    openNotification(notification);
  };

  const handleAlertsChange = (on) => {
    setNotificationsOn(on);
    setAlertsOn(on);
  };

  // Marks only this one notification as read, WITHOUT navigating anywhere — must stop
  // propagation so it doesn't also fire the row's own click-to-open behavior.
  const handleMarkAsReadOnly = (e, notification) => {
    e.stopPropagation();
    markAsRead(notification.id);
  };

  return (
    <div className="notification-panel" ref={panelRef} role="menu" aria-label="Notifications">
      <div className="notification-panel-header">
        <span>Notifications</span>
        {unreadNotifications.length > 0 && (
          <button type="button" className="notification-mark-all-btn" onClick={markAllAsRead}>
            <CheckCheck size={13} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      <div className="notification-panel-list">
        {sorted.length === 0 ? (
          <div className="notification-empty-state">
            <Bell size={22} style={{ color: 'var(--border-dark)' }} />
            <p>No notifications yet.</p>
          </div>
        ) : (
          sorted.map((notification) => {
            const erp = isErp(notification);
            const Icon = iconFor(notification);
            const label = labelFor(notification);
            const tone = toneFor(notification);
            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                className={`header-notification-item unread tone-${tone}`}
                data-kind={erp ? notification.kind : 'note'}
                onClick={() => handleNotificationClick(notification)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(notification); }}
                aria-label={`${label}: ${notification.title}. Opens it and marks this notification read.`}
              >
                <span className="header-notification-item-icon">
                  <Icon size={14} />
                </span>
                <span className="header-notification-item-body">
                  <span className="header-notification-item-type">{label}</span>
                  <span className="header-notification-item-title">{notification.title}</span>
                  <span className="header-notification-item-message">{notification.message}</span>
                  <span className="header-notification-item-time">{erp ? erpTimeLabel(notification) : formatReminderLabel(notification.dueAt)}</span>
                </span>
                <button
                  type="button"
                  className="icon-btn notification-mark-read-btn"
                  title="Mark as read"
                  aria-label="Mark as read"
                  onClick={(e) => handleMarkAsReadOnly(e, notification)}
                >
                  <Check size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* The Rizurf "Notifications" switch (saved on this device; the gateway uses the same one). */}
      <label className="notification-alerts-row" htmlFor="notifyToggle">
        <span className="notification-alerts-text">
          <span className="notification-alerts-title">Notifications</span>
          <span className="notification-alerts-sub" id="notifyToggleSub">
            {alertsOn ? 'Banner and sound in this app' : 'Off: no banners or sounds in this app'}
          </span>
        </span>
        <input
          type="checkbox"
          id="notifyToggle"
          className="notification-alerts-switch"
          role="switch"
          checked={alertsOn}
          aria-describedby="notifyToggleSub"
          onChange={(e) => handleAlertsChange(e.target.checked)}
        />
      </label>
    </div>
  );
}
