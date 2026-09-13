import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';

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

  async markAsRead(id) {
    const db = loadDatabase();
    const notifications = db.notifications || [];
    const index = notifications.findIndex((n) => n.id === id);
    if (index === -1) return null;

    notifications[index] = { ...notifications[index], isRead: true };
    db.notifications = notifications;
    saveDatabase(db);
    return notifications[index];
  },

  async markAllAsRead() {
    const db = loadDatabase();
    db.notifications = (db.notifications || []).map((n) => (n.isRead ? n : { ...n, isRead: true }));
    saveDatabase(db);
    return db.notifications;
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
};
