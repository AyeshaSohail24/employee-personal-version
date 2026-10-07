import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ListChecks, CalendarClock, UserPlus, MessageSquare } from 'lucide-react';
import { useNotifications } from '../../state/NotificationContext';
import { notesService } from '../../services/notesService.js';
import { reminderLabel } from '../../services/reminderService.js';

// How a bell notification is shown — shared by the bell's panel (NotificationPanel) and the
// top-right banners (NotificationBanners), so both read and behave the same.

// Icon per ERP reminder kind (see reminderService / server/db/reminders.js).
const KIND_ICON = { task: ListChecks, ending: CalendarClock, starting: UserPlus, reply: MessageSquare };

export function isErp(notification) {
  return notification.type === 'erp_reminder';
}

export function iconFor(notification) {
  return isErp(notification) ? KIND_ICON[notification.kind] ?? Bell : Bell;
}

export function labelFor(notification) {
  return isErp(notification) ? reminderLabel(notification) : 'Note Reminder';
}

// Colour of the type label and icon (only those — the card, title and text stay neutral), from the
// ERP's status palette: error = overdue, warning = due today / ending, info = due soon / candidate
// reply, success = starting, primary = note reminder.
export function toneFor(notification) {
  if (!isErp(notification)) return 'primary';
  switch (notification.kind) {
    case 'task': return notification.state === 'overdue' ? 'error' : notification.state === 'today' ? 'warning' : 'info';
    case 'ending': return 'warning';
    case 'starting': return 'success';
    case 'reply': return 'info';
    default: return 'primary';
  }
}

/** Opening a notification: marks it read for this account, then goes to what it's about. */
export function useOpenNotification() {
  const { markAsRead } = useNotifications();
  const navigate = useNavigate();
  return useCallback(async (notification) => {
    await markAsRead(notification.id);
    if (isErp(notification)) {
      if (notification.link) navigate(notification.link);
      return;
    }
    // The associated note may since have been permanently deleted — handle that safely rather
    // than navigating into a note that no longer exists.
    const note = await notesService.getById(notification.noteId).catch(() => null);
    if (!note) return;
    navigate(note.isArchived ? '/notes/archived' : '/notes', { state: { openNoteId: note.id } });
  }, [markAsRead, navigate]);
}
