import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import {
  filterNotes,
  sortNotes,
  validateNote,
  normalizeTags,
  getAllCategoryOptions,
  sanitizeNoteHtml,
  deriveContentFromHtml,
  plainTextToSafeHtml,
  validateReminder,
  NOTE_SORT_OPTIONS,
} from '../domain/noteDomain.js';
import { notificationService } from './notificationService.js';

const CURRENT_USER_ID = 'emp-001';

/**
 * Centralizes formatting-HTML safety at the storage boundary: whenever a caller supplies
 * `contentHtml` (from the shared NoteContentEditor, in either Card View's modal or Document
 * View's inline editor), it is sanitized here and the plain-text `content` is re-derived from
 * that sanitized HTML — so `content` (used by search) and `contentHtml` (used for formatted
 * rendering) can never drift apart, and storage never trusts unsanitized HTML even if a caller
 * forgot to sanitize first. Callers that only supply plain `content` (no formatting) still work
 * exactly as before — contentHtml is simply derived from the escaped plain text.
 */
function resolveContentFields(payload) {
  if (payload.contentHtml !== undefined) {
    const sanitizedHtml = sanitizeNoteHtml(payload.contentHtml);
    return { content: deriveContentFromHtml(sanitizedHtml), contentHtml: sanitizedHtml };
  }
  const plain = (payload.content || '').trim();
  return { content: plain, contentHtml: plain ? plainTextToSafeHtml(plain) : '' };
}

/**
 * Data-access boundary for the personal Notes workspace. UI pages never touch seedNotes.js or
 * storageEngine.js directly — everything flows through this service, so swapping the mock
 * storage engine for a real backend later only requires changing this file.
 */
export const notesService = {
  /**
   * Fetches notes for a given workspace view, filtered and sorted.
   * @param {Object} options
   * @param {'my'|'pinned'|'archived'} [options.scope='my']
   */
  async getAll(options = {}) {
    const {
      scope = 'my',
      search = '',
      category = '',
      sortBy = NOTE_SORT_OPTIONS.UPDATED,
    } = options;

    const db = loadDatabase();
    const allNotes = (db.notes || []).filter((n) => n.ownerId === CURRENT_USER_ID);

    let scoped;
    if (scope === 'archived') {
      scoped = allNotes.filter((n) => n.isArchived);
    } else if (scope === 'pinned') {
      scoped = allNotes.filter((n) => n.isPinned && !n.isArchived);
    } else {
      scoped = allNotes.filter((n) => !n.isArchived);
    }

    const filtered = filterNotes(scoped, { search, category });
    return sortNotes(filtered, sortBy);
  },

  async getById(id) {
    if (!id) return null;
    const db = loadDatabase();
    return (db.notes || []).find((n) => n.id === id) || null;
  },

  /**
   * Resolves every category option (built-in + de-duplicated custom categories currently used
   * by this user's notes) — the single source both the Category selector and the "All
   * Categories" filter read from, so a custom category typed once immediately appears in both.
   */
  async getCategoryOptions() {
    const db = loadDatabase();
    const allNotes = (db.notes || []).filter((n) => n.ownerId === CURRENT_USER_ID);
    return getAllCategoryOptions(allNotes);
  },

  async create(noteData = {}) {
    const contentFields = resolveContentFields(noteData);
    const payload = { ...noteData, ...contentFields, tags: normalizeTags(noteData.tags) };
    const { isValid, errors } = validateNote(payload);
    if (!isValid) {
      throw new Error(Object.values(errors).join(', '));
    }

    const db = loadDatabase();
    const notes = db.notes || [];
    const nowIso = new Date().toISOString();

    const newNote = {
      id: `note-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: payload.title.trim(),
      content: payload.content,
      contentHtml: payload.contentHtml,
      category: payload.category || 'General',
      tags: payload.tags,
      isPinned: false,
      isArchived: false,
      colorAccent: payload.colorAccent || 'default',
      ownerId: CURRENT_USER_ID,
      createdAt: nowIso,
      updatedAt: nowIso,
      // Reminders are entirely optional and off by default — a new note never has one unless
      // the user explicitly sets it afterward via setReminder().
      reminderAt: null,
      reminderNotificationGeneratedFor: null,
    };

    db.notes = [newNote, ...notes];
    saveDatabase(db);
    return newNote;
  },

  async update(id, updateData = {}) {
    let payload = updateData.tags !== undefined ? { ...updateData, tags: normalizeTags(updateData.tags) } : updateData;
    if (updateData.content !== undefined || updateData.contentHtml !== undefined) {
      payload = { ...payload, ...resolveContentFields(payload) };
    }

    const db = loadDatabase();
    const notes = db.notes || [];
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    const merged = { ...notes[index], ...payload };
    const { isValid, errors } = validateNote(merged);
    if (!isValid) {
      throw new Error(Object.values(errors).join(', '));
    }

    const updatedNote = {
      ...merged,
      title: merged.title.trim(),
      content: merged.content.trim(),
      updatedAt: new Date().toISOString(),
    };

    notes[index] = updatedNote;
    db.notes = notes;
    saveDatabase(db);
    return updatedNote;
  },

  async togglePin(id) {
    const db = loadDatabase();
    const notes = db.notes || [];
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    notes[index] = { ...notes[index], isPinned: !notes[index].isPinned, updatedAt: new Date().toISOString() };
    db.notes = notes;
    saveDatabase(db);
    return notes[index];
  },

  async archive(id) {
    const db = loadDatabase();
    const notes = db.notes || [];
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    notes[index] = { ...notes[index], isArchived: true, updatedAt: new Date().toISOString() };
    db.notes = notes;
    saveDatabase(db);
    return notes[index];
  },

  async restore(id) {
    const db = loadDatabase();
    const notes = db.notes || [];
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    notes[index] = { ...notes[index], isArchived: false, updatedAt: new Date().toISOString() };
    db.notes = notes;
    saveDatabase(db);
    return notes[index];
  },

  /**
   * Permanently deletes a note. The UI must confirm via a modal before calling this —
   * this function performs the deletion unconditionally once called.
   */
  async deletePermanently(id) {
    const db = loadDatabase();
    const notes = db.notes || [];
    const filtered = notes.filter((n) => n.id !== id);
    if (filtered.length === notes.length) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    db.notes = filtered;
    saveDatabase(db);
    // The note (and any reminder it had) is gone, so it can never trigger a future reminder —
    // also clean up any already-generated in-app notifications that pointed at it, so clicking
    // one can never crash trying to look up a note that no longer exists.
    await notificationService.deleteForNote(id);
    return true;
  },

  /**
   * Sets or changes a note's reminder. `reminderAtIso` must be a validated future ISO
   * timestamp (see noteDomain.validateReminder) — Card View and Document View share this one
   * method via the shared ReminderModal, so there is exactly one reminder-writing code path.
   * Explicitly resets reminderNotificationGeneratedFor to null: even though
   * notificationService's own due-check already treats any DIFFERENT reminderAt as a fresh,
   * not-yet-notified occurrence, clearing it here keeps the two fields from ever looking
   * inconsistent to a future reader.
   */
  async setReminder(id, reminderAtIso) {
    const { isValid, error } = validateReminder(reminderAtIso);
    if (!isValid) {
      throw new Error(error);
    }

    const db = loadDatabase();
    const notes = db.notes || [];
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    notes[index] = { ...notes[index], reminderAt: reminderAtIso, reminderNotificationGeneratedFor: null, updatedAt: new Date().toISOString() };
    db.notes = notes;
    saveDatabase(db);
    return notes[index];
  },

  /**
   * Removes ONLY a note's reminder — title/content/category/tags/colorAccent/pin/archive state
   * are all left completely untouched.
   */
  async removeReminder(id) {
    const db = loadDatabase();
    const notes = db.notes || [];
    const index = notes.findIndex((n) => n.id === id);
    if (index === -1) {
      throw new Error(`Note with ID "${id}" not found.`);
    }

    notes[index] = { ...notes[index], reminderAt: null, reminderNotificationGeneratedFor: null, updatedAt: new Date().toISOString() };
    db.notes = notes;
    saveDatabase(db);
    return notes[index];
  },
};
