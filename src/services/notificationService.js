import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { isBellWorthy, reminderSource } from './reminderService.js';
import { apiClient } from './apiClient.js';

// Read/unread belongs to the signed-in HR ACCOUNT, not this browser: the server keeps which
// notification keys each account has read (GET/PUT /notification-reads —
// server/db/notificationReads.js), so a notification read on one device stays read for that
// account everywhere, and stays independent of other accounts. The list of notifications itself
// is still built in this browser (note reminders + the ERP reminders feed); `isRead` on each
// stored record is just the last-applied view for whoever is signed in here.
//
// A read made while the server can't be reached (or before its table exists) is kept in
// `pendingReadBy` (account keys) on the record and sent on the next successful sync — so it's
// never lost, and never shown as read for a different account using the same browser.
let serverReads = { account: null, available: false, keys: new Set() };

/** The stable key read state is stored under (also used by the server for ERP reminders). */
export function notificationKey(n) {
  return n.type === 'erp_reminder' ? n.key : `note:${n.noteId}:${n.dueAt}`;
}

function isReadFor(n, account) {
  if (n.pendingReadBy?.includes(account)) return true;
  return serverReads.account === account && serverReads.keys.has(notificationKey(n));
}

/**
 * Data-access boundary for the IN-APP notification center. Currently the only notification
 * `type` produced is 'note_reminder' (from an optional per-note Reminder — see notesService's
 * setReminder/removeReminder and noteDomain's validateReminder/formatReminderLabel), but this
 * stays a small, generic record shape on purpose so a later real backend/scheduler could persist
 * and push additional notification types through the exact same shape without any Notes UI
 * rewrite — see checkDueReminders() below for the one place "note reminder -> notification" is
 * decided. This is a frontend PoC: there is no server push, so due reminders are only detected
 * while the app is open (on load, on a lightweight interval, and after reminder data changes) —
 * never while the browser/app is fully closed, and never via browser push notifications.
 */
export const notificationService = {
  /**
   * All notifications, most recent first. No fake/demo notifications are ever seeded — this
   * only ever returns what checkDueReminders() has actually generated from real reminder data.
   */
  async getAll() {
    const db = loadDatabase();
    return [...(db.notifications || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  /** Marks one notification read for `account` (the signed-in HR account). */
  async markAsRead(id, account) {
    const db = loadDatabase();
    const target = (db.notifications || []).find((n) => n.id === id);
    if (!target) return null;
    await this.markKeysRead([target], account);
    return target;
  },

  /** Marks every notification unread for `account` as read. */
  async markAllAsRead(account) {
    const db = loadDatabase();
    const unread = (db.notifications || []).filter((n) => !isReadFor(n, account));
    if (unread.length > 0) await this.markKeysRead(unread, account);
    return loadDatabase().notifications;
  },

  // Shows them read straight away (pending), then records it on the server for the account.
  async markKeysRead(targets, account) {
    const ids = new Set(targets.map((n) => n.id));
    const db = loadDatabase();
    db.notifications = (db.notifications || []).map((n) => (ids.has(n.id)
      ? { ...n, isRead: true, pendingReadBy: [...new Set([...(n.pendingReadBy || []), account])] }
      : n));
    saveDatabase(db);
    await this.pushPendingReads(account);
  },

  // Sends this account's pending reads to the server; on success they're no longer pending.
  async pushPendingReads(account) {
    if (!account) return;
    const db = loadDatabase();
    const pending = (db.notifications || []).filter((n) => n.pendingReadBy?.includes(account));
    if (pending.length === 0) return;
    const keys = pending.map(notificationKey);
    try {
      await apiClient.put('/notification-reads', { keys }, { quiet: true });
    } catch (err) {
      console.error('Notifications: read state not saved to the account yet — will retry.', err);
      return;
    }
    if (serverReads.account === account) keys.forEach((k) => serverReads.keys.add(k));
    const after = loadDatabase();
    const sent = new Set(pending.map((n) => n.id));
    after.notifications = (after.notifications || []).map((n) => (sent.has(n.id)
      ? { ...n, pendingReadBy: (n.pendingReadBy || []).filter((a) => a !== account) }
      : n));
    saveDatabase(after);
  },

  /**
   * Re-reads this account's read notifications from the server (sending any pending reads first)
   * and applies them. A failed read keeps the last known state.
   */
  async syncReadState(account) {
    if (!account) return;
    await this.pushPendingReads(account);
    try {
      const { keys, available } = await apiClient.get('/notification-reads', { fresh: true });
      serverReads = { account, available: Boolean(available), keys: new Set(keys || []) };
    } catch (err) {
      console.error('Notifications: could not read this account\'s read state.', err);
    }
    this.applyReadState(account);
  },

  /** Sets each notification's `isRead` for the signed-in account (no network). */
  applyReadState(account) {
    if (!account) return;
    const db = loadDatabase();
    let changed = false;
    db.notifications = (db.notifications || []).map((n) => {
      const isRead = isReadFor(n, account);
      if (n.isRead === isRead) return n;
      changed = true;
      return { ...n, isRead };
    });
    if (changed) saveDatabase(db);
  },

  /**
   * Removes every notification associated with a note — called by
   * notesService.deletePermanently() so a deleted note's already-generated notifications can
   * never be clicked into a note that no longer exists.
   */
  async deleteForNote(noteId) {
    const db = loadDatabase();
    const before = (db.notifications || []).length;
    db.notifications = (db.notifications || []).filter((n) => n.noteId !== noteId);
    if (db.notifications.length !== before) {
      saveDatabase(db);
    }
    return true;
  },

  /**
   * Scans notes for a due, not-yet-notified reminder and generates exactly ONE notification per
   * reminder occurrence. A "occurrence" is identified by the note's exact `reminderAt` value:
   * once a notification has been generated for that value (tracked via
   * `reminderNotificationGeneratedFor`), the same value will never generate a second
   * notification — calling this repeatedly (app load, polling interval, route change) is always
   * safe and produces no duplicates. If the user later sets a NEW future reminderAt on the same
   * note, that new value no longer matches the stored generated-for marker, so it becomes
   * eligible for exactly one new notification at its own due time.
   */
  async checkDueReminders() {
    const db = loadDatabase();
    const notes = db.notes || [];
    const nowIso = new Date().toISOString();
    const notifications = [...(db.notifications || [])];
    let notesChanged = false;

    const updatedNotes = notes.map((note) => {
      if (!note.reminderAt) return note;
      if (note.reminderAt > nowIso) return note; // not due yet
      if (note.reminderNotificationGeneratedFor === note.reminderAt) return note; // already notified for this exact occurrence

      notifications.push({
        id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'note_reminder',
        noteId: note.id,
        title: note.title,
        message: 'Your reminder is due.',
        dueAt: note.reminderAt,
        createdAt: nowIso,
        isRead: false,
      });
      notesChanged = true;
      return { ...note, reminderNotificationGeneratedFor: note.reminderAt };
    });

    if (notesChanged) {
      db.notes = updatedNotes;
      db.notifications = notifications;
      saveDatabase(db);
    }
  },

  /**
   * Brings the bell's ERP notifications (type 'erp_reminder') in line with the reminders feed
   * (reminderService — tasks due today/overdue, start and end dates, candidate replies). Each feed
   * item has a stable `key`, so this is safe to call as often as the feed is read:
   *  - a key seen for the first time becomes ONE unread notification;
   *  - a key already notified keeps its read/unread state, only its wording/link is updated
   *    (e.g. a renamed person) — never a second notification;
   *  - a key no longer in the feed has been resolved (task ticked, person moved on, reply opened)
   *    and its notification is removed — but only when that part of the feed loaded, so a failed
   *    read never clears anything.
   * A task that was "due today" and becomes overdue the next day is a new key, so it notifies
   * once more. Note reminders are untouched.
   */
  async syncErpReminders(feed) {
    if (!feed?.items) return;
    const db = loadDatabase();
    const notifications = db.notifications || [];
    const wanted = new Map(feed.items.filter(isBellWorthy).map((item) => [item.key, item]));
    const nowIso = new Date().toISOString();
    let changed = false;

    const next = [];
    const seen = new Set();
    for (const n of notifications) {
      if (n.type !== 'erp_reminder') {
        next.push(n);
        continue;
      }
      const item = wanted.get(n.key);
      if (!item) {
        // Resolved — unless that source failed to load this time, then keep it as it was.
        if (feed.sources?.[reminderSource(n.kind)] !== 'ok') next.push(n);
        else changed = true;
        continue;
      }
      seen.add(n.key);
      const updated = { ...n, title: item.title, message: item.message, dueAt: item.date, link: item.link, status: item.status ?? null };
      if (updated.title !== n.title || updated.message !== n.message || updated.dueAt !== n.dueAt || updated.link !== n.link) changed = true;
      next.push(updated);
    }
    for (const [key, item] of wanted) {
      if (seen.has(key)) continue;
      next.push({
        id: `erp-${key}`,
        type: 'erp_reminder',
        key,
        kind: item.kind,
        state: item.state ?? null,
        module: item.module,
        status: item.status ?? null,
        title: item.title,
        message: item.message,
        dueAt: item.date,
        link: item.link,
        createdAt: nowIso,
        isRead: false, // applyReadState() sets it for the signed-in account
      });
      changed = true;
    }

    if (changed) {
      db.notifications = next;
      saveDatabase(db);
    }
  },
};
