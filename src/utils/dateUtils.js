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
 * Formats a YYYY-MM-DD string into a human-friendly format (e.g., 'Sep 02, 2026').
 * 
 * @param {string} dateStr 'YYYY-MM-DD' date string
 * @returns {string} Formatted date string
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return 'No Date';
  const parts = dateStr.split('-');
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

