/**
 * Domain logic for the Former Personnel module — a historical/exit-focused VIEW over the same
 * personnel identity Employee records already represent (see employeeService.js), never a
 * separate "formerEmployees" dataset. This file owns only the small pieces of domain logic that
 * genuinely did not exist anywhere else before this module: Exit Type as controlled data (no
 * equivalent field existed anywhere in the app — see the exhaustive search this task's own
 * research confirmed), a human-readable tenure formatter ("1 yr 7 mos"), and the Lifecycle
 * History date-resolution rule (only ever a genuinely available date, never invented/backfilled
 * with today's date).
 */

// Controlled Exit Type categories. A person's actual exit type is stored via formerService
// (a small satellite record keyed by employeeId, never a field invented on the fly by the UI —
// see formerService.getExitInfo/setExitInfo) and is either one of these exact values or null
// (never fabricated). "Other" is a real, storable category here — distinct from Notes' "Other /
// Custom" free-text sentinel, since Exit Type has no free-text variant in this first version.
export const EXIT_TYPES = [
  'Internship Completed',
  'Contract Ended',
  'Resignation',
  'Termination',
  'Other',
];

/**
 * Validates a candidate Exit Type value against the controlled list above. Empty/null is valid
 * (an unrecorded Exit Type is a legitimate "—" state, never coerced to a fabricated default).
 */
export function isValidExitType(value) {
  if (value === null || value === undefined || value === '') return true;
  return EXIT_TYPES.includes(value);
}

// The one controlled Exit Type value that requires a free-text elaboration (customExitType) —
// distinct from Exit Remarks, which is optional additional context on ANY Exit Type, not a
// substitute for naming what "Other" actually was.
export const OTHER_EXIT_TYPE = 'Other';

/** Whether the "Specify Exit Type" field must be shown/required for a given Exit Type selection. */
export function isCustomExitTypeRequired(exitType) {
  return exitType === OTHER_EXIT_TYPE;
}

/**
 * Validates the (exitType, customExitType) pair together: customExitType is only meaningful, and
 * only required, when exitType === 'Other'. A whitespace-only value is treated as empty.
 */
export function isValidCustomExitType(exitType, customExitType) {
  if (!isCustomExitTypeRequired(exitType)) return true;
  return Boolean((customExitType || '').trim());
}

/**
 * Resolves the label HR should actually see for a person's Exit Type — the whole reason
 * customExitType exists: "Other" alone is not informative. Falls back to the literal "Other" for
 * legacy records that predate this field (exitType === 'Other', no customExitType ever recorded)
 * so old data never crashes or looks broken, it's just less specific until HR fills it in via
 * Edit Exit Information. The underlying structured exitType is never overwritten by this — this
 * function only computes a DISPLAY string, callers still filter/store on the real exitType field.
 *
 * @param {{ exitType: string|null, customExitType?: string|null }|null} exitInfo
 * @returns {string|null}
 */
export function resolveExitTypeDisplay(exitInfo) {
  if (!exitInfo || !exitInfo.exitType) return null;
  if (exitInfo.exitType === OTHER_EXIT_TYPE) {
    const custom = (exitInfo.customExitType || '').trim();
    return custom || OTHER_EXIT_TYPE;
  }
  return exitInfo.exitType;
}

/**
 * Formats the whole-months-and-days span between two 'YYYY-MM-DD' dates into a short human
 * tenure string, e.g. "1 yr 7 mos" or "3 mos 17 days" or "17 days" — the exact style requested
 * for the Former directory's TENURE column and the Historical Record page's "Total Tenure" stat.
 * No equivalent formatter existed anywhere in dateUtils.js before this module (confirmed by
 * research) — calculateDurationProgress() there returns a percent/day-count pair for a different
 * purpose (the Personnel directory's progress bar), not this calendar-aware yrs/mos/days style.
 *
 * Never fabricates a missing end date: if either date is absent this returns null, and callers
 * render the existing "—" empty-state convention instead of guessing.
 *
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string} endDate 'YYYY-MM-DD'
 * @returns {string|null}
 */
export function formatTenure(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    // Days in the month immediately before `end`'s month.
    const daysInPrevMonth = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += daysInPrevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} mo${months === 1 ? '' : 's'}`);
  // Days are only shown once tenure is under a year — "1 yr 7 mos" stays clean without a
  // trailing day count, while a short stint like "3 mos 17 days" still needs the precision.
  if (years === 0 && days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);

  if (parts.length === 0) return '0 days';
  return parts.join(' ');
}

/**
 * Builds the Lifecycle History timeline for the Historical Record page from ONLY genuinely
 * available dates on the hydrated employee record + (optionally) their offboarding plan
 * instance. Never invents a transition date and never falls back to today's date — a stage with
 * no reliable source is simply given `date: null`, and the page renders the existing "—"
 * empty-state convention for it.
 *
 * Sources, all pre-existing and already trustworthy:
 * - Active: `employee.effectiveEmploymentRecord.effectiveFrom` (the record's own start), falling
 *   back to `employee.startDate` if no employment record resolved — both are real, persisted
 *   values, never derived from "today".
 * - Offboarding: the offboarding plan instance's own `startedAt` (when a real instance exists).
 * - Former: `employee.contractEndDate` (Final Working Date) once the instance is completed
 *   (`instance.completedAt`), or the employee's own `contractEndDate` if status is already
 *   Former with no instance on record.
 * - Upcoming / Onboarding: no transition-date field is persisted anywhere in the current data
 *   model for these stages (confirmed by this module's own research) — both are always `null`.
 *
 * @param {Object} employee - hydrated employee record (employeeService.getById/getAll shape)
 * @param {Object|null} offboardingInstance - offboarding plan instance for this employee, if any
 * @returns {Array<{ stage: string, date: string|null }>}
 */
export function buildLifecycleHistory(employee, offboardingInstance = null) {
  const activeDate = employee?.effectiveEmploymentRecord?.effectiveFrom || employee?.startDate || null;
  const offboardingDate = offboardingInstance?.startedAt ? offboardingInstance.startedAt.slice(0, 10) : null;
  const formerDate = offboardingInstance?.completedAt
    ? offboardingInstance.completedAt.slice(0, 10)
    : employee?.status === 'Former'
    ? employee?.contractEndDate || null
    : null;

  return [
    { stage: 'Upcoming', date: null },
    { stage: 'Onboarding', date: null },
    { stage: 'Active', date: activeDate },
    { stage: 'Offboarding', date: offboardingDate },
    { stage: 'Former', date: formerDate },
  ];
}
