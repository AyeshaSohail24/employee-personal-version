import { formatDateDisplay } from '../utils/dateUtils.js';

/**
 * The email-draft placeholder catalog: the three built-in {{Tokens}}, plus every VALUE SOURCE a
 * user-created placeholder (email_placeholders, via GET /email-placeholders) can point at. A
 * user-created placeholder always names exactly one of these sources, so it can never appear in
 * the editor without a way to get a real value for a candidate.
 *
 * Every source reads a field the candidate record (GET /candidates —
 * server/db/upcomingCandidates.js) already carries, the current date, or text HR typed in. The
 * server keeps the list of source keys in step (PLACEHOLDER_SOURCE_KEYS in
 * server/db/emailPlaceholders.js), and built-in names in BUILT_IN_PLACEHOLDER_TOKENS there.
 */

// Values for these come from buildCandidateEmailTokens() (candidateDomain.js).
export const BUILT_IN_PLACEHOLDERS = [
  { token: 'ApplicantName', label: 'Applicant Name', description: "The candidate's full name." },
  { token: 'PositionName', label: 'Position Name', description: 'The position the candidate applied for.' },
  { token: 'HiringEmployeeName', label: 'Hiring Employee Name', description: 'The name typed in "Hiring Employee Name" when the email is sent.' },
];

export const FIXED_TEXT_SOURCE = 'fixedText';

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateOrNull(value) {
  return value ? formatDateDisplay(String(value)) : null;
}

/**
 * `resolve(candidate, placeholder)` returns the value, or null/'' when this candidate has none —
 * which the renderer treats as unresolved, so the email can't be sent with a gap in it.
 * `mayBeMissing` is shown to HR when they pick the source.
 */
export const PLACEHOLDER_SOURCES = [
  {
    key: 'applicantFirstName',
    label: "Applicant's first name",
    description: "The candidate's first name from their application.",
    example: 'Aida',
    mayBeMissing: false,
    resolve: (c) => c?.firstName,
  },
  {
    key: 'applicantLastName',
    label: "Applicant's last name",
    description: "The candidate's last name from their application.",
    example: 'Quraishi',
    mayBeMissing: true,
    resolve: (c) => c?.lastName,
  },
  {
    key: 'applicantEmail',
    label: "Applicant's email address",
    description: 'The email address the candidate applied with.',
    example: 'aida@example.com',
    mayBeMissing: false,
    resolve: (c) => c?.email,
  },
  {
    key: 'applicantPhone',
    label: "Applicant's phone number",
    description: 'The phone number from the application, if the candidate gave one.',
    example: '+60 12-345 6789',
    mayBeMissing: true,
    resolve: (c) => c?.phone,
  },
  {
    key: 'departmentName',
    label: 'Department',
    description: 'The department of the job the candidate applied for.',
    example: 'Marketing',
    mayBeMissing: true,
    resolve: (c) => c?.department?.name,
  },
  {
    key: 'offerType',
    label: 'Offer type (Paid / Unpaid)',
    description: "The candidate's offer type as set on the Upcoming page.",
    example: 'Paid',
    mayBeMissing: false,
    resolve: (c) => c?.offerType,
  },
  {
    key: 'proposedStartDate',
    label: "Applicant's proposed start date",
    description: 'The start date the candidate gave on their application (not a confirmed internship date).',
    example: 'Jul 27, 2026',
    mayBeMissing: true,
    resolve: (c) => dateOrNull(c?.proposedStartDate),
  },
  {
    key: 'todayDate',
    label: "Today's date",
    description: 'The date the email is prepared.',
    example: formatDateDisplay(localToday()),
    mayBeMissing: false,
    resolve: () => formatDateDisplay(localToday()),
  },
  {
    key: FIXED_TEXT_SOURCE,
    label: 'Fixed text (same for every candidate)',
    description: 'Text you type below, inserted exactly as written — e.g. an allowance amount or office address.',
    example: 'RM600',
    mayBeMissing: false,
    resolve: (c, placeholder) => placeholder?.fixedValue,
  },
];

export function getPlaceholderSource(key) {
  return PLACEHOLDER_SOURCES.find((s) => s.key === key) || null;
}

/** The value a user-created placeholder resolves to for one candidate, or null if none. */
export function resolvePlaceholderValue(placeholder, candidate) {
  const source = getPlaceholderSource(placeholder?.source);
  if (!source) return null;
  const value = source.resolve(candidate, placeholder);
  return value === undefined || value === null || String(value).trim() === '' ? null : String(value);
}

/** "Start Date" -> "StartDate", "office address 2" -> "OfficeAddress2". */
export function suggestTokenFromLabel(label = '') {
  const token = label
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/^[0-9]+/, '');
  return token.slice(0, 40);
}

export const PLACEHOLDER_TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

/** Every {{Token}} name used in the given texts (same match rule as renderEmailTemplate()). */
export function extractPlaceholderTokens(...texts) {
  const tokens = new Set();
  for (const text of texts) {
    for (const match of String(text ?? '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)) tokens.add(match[1]);
  }
  return [...tokens];
}
