import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '../../state/NotificationContext';
import { notesService } from '../../services/notesService.js';
import { formatReminderLabel } from '../../domain/noteDomain.js';

/**
 * The top header Bell's IN-APP notification dropdown. Currently the only notification type is
 * 'note_reminder' (an optional per-note Reminder becoming due) — see notificationService for
 * where these are generated. No email is involved anywhere in this panel or its click-through.
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

  const handleNotificationClick = async (notification) => {
    await markAsRead(notification.id);
    onClose();

    // The associated note may since have been permanently deleted — handle that safely rather
    // than navigating into a note that no longer exists.
    const note = await notesService.getById(notification.noteId).catch(() => null);
    if (!note) return;

    navigate(note.isArchived ? '/notes/archived' : '/notes', { state: { openNoteId: note.id } });
  };

  // Marks only this one notification as read, WITHOUT navigating anywhere — must stop
  // propagation so it doesn't also fire the row's own click-to-open-note behavior.
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
        {unreadNotifications.length === 0 ? (
          <div className="notification-empty-state">
            <Bell size={22} style={{ color: 'var(--border-dark)' }} />
            <p>No notifications yet.</p>
          </div>
        ) : (
          unreadNotifications.map((notification) => (
            <div
              key={notification.id}
              role="button"
              tabIndex={0}
              className="header-notification-item unread"
              onClick={() => handleNotificationClick(notification)}
              aria-label={`Note Reminder: ${notification.title}. Opens the note and marks this notification read.`}
            >
              <span className="header-notification-item-icon">
                <Bell size={14} />
              </span>
              <span className="header-notification-item-body">
                <span className="header-notification-item-type">Note Reminder</span>
                <span className="header-notification-item-title">{notification.title}</span>
                <span className="header-notification-item-message">{notification.message}</span>
                <span className="header-notification-item-time">{formatReminderLabel(notification.dueAt)}</span>
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
          ))
        )}
      </div>
    </div>
  );
}
