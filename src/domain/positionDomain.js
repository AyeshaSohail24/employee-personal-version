/**
 * Domain logic and formatting helpers for Job Positions.
 */

/**
 * Returns canonical job position name for display.
 * 
 * @param {string|null|undefined} positionName Canonical job position title
 * @returns {string} Position title string
 */
export function formatCompactPosition(positionName) {
  if (!positionName) return 'Unassigned';
  const name = typeof positionName === 'string' ? positionName : (positionName.name || '');
  return name || 'Unassigned';
}
