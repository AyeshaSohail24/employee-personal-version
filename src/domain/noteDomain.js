/**
 * Domain logic for the personal Notes workspace (replaces the old Activities module).
 * Notes are lightweight personal working notes for the logged-in HR user — not tasks,
 * not employee records, not onboarding/offboarding data. No due date, priority, assignee,
 * or status/progress concept belongs here.
 */

// Centralized PoC master-data category list — a backend could later replace this array
// without any UI rewrite (notesService/noteDomain remain the single source HR/UI reads from).
export const NOTE_CATEGORIES = ['General', 'Recruitment', 'Onboarding', 'Employee', 'Meeting'];

export const NOTE_COLOR_ACCENTS = ['default', 'teal', 'blue', 'green', 'amber', 'purple'];

export const NOTE_SORT_OPTIONS = {
  UPDATED: 'updated',
  NEWEST: 'newest',
  OLDEST: 'oldest',
  TITLE: 'title',
};

/**
 * Converts a comma-separated tag string into a normalized, de-duplicated array.
 */
export function normalizeTags(tagsInput) {
  if (Array.isArray(tagsInput)) {
    return [...new Set(tagsInput.map((t) => String(t).trim()).filter(Boolean))];
  }
  if (typeof tagsInput !== 'string') return [];
  return [...new Set(tagsInput.split(',').map((t) => t.trim()).filter(Boolean))];
}

/**
 * Validates a note payload before create/update.
 */
export function validateNote(data = {}) {
  const errors = {};
  if (!data.title || !data.title.trim()) {
    errors.title = 'Title is required';
  }
  if (!data.content || !data.content.trim()) {
    errors.content = 'Content is required';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Filters notes by search text (title/content/tags) and category.
 */
export function filterNotes(notes = [], { search = '', category = '' } = {}) {
  const query = search.trim().toLowerCase();

  return notes.filter((note) => {
    if (category && note.category !== category) return false;

    if (query) {
      const titleMatch = (note.title || '').toLowerCase().includes(query);
      const contentMatch = (note.content || '').toLowerCase().includes(query);
      const tagMatch = (note.tags || []).some((tag) => tag.toLowerCase().includes(query));
      if (!titleMatch && !contentMatch && !tagMatch) return false;
    }

    return true;
  });
}

/**
 * Sorts notes. In the default "updated" sort, pinned notes are surfaced first (within an
 * already-non-archived list) — reasonable, not a duplicated record, just an ordering rule.
 */
export function sortNotes(notes = [], sortBy = NOTE_SORT_OPTIONS.UPDATED) {
  const sorted = [...notes];

  sorted.sort((a, b) => {
    if (sortBy === NOTE_SORT_OPTIONS.TITLE) {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortBy === NOTE_SORT_OPTIONS.NEWEST) {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    }
    if (sortBy === NOTE_SORT_OPTIONS.OLDEST) {
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    }
    // Default: Last Updated (descending)
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  if (sortBy === NOTE_SORT_OPTIONS.UPDATED) {
    const pinned = sorted.filter((n) => n.isPinned);
    const rest = sorted.filter((n) => !n.isPinned);
    return [...pinned, ...rest];
  }

  return sorted;
}

/**
 * Formats a note's updatedAt ISO timestamp into a short human-readable label.
 * "Updated just now" / "Updated 10 Sep" — a small dedicated formatter since existing
 * dateUtils.formatDateDisplay() only handles plain YYYY-MM-DD dates, not this granularity.
 */
export function formatNoteUpdatedLabel(updatedAtIso, referenceDate = new Date()) {
  if (!updatedAtIso) return 'Updated recently';

  const updated = new Date(updatedAtIso);
  if (isNaN(updated.getTime())) return 'Updated recently';

  const diffMs = referenceDate.getTime() - updated.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Updated just now';
  if (diffMinutes < 60) return `Updated ${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffMinutes < 24 * 60) {
    const hours = Math.floor(diffMinutes / 60);
    return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const day = updated.getDate();
  const month = updated.toLocaleDateString('en-US', { month: 'short' });
  const time = updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameYear = updated.getFullYear() === referenceDate.getFullYear();
  return sameYear ? `Updated ${day} ${month}, ${time}` : `Updated ${day} ${month} ${updated.getFullYear()}`;
}
