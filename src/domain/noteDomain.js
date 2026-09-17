/**
 * Domain logic for the personal Notes workspace (replaces the old Activities module).
 * Notes are lightweight personal working notes for the logged-in HR user — not tasks,
 * not employee records, not onboarding/offboarding data. No due date, priority, assignee,
 * or status/progress concept belongs here.
 */

// Centralized PoC master-data category list — a backend could later replace this array
// without any UI rewrite (notesService/noteDomain remain the single source HR/UI reads from).
export const NOTE_CATEGORIES = ['General', 'Recruitment', 'Onboarding', 'Offboarding', 'Employee', 'Intern', 'Meeting'];

// Sentinel value for the "Other / Custom" option in the Category selector only — never stored
// on a note record. The note's actual category is always the real string the user typed.
export const CUSTOM_CATEGORY_OPTION = 'Other';

// Single source of truth for note color accents — reused by NoteCard's top-border accent, the
// Color Accent dropdown's swatches (Select.jsx renders `swatchColor` when present), and the
// Document View inline editor. The hex values here MUST stay in sync with the
// .note-card--accent-* rules in index.css (those can't import this file, so keep both in sync
// if either changes — see the comment beside them there).
export const NOTE_ACCENTS = {
  default: { label: 'Default', swatchColor: 'none' },
  teal: { label: 'Teal', swatchColor: '#129FA9' },
  blue: { label: 'Blue', swatchColor: '#2563EB' },
  green: { label: 'Green', swatchColor: '#059669' },
  amber: { label: 'Amber', swatchColor: '#D97706' },
  purple: { label: 'Purple', swatchColor: '#7C3AED' },
};

export const NOTE_COLOR_ACCENTS = Object.keys(NOTE_ACCENTS);

// Small fixed palette for the Highlight toolbar control — intentionally NOT arbitrary color
// picking. Soft pastel backgrounds only, readable with the app's dark text. This is the single
// source of truth for both the toolbar's swatch dots (NoteContentEditor) AND the sanitizer's
// data-highlight whitelist below — the two can never drift out of sync. The hex values here are
// cosmetic only; index.css's `mark[data-highlight="..."]` rules are what actually paints the
// highlight in editors/previews/documents and must stay visually consistent with these if either
// changes (mirroring the existing NOTE_ACCENTS/.note-card--accent-* sync-by-comment convention).
export const NOTE_HIGHLIGHT_COLORS = {
  yellow: { label: 'Yellow', swatchColor: '#FEF9C3' },
  green: { label: 'Green', swatchColor: '#DCFCE7' },
  blue: { label: 'Blue', swatchColor: '#DBEAFE' },
  pink: { label: 'Pink', swatchColor: '#FCE7F3' },
};

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
 * Resolves the full set of category options for the "All Categories" filter and the Category
 * selector: every built-in category, PLUS every distinct custom category currently present on
 * a note, de-duplicated case-insensitively against the built-ins and against each other. Pure
 * function — the service layer supplies the current notes; this never touches storage itself.
 */
export function getAllCategoryOptions(allNotes = []) {
  const seenLower = new Set(NOTE_CATEGORIES.map((c) => c.toLowerCase()));
  const customCategories = [];

  allNotes.forEach((note) => {
    const cat = (note.category || '').trim();
    if (!cat) return;
    const lower = cat.toLowerCase();
    if (seenLower.has(lower)) return;
    seenLower.add(lower);
    customCategories.push(cat);
  });

  return [...NOTE_CATEGORIES, ...customCategories.sort((a, b) => a.localeCompare(b))];
}

/**
 * Resolves the actual category string to store on a note, given the Category selector's value
 * and (when "Other" was selected) the free-text custom-category field. Never stores the literal
 * sentinel "Other" — always the real, trimmed category name the user entered.
 */
export function resolveNoteCategory(selectedCategory, customCategoryInput = '') {
  if (selectedCategory !== CUSTOM_CATEGORY_OPTION) {
    return selectedCategory || NOTE_CATEGORIES[0];
  }
  const trimmed = (customCategoryInput || '').trim();
  return trimmed;
}

// --------------------------------------------------------------------------
// Lightweight, dependency-free HTML safety for note formatting (Bold/Italic/Underline only).
// No rich-text library is installed — these are small whitelist-based helpers, safe to run in
// both the browser (contentEditable output) and Node (Stage 18 functional tests), since they
// operate on plain strings/regex rather than requiring a real DOM.
// --------------------------------------------------------------------------

const ALLOWED_FORMATTING_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'UL', 'OL', 'LI', 'MARK']);

// The ONLY attribute permitted to survive sanitization, and ONLY on <mark>, and ONLY with one of
// these exact values — derived from NOTE_HIGHLIGHT_COLORS so the toolbar palette and the
// sanitizer whitelist can never drift apart. Every other attribute on every tag (including any
// other attribute on <mark> itself, e.g. style/class/onclick) is still stripped unconditionally.
const ALLOWED_HIGHLIGHT_VALUES = new Set(Object.keys(NOTE_HIGHLIGHT_COLORS));

/**
 * Whitelist-sanitizes note formatting HTML: strips every tag except the small
 * B/I/U/line-break/list/highlight allowlist, and strips ALL attributes on every tag EXCEPT the
 * one narrow exception below (<mark data-highlight="yellow|green|blue|pink">) — this also
 * removes event handlers, style, class, href, src, etc. outright everywhere else. Dangerous
 * elements (script/style/iframe/object/embed/link/meta) are removed tag AND content; every other
 * disallowed tag (img, a, span, table, ...) is unwrapped, keeping only its inner text. Never
 * render contentHtml via dangerouslySetInnerHTML without passing it through this.
 */
export function sanitizeNoteHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = rawHtml;

  // Remove dangerous elements entirely, including their content
  html = html.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');

  // Strip HTML comments (can hide conditional/legacy script vectors in old IE-style markup)
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Whitelist every remaining tag; strip all attributes unconditionally (except the single
  // <mark data-highlight="..."> exception below), drop disallowed tags (keeping their inner
  // text, which the subsequent regex pass over will still visit safely).
  html = html.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, closingSlash, tagName, attrs) => {
    const upper = tagName.toUpperCase();
    if (!ALLOWED_FORMATTING_TAGS.has(upper)) return '';
    const isClosing = closingSlash === '/';
    if (upper === 'BR') return '<br>';

    if (upper === 'MARK' && !isClosing) {
      // Extract ONLY data-highlight, validate its value against the fixed palette, and rebuild
      // the tag from scratch using the validated value — every other attribute (style, class,
      // onclick, a malicious data-highlight like "javascript:...", ...) is discarded by
      // construction since we never copy `attrs` through verbatim. An unrecognized/missing value
      // normalizes to a bare, unstyled <mark> (index.css treats an attribute-less <mark> as
      // transparent) rather than surviving with an unsafe or made-up highlight color.
      const attrMatch = attrs.match(/data-highlight\s*=\s*"([^"]*)"|data-highlight\s*=\s*'([^']*)'/i);
      const rawValue = attrMatch ? (attrMatch[1] !== undefined ? attrMatch[1] : attrMatch[2]) : '';
      const normalizedValue = (rawValue || '').trim().toLowerCase();
      return ALLOWED_HIGHLIGHT_VALUES.has(normalizedValue) ? `<mark data-highlight="${normalizedValue}">` : '<mark>';
    }

    return isClosing ? `</${upper.toLowerCase()}>` : `<${upper.toLowerCase()}>`;
  });

  // Defense in depth against any leftover javascript: URL text fragments
  html = html.replace(/javascript:/gi, '');

  return html;
}

/**
 * Escapes plain text and converts newlines to <br> — used to safely seed a contentEditable
 * surface (or render read-only) from a LEGACY note that only has plain-text `content` and no
 * `contentHtml` yet. The result never needs sanitizing (it is built entirely from escaped text),
 * but is still safe to pass through sanitizeNoteHtml() again if a caller wants one code path.
 */
export function plainTextToSafeHtml(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\n/g, '<br>');
}

/**
 * Derives the normalized plain-text representation from sanitized formatting HTML — this is
 * what gets stored as `content` (search/fallback/compatibility) whenever a note is saved with
 * formatting. Line breaks (<br>, closing <div>) become '\n'; list items (<li>) each become their
 * own line too, so bulleted/numbered content remains fully readable and searchable as plain
 * text — no HTML tags and no fake "•"/"1." bullet characters are ever written into `content`.
 * All other tags (including <mark>, which contributes no separator of its own — a highlighted
 * word behaves exactly like plain text here) are stripped.
 */
export function deriveContentFromHtml(sanitizedHtml) {
  if (!sanitizedHtml) return '';
  let text = sanitizedHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Resolves the safe HTML a card/document surface should render for a note: the sanitized
 * contentHtml when present (re-sanitized defensively even though it was already sanitized at
 * save time), or the escaped/line-break-converted plain content for legacy notes that predate
 * the contentHtml field. Single helper — Card View and Document View both call this, so there
 * is exactly one "how do we safely render a note" code path.
 */
export function resolveNoteContentHtml(note) {
  if (!note) return '';
  if (note.contentHtml) return sanitizeNoteHtml(note.contentHtml);
  return plainTextToSafeHtml(note.content || '');
}

/**
 * Filters notes by search text (title/content/tags), category, and — additively, for the Former
 * Historical Record page's "HR Notes" section (the first caller to ever need it) — the optional
 * relatedEmployeeId link. Every other existing caller (My Notes/Pinned/Archived) never passes
 * relatedEmployeeId, so this clause is a no-op for them.
 */
export function filterNotes(notes = [], { search = '', category = '', relatedEmployeeId = '' } = {}) {
  const query = search.trim().toLowerCase();

  return notes.filter((note) => {
    if (relatedEmployeeId && note.relatedEmployeeId !== relatedEmployeeId) return false;
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

// --------------------------------------------------------------------------
// Optional per-note Reminders — a note may have AT MOST one reminder, entirely independent of
// Pin/Archive/content. `reminderAt` is a full ISO 8601 UTC timestamp (built from the user's
// local date+time picker input, same machine-readable convention as createdAt/updatedAt) or
// null when no reminder is set. `reminderNotificationGeneratedFor` tracks which exact
// `reminderAt` value has already produced its one in-app notification, so checking for due
// reminders on every app load/interval never creates duplicates — and simply setting a NEW
// reminderAt value (different from whatever was last generated-for) makes that note eligible
// for exactly one new notification again.
// --------------------------------------------------------------------------

/**
 * Combines a 'YYYY-MM-DD' date input and 'HH:MM' time input (both in the user's local
 * browser time, straight from <input type="date">/<input type="time">) into a full ISO 8601
 * UTC timestamp for storage. Returns null for incomplete/invalid input.
 */
export function combineReminderDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const local = new Date(`${dateStr}T${timeStr}:00`);
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}

/**
 * Inverse of combineReminderDateTime() — splits a stored ISO timestamp back into the local
 * 'YYYY-MM-DD' / 'HH:MM' strings <input type="date">/<input type="time"> expect, so the
 * reminder modal can prefill its fields when editing an existing reminder. Returns empty
 * strings for a missing/invalid input (a brand-new reminder starts with blank fields).
 */
export function splitReminderDateTime(reminderAtIso) {
  if (!reminderAtIso) return { dateStr: '', timeStr: '' };
  const d = new Date(reminderAtIso);
  if (isNaN(d.getTime())) return { dateStr: '', timeStr: '' };
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { dateStr, timeStr };
}

/**
 * Validates a candidate reminder timestamp: required, and must not be in the past relative to
 * `referenceIso` (defaults to now) — a reminder can never be newly scheduled for a time that
 * has already passed. Does not mutate/round the reminder value itself; the user's exact chosen
 * minute is always kept.
 *
 * Compares at MINUTE granularity, not to-the-second: the Date/Time picker only lets the user
 * choose a minute (<input type="time"> has no seconds), so the stored reminderAt always has
 * :00 seconds. Comparing that directly against a to-the-second "now" would falsely reject a
 * perfectly valid "this current minute" (or the very next minute, picked while only a few
 * seconds remain in the current one) reminder purely because a few seconds ticked by between
 * picking the time and clicking Save — an unpredictable, confusing failure for no real reason.
 * Rounding the reference down to the start of ITS current minute before comparing fixes this:
 * only a reminder in a genuinely earlier minute is ever rejected.
 */
export function validateReminder(reminderAtIso, referenceIso = new Date().toISOString()) {
  if (!reminderAtIso) {
    return { isValid: false, error: 'Pick a date and time for the reminder.' };
  }
  const target = new Date(reminderAtIso);
  if (isNaN(target.getTime())) {
    return { isValid: false, error: 'Pick a valid date and time.' };
  }
  const reference = new Date(referenceIso);
  const referenceMinuteStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate(), reference.getHours(), reference.getMinutes(), 0, 0);
  if (target.getTime() < referenceMinuteStart.getTime()) {
    return { isValid: false, error: 'Reminder time has already passed — choose a future date and time.' };
  }
  return { isValid: true, error: null };
}

/**
 * Formats a reminder's ISO timestamp into a short human-readable label in the viewer's local
 * time, e.g. "Sep 15, 2026 · 10:00 AM" — the one place this format is produced, reused by the
 * note card badge, Document View, the reminder modal, and the notification panel.
 */
export function formatReminderLabel(reminderAtIso) {
  if (!reminderAtIso) return '';
  const d = new Date(reminderAtIso);
  if (isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

/**
 * Derives whether a note's Reminder Bell should show the active teal "needs attention" state.
 * ONE shared rule — Card View and Document View both call this instead of separately
 * reimplementing the logic, so they can never disagree. `notifications` should be the FULL
 * notification list (read and unread both), not a pre-filtered unread-only list, since telling
 * "due + read" apart from "due + unread" requires seeing the read one too.
 *
 * - No reminderAt at all -> neutral (nothing scheduled).
 * - reminderAt is still in the future -> active (a future reminder).
 * - reminderAt has passed -> look up the notification generated for this exact occurrence
 *   (matched by noteId + dueAt) and return active only while it is unread.
 *
 * Deliberately compares `reminderAt` against `now` directly here rather than trusting the
 * note's own `reminderNotificationGeneratedFor` field to decide "is this due yet": that field
 * lives on the `note` object, which callers (NoteCard/NotesDocumentView) receive from
 * NotesPage's `notes` list — and `notificationService.checkDueReminders()` updates
 * `reminderNotificationGeneratedFor` directly in storage on its own 30s interval, independent
 * of any explicit note action that would make NotesPage reload `notes`. That left this field
 * stale in the UI's copy of the note for arbitrarily long after a reminder actually fired
 * (until the next unrelated Pin/Archive/edit refreshed `notes`), which made a just-read
 * reminder's Bell appear stuck teal. `reminderAt` itself never has this problem — it only ever
 * changes via setReminder()/removeReminder(), both of which already refresh `notes` — so
 * computing "due" from it fresh on every render is always correct regardless of any staleness
 * elsewhere on the note object. `notifications`, read live from NotificationContext, is what's
 * actually queried for the fresh isRead state.
 */
export function getReminderAttentionState(note, notifications = [], nowIso = new Date().toISOString()) {
  if (!note || !note.reminderAt) return false;
  if (note.reminderAt > nowIso) return true;
  const notification = notifications.find((n) => n.noteId === note.id && n.dueAt === note.reminderAt);
  return notification ? !notification.isRead : true;
}
