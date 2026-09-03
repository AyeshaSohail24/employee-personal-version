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
