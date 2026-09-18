/**
 * Centralized Date Utilities for the Rizurf Employees App.
 * Ensures consistent local YYYY-MM-DD date formatting without UTC offset shifts.
 */

/**
 * Returns today's current date as a local 'YYYY-MM-DD' string.
 * Avoids toISOString() UTC conversion shift for UTC+8 (Malaysia) time zone.
 * 
 * @returns {string} Local date string in 'YYYY-MM-DD' format
 */
export function getTodayLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD (or full ISO timestamp, e.g. from the live API — '2026-07-27T00:00:00.000Z')
 * string into a human-friendly format (e.g., 'Sep 02, 2026').
 *
 * @param {string} dateStr 'YYYY-MM-DD' date string, or an ISO timestamp starting with one
 * @returns {string} Formatted date string
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return 'No Date';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  
  const [year, month, day] = parts.map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  if (isNaN(dateObj.getTime())) return dateStr;
  
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Calculates day difference between a date string and reference date string.
 * Negative number means date is in the past (overdue).
 * 
 * @param {string} targetDate YYYY-MM-DD
 * @param {string} referenceDate YYYY-MM-DD
 * @returns {number} Days difference (targetDate - referenceDate)
 */
export function getDaysDifference(targetDate, referenceDate) {
  if (!targetDate || !referenceDate) return 0;
  const t1 = new Date(targetDate).getTime();
  const t2 = new Date(referenceDate).getTime();
  const diffTime = t1 - t2;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Adds or subtracts a number of days from a YYYY-MM-DD date string safely in local time.
 * 
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {number} days Days to add or subtract
 * @returns {string} Resulting date string in 'YYYY-MM-DD' format
 */
export function addDaysToLocalDate(dateStr, days = 0) {
  if (!dateStr) return null;
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  const d = new Date(year, month - 1, day + Number(days));
  if (isNaN(d.getTime())) return dateStr;
  const rYear = d.getFullYear();
  const rMonth = String(d.getMonth() + 1).padStart(2, '0');
  const rDay = String(d.getDate()).padStart(2, '0');
  return `${rYear}-${rMonth}-${rDay}`;
}

/**
 * Calculates employment/internship duration progress from a Start and (optional) End date.
 * Single centralized source for the Employees Directory Duration column/card — must not be
 * reimplemented separately per view.
 *
 * - No end date: 'ongoing' state, no percent (never fabricates an end date).
 * - Reference date before start: 'upcoming' state, 0% progress, "Starts in X days".
 * - Reference date within [start, end): 'active' state, elapsed % clamped 0-100, "X days left".
 * - Reference date on/after end: 'completed' state, 100% progress.
 *
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string|null} contractEndDate 'YYYY-MM-DD' or null/undefined
 * @param {string} [referenceDate] 'YYYY-MM-DD', defaults to today (local)
 * @returns {{ state: 'ongoing'|'upcoming'|'active'|'completed', percent: number|null, label: string }}
 */
export function calculateDurationProgress(startDate, contractEndDate, referenceDate = getTodayLocalDateString()) {
  if (!startDate || !contractEndDate) {
    return { state: 'ongoing', percent: null, label: 'Ongoing' };
  }

  const start = startDate.slice(0, 10);
  const end = contractEndDate.slice(0, 10);
  const ref = referenceDate.slice(0, 10);

  if (ref < start) {
    const daysUntilStart = getDaysDifference(start, ref);
    return { state: 'upcoming', percent: 0, label: `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}` };
  }

  if (ref >= end) {
    return { state: 'completed', percent: 100, label: 'Completed' };
  }

  const totalDays = getDaysDifference(end, start);
  const elapsedDays = getDaysDifference(ref, start);
  const percent = totalDays > 0 ? Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100))) : 100;
  const daysLeft = getDaysDifference(end, ref);

  return { state: 'active', percent, label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` };
}

/**
 * Calculates the visible calendar range for a Timeline visualization from a set of
 * employment periods. The domain is EXACTLY the earliest Start Date through the latest
 * effective End Date among the periods supplied — never padded, never snapped to a calendar
 * month boundary. Callers that filter/search the underlying personnel list before calling this
 * (e.g. the Personnel directory's Timeline view) automatically get a range that reflects only
 * what is currently displayed — this function has no independent filtering of its own.
 *
 * An "effective End Date" for a still-ongoing period (no `contractEndDate`) is the reference
 * date (today), EXCEPT it is never allowed to fall before that same person's own Start Date —
 * this matters for an Upcoming hire whose Start Date is in the future: their bar's domain
 * contribution must not be pulled behind their own start just because "today" is earlier than
 * it. No End Date is ever fabricated; this is purely how far the shared AXIS needs to extend to
 * plot an ongoing bar truthfully through "now" (or through the person's own start, whichever is
 * later) — see calculateTimelineBarPosition() for how each bar is actually drawn.
 *
 * @param {Array<{startDate: string, contractEndDate: string|null}>} periods
 * @param {string} [referenceDate] 'YYYY-MM-DD', defaults to today (local)
 * @returns {{ rangeStart: string, rangeEnd: string }|null} Exact 'YYYY-MM-DD' bounds, or null if no valid Start Dates exist
 */
export function calculateTimelineRange(periods = [], referenceDate = getTodayLocalDateString()) {
  const validPeriods = periods.filter((p) => p && p.startDate);
  if (validPeriods.length === 0) return null;

  const rangeStart = validPeriods.reduce((min, p) => (p.startDate < min ? p.startDate : min), validPeriods[0].startDate);

  const rangeEnd = validPeriods.reduce((max, p) => {
    const effectiveEnd = p.contractEndDate || (referenceDate > p.startDate ? referenceDate : p.startDate);
    return effectiveEnd > max ? effectiveEnd : max;
  }, rangeStart);

  return { rangeStart, rangeEnd };
}

/**
 * Formats a 'YYYY-MM-DD' date in a short, compact style ("Jun 29"), including the year
 * ("Jun 29, 2026") only when `includeYear` is true. Used for the Timeline's axis ticks AND its
 * per-bar Start/End Date labels — the app's existing formatDateDisplay() always includes the
 * year ("Jun 29, 2026"), which is unnecessarily verbose for a dense Timeline row; this is the
 * single shared compact formatter both call sites use, so they can never drift apart.
 *
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {boolean} [includeYear=false]
 * @returns {string}
 */
export function formatCompactDate(dateStr, includeYear = false) {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', includeYear
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric' });
}

/**
 * Generates axis ticks at a fixed day interval across a range, labeled with the specific date —
 * used for short ranges where whole-month boundaries would produce too few (or zero) ticks to be
 * a useful axis. Always includes a final tick exactly at rangeEnd so the last date is legible.
 */
function generateDayIntervalTicks(rangeStart, totalDays, stepDays, spansMultipleYears) {
  const ticks = [];
  for (let offset = 0; offset <= totalDays; offset += stepDays) {
    const tickDate = addDaysToLocalDate(rangeStart, offset);
    ticks.push({ label: formatCompactDate(tickDate, spansMultipleYears), ratio: offset / totalDays });
  }
  const lastRatio = ticks.length > 0 ? ticks[ticks.length - 1].ratio : -1;
  if (lastRatio < 1) {
    ticks.push({ label: formatCompactDate(addDaysToLocalDate(rangeStart, totalDays), spansMultipleYears), ratio: 1 });
  }
  return ticks;
}

/**
 * Generates axis ticks at whole-calendar-month boundaries, every `stepMonths` months (1 for a
 * normal multi-month range, a larger step such as 3 for a long multi-year range so the axis
 * never becomes overcrowded). Includes the year in each label whenever the range spans more than
 * one calendar year, so multi-year data is never visually ambiguous.
 */
function generateMonthBoundaryTicks(rangeStart, rangeEnd, totalDays, stepMonths, spansMultipleYears) {
  const [startYear, startMonthNum] = rangeStart.slice(0, 7).split('-').map(Number);
  const [endYear, endMonthNum] = rangeEnd.slice(0, 7).split('-').map(Number);

  const ticks = [];
  let year = startYear;
  let month = startMonthNum;

  while (year < endYear || (year === endYear && month <= endMonthNum)) {
    const tickDate = `${year}-${String(month).padStart(2, '0')}-01`;
    if (tickDate >= rangeStart) {
      const dayOffset = getDaysDifference(tickDate, rangeStart);
      const ratio = Math.min(1, Math.max(0, dayOffset / totalDays));
      const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
      ticks.push({ label: spansMultipleYears ? `${monthLabel} ${year}` : monthLabel, ratio });
    }

    month += stepMonths;
    while (month > 12) {
      month -= 12;
      year += 1;
    }
  }

  return ticks;
}

/**
 * Generates axis ticks (label + horizontal position ratio 0-1) across a Timeline date range,
 * choosing a human-readable interval from the ACTUAL span rather than a fixed calendar
 * convention: specific dates every few days for a short range, weekly for a range of a month or
 * two, whole months for a typical multi-month/multi-year range, and a coarser quarterly step for
 * a long multi-year range so the axis never becomes overcrowded. A true single-point range (one
 * person, or every displayed person sharing an identical Start Date and effective End Date)
 * still renders exactly one readable tick naming that date, never an empty axis.
 *
 * @param {string} rangeStart 'YYYY-MM-DD'
 * @param {string} rangeEnd 'YYYY-MM-DD'
 * @returns {Array<{ label: string, ratio: number }>}
 */
export function generateTimelineMonthTicks(rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) return [];
  const totalDays = getDaysDifference(rangeEnd, rangeStart);
  const spansMultipleYears = rangeStart.slice(0, 4) !== rangeEnd.slice(0, 4);

  if (totalDays <= 0) {
    return [{ label: formatCompactDate(rangeStart, spansMultipleYears), ratio: 0 }];
  }
  if (totalDays <= 21) {
    return generateDayIntervalTicks(rangeStart, totalDays, Math.max(1, Math.round(totalDays / 5)), spansMultipleYears);
  }
  if (totalDays <= 70) {
    return generateDayIntervalTicks(rangeStart, totalDays, 7, spansMultipleYears);
  }
  if (totalDays <= 730) {
    return generateMonthBoundaryTicks(rangeStart, rangeEnd, totalDays, 1, spansMultipleYears);
  }
  return generateMonthBoundaryTicks(rangeStart, rangeEnd, totalDays, 3, spansMultipleYears);
}

/**
 * Computes a Timeline bar's horizontal position/width as percentages of a visible range,
 * clamped to that range, plus whether the underlying employment period is ongoing (no End
 * Date — the bar visually extends through the reference date without ever fabricating or
 * writing back a fake End Date). Guards the zero-width-domain edge case (a single plotted
 * period, or every displayed period sharing an identical Start/effective-End date) by drawing
 * one full-width marker instead of dividing by zero or hiding the bar entirely — the underlying
 * dates are never altered, only this pixel math is guarded.
 *
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string|null} contractEndDate 'YYYY-MM-DD' or null
 * @param {string} rangeStart 'YYYY-MM-DD'
 * @param {string} rangeEnd 'YYYY-MM-DD'
 * @param {string} [referenceDate] 'YYYY-MM-DD', defaults to today (local)
 * @returns {{ leftPercent: number, widthPercent: number, isOngoing: boolean }|null}
 */
export function calculateTimelineBarPosition(startDate, contractEndDate, rangeStart, rangeEnd, referenceDate = getTodayLocalDateString()) {
  if (!startDate || !rangeStart || !rangeEnd) return null;

  const isOngoing = !contractEndDate;
  const effectiveEnd = contractEndDate || (referenceDate > startDate ? referenceDate : startDate);

  const totalDays = getDaysDifference(rangeEnd, rangeStart);
  if (totalDays <= 0) {
    return { leftPercent: 0, widthPercent: 100, isOngoing };
  }

  const clampedStart = startDate < rangeStart ? rangeStart : startDate;
  const clampedEnd = effectiveEnd > rangeEnd ? rangeEnd : effectiveEnd;

  const startOffsetDays = getDaysDifference(clampedStart, rangeStart);
  const endOffsetDays = getDaysDifference(clampedEnd, rangeStart);

  const leftPercent = Math.min(100, Math.max(0, (startOffsetDays / totalDays) * 100));
  const rightPercent = Math.min(100, Math.max(0, (endOffsetDays / totalDays) * 100));
  const widthPercent = Math.max(0.6, rightPercent - leftPercent);

  return { leftPercent, widthPercent, isOngoing };
}

