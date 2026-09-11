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

const ALLOWED_FORMATTING_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV']);

/**
 * Whitelist-sanitizes note formatting HTML: strips every tag except the small B/I/U/line-break
 * allowlist, and strips ALL attributes even on allowed tags (bold/italic/underline/line-breaks
 * never need one, so this also removes event handlers, style, class, href, src, etc. outright).
 * Dangerous elements (script/style/iframe/object/embed/link/meta) are removed tag AND content;
 * every other disallowed tag (img, a, span, table, ...) is unwrapped, keeping only its inner
 * text. Never render contentHtml via dangerouslySetInnerHTML without passing it through this.
 */
export function sanitizeNoteHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let html = rawHtml;

  // Remove dangerous elements entirely, including their content
  html = html.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '');

  // Strip HTML comments (can hide conditional/legacy script vectors in old IE-style markup)
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // Whitelist every remaining tag; strip all attributes unconditionally, drop disallowed tags
  // (keeping their inner text, which the subsequent regex pass over will still visit safely).
  html = html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
    const upper = tagName.toUpperCase();
    if (!ALLOWED_FORMATTING_TAGS.has(upper)) return '';
    const isClosing = match.startsWith('</');
    if (upper === 'BR') return '<br>';
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
 * formatting. Line breaks (<br>, closing <div>) become '\n'; all other tags are stripped.
 */
export function deriveContentFromHtml(sanitizedHtml) {
  if (!sanitizedHtml) return '';
  let text = sanitizedHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
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
