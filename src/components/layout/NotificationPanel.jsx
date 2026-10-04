import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, ListChecks, CalendarClock, UserPlus, MessageSquare } from 'lucide-react';
import { useNotifications } from '../../state/NotificationContext';
import { notesService } from '../../services/notesService.js';
import { formatReminderLabel } from '../../domain/noteDomain.js';
import { reminderLabel } from '../../services/reminderService.js';
import { formatDateDisplay } from '../../utils/dateUtils.js';

// Icon per ERP reminder kind (see reminderService / server/db/reminders.js).
const KIND_ICON = { task: ListChecks, ending: CalendarClock, starting: UserPlus, reply: MessageSquare };

function isErp(notification) {
  return notification.type === 'erp_reminder';
}

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
  const navigate = useNavigate();
  const panelRef = useRef(null);

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

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.id);
    onClose();

    if (isErp(notification)) {
      if (notification.link) navigate(notification.link);
      return;
    }

    // The associated note may since have been permanently deleted — handle that safely rather
    // than navigating into a note that no longer exists.
    const note = await notesService.getById(notification.noteId).catch(() => null);
    if (!note) return;

    navigate(note.isArchived ? '/notes/archived' : '/notes', { state: { openNoteId: note.id } });
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
            const Icon = erp ? KIND_ICON[notification.kind] ?? Bell : Bell;
            const label = erp ? reminderLabel(notification) : 'Note Reminder';
            const urgent = erp && notification.kind === 'task' && notification.state === 'overdue';
            return (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                className={`header-notification-item unread ${urgent ? 'is-overdue' : ''}`}
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
    </div>
  );
}
