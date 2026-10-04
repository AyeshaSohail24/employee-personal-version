import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService.js';
import { reminderService } from '../services/reminderService.js';
import { useAutoRefresh } from '../hooks/useAutoRefresh.js';
import { useSession } from './SessionContext';

const NotificationContext = createContext();

// Lightweight polling interval while the app is open — this is a frontend PoC with no backend
// scheduler/push, so due reminders can only ever be detected while the app is actually running
// (on load, on this interval, and immediately after a reminder is set/removed). 30s is frequent
// enough to feel responsive for a reminder due "now" without being wasteful.
const POLL_INTERVAL_MS = 30000;

// The ERP reminders feed (server — reminderService) is re-read on load, every 10 minutes while the
// tab is visible (useAutoRefresh, same as every live page), when the app's data changes (any save —
// see apiClient's 'rizurf:data-changed'), and when the bell is opened if it's over a minute old.
export const DATA_CHANGED_EVENT = 'rizurf:data-changed';
const FEED_STALE_AFTER_MS = 60 * 1000;
const DATA_CHANGED_DEBOUNCE_MS = 800;

// Read/unread belongs to the signed-in HR account (server — notificationService.syncReadState()).
// It's re-read with the feed, when the tab is shown or focused again, and when the bell opens —
// at most every 15 seconds — so a notification read on another device shows read here too.
const READS_STALE_AFTER_MS = 15 * 1000;

export function NotificationProvider({ children }) {
  const session = useSession();
  // The signed-in account (gateway user id) — read state is kept per account.
  const account = session?.sub ? `user:${session.sub}` : session?.email ? `email:${String(session.email).toLowerCase()}` : null;
  const [notifications, setNotifications] = useState([]);
  // The latest reminders feed — also read directly by the Dashboard's Soonest Due Tasks and Ending
  // Within 7 Days (null until the first read; `feedError` if the last read failed).
  const [reminders, setReminders] = useState(null);
  const [feedError, setFeedError] = useState(false);
  const mountedRef = useRef(true);
  const feedReadAt = useRef(0);
  const feedInFlight = useRef(null);
  const readsSyncedAt = useRef(0);

  const refresh = useCallback(async () => {
    // A due-reminder check that throws for any reason must never permanently stall future
    // checks — without this try/catch, an uncaught rejection here would skip setNotifications()
    // forever after, leaving the bell/panel silently stuck on stale data with no visible error.
    try {
      await notificationService.checkDueReminders();
      notificationService.applyReadState(account);
      const all = await notificationService.getAll();
      if (mountedRef.current) setNotifications(all);
    } catch (err) {
      console.error('NotificationContext: failed to refresh due reminders.', err);
    }
  }, [account]);

  // Re-reads this account's read state from the server (sending any reads not saved yet), then
  // shows it. `force`: even if it was re-read in the last 15 seconds.
  const refreshReads = useCallback(async ({ force = false } = {}) => {
    if (!force && Date.now() - readsSyncedAt.current < READS_STALE_AFTER_MS) return refresh();
    readsSyncedAt.current = Date.now();
    await notificationService.syncReadState(account);
    return refresh();
  }, [account, refresh]);

  // Re-reads the reminders feed and brings the bell in line with it. A failed read keeps the last
  // feed and every existing notification (syncErpReminders() only clears what a loaded source no
  // longer lists). Concurrent calls share one request.
  const refreshReminders = useCallback(async ({ fresh = false } = {}) => {
    if (feedInFlight.current) return feedInFlight.current;
    feedInFlight.current = (async () => {
      try {
        const feed = await reminderService.getFeed({ fresh });
        feedReadAt.current = Date.now();
        await notificationService.syncErpReminders(feed);
        if (mountedRef.current) {
          setReminders(feed);
          setFeedError(false);
        }
      } catch (err) {
        console.error('NotificationContext: failed to read the reminders feed.', err);
        if (mountedRef.current) setFeedError(true);
      } finally {
        feedInFlight.current = null;
        await refreshReads({ force: true });
      }
    })();
    return feedInFlight.current;
  }, [refreshReads]);

  // When the bell opens: only re-read if the feed is over a minute old.
  // Also re-reads the account's read state (another device may have read some).
  const refreshRemindersIfStale = useCallback(() => {
    if (Date.now() - feedReadAt.current > FEED_STALE_AFTER_MS) refreshReminders({ fresh: true });
    else refreshReads();
  }, [refreshReminders, refreshReads]);

  useEffect(() => {
    refreshReminders();
    let timer = null;
    const onDataChanged = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshReminders({ fresh: true }), DATA_CHANGED_DEBOUNCE_MS);
    };
    window.addEventListener(DATA_CHANGED_EVENT, onDataChanged);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DATA_CHANGED_EVENT, onDataChanged);
    };
  }, [refreshReminders]);

  useAutoRefresh(() => refreshReminders({ fresh: true }));

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    // Browsers throttle (or fully suspend) setInterval timers in backgrounded/minimized tabs, so
    // a reminder that became due while the tab was out of focus might not surface until the next
    // un-throttled tick. Re-checking immediately on visibility/focus return closes that gap —
    // the user sees an accurate unread state the moment they come back to the app, not up to a
    // full poll interval later.
    // Coming back to the tab also re-reads the account's read state (throttled).
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshReads();
    };
    const handleFocus = () => refreshReads();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refresh, refreshReads]);

  // Read for the signed-in account — shown straight away, saved to the account on the server.
  const markAsRead = useCallback(async (id) => {
    const pending = notificationService.markAsRead(id, account);
    await refresh();
    await pending;
    refresh();
  }, [account, refresh]);

  const markAllAsRead = useCallback(async () => {
    const pending = notificationService.markAllAsRead(account);
    await refresh();
    await pending;
    refresh();
  }, [account, refresh]);

  // `notifications` (all, read and unread) is exposed for consumers that need the full history
  // to derive state — e.g. NoteCard/NotesDocumentView's getReminderAttentionState(), which must
  // tell "due + read" apart from "due + unread" and would lose that distinction if it only ever
  // saw the filtered list. `unreadNotifications` is the one the Header dropdown actually
  // displays — read notifications stay in storage (never destructively deleted just to hide
  // them) but are simply filtered out of what the dropdown shows.
  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const unreadCount = unreadNotifications.length;

  const value = {
    notifications, unreadNotifications, unreadCount, markAsRead, markAllAsRead, refresh,
    reminders, feedError, refreshReminders, refreshRemindersIfStale,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
