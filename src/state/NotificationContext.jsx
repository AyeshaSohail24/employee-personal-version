import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService.js';

const NotificationContext = createContext();

// Lightweight polling interval while the app is open — this is a frontend PoC with no backend
// scheduler/push, so due reminders can only ever be detected while the app is actually running
// (on load, on this interval, and immediately after a reminder is set/removed). 30s is frequent
// enough to feel responsive for a reminder due "now" without being wasteful.
const POLL_INTERVAL_MS = 30000;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    // A due-reminder check that throws for any reason must never permanently stall future
    // checks — without this try/catch, an uncaught rejection here would skip setNotifications()
    // forever after, leaving the bell/panel silently stuck on stale data with no visible error.
    try {
      await notificationService.checkDueReminders();
      const all = await notificationService.getAll();
      if (mountedRef.current) setNotifications(all);
    } catch (err) {
      console.error('NotificationContext: failed to refresh due reminders.', err);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    // Browsers throttle (or fully suspend) setInterval timers in backgrounded/minimized tabs, so
    // a reminder that became due while the tab was out of focus might not surface until the next
    // un-throttled tick. Re-checking immediately on visibility/focus return closes that gap —
    // the user sees an accurate unread state the moment they come back to the app, not up to a
    // full poll interval later.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refresh);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  const markAsRead = useCallback(async (id) => {
    await notificationService.markAsRead(id);
    refresh();
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    refresh();
  }, [refresh]);

  // `notifications` (all, read and unread) is exposed for consumers that need the full history
  // to derive state — e.g. NoteCard/NotesDocumentView's getReminderAttentionState(), which must
  // tell "due + read" apart from "due + unread" and would lose that distinction if it only ever
  // saw the filtered list. `unreadNotifications` is the one the Header dropdown actually
  // displays — read notifications stay in storage (never destructively deleted just to hide
  // them) but are simply filtered out of what the dropdown shows.
  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const unreadCount = unreadNotifications.length;

  const value = { notifications, unreadNotifications, unreadCount, markAsRead, markAllAsRead, refresh };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
