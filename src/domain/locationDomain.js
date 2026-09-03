/**
 * Domain logic and formatting helpers for Work Locations.
 */

/**
 * Formats a location object or location name string into a compact display string for table and list views.
 * Preserves full canonical location data ('Kuala Lumpur') in underlying objects while rendering concise 'KL' in compact lists.
 * 
 * @param {Object|string|null|undefined} location Location object or location name string
 * @returns {string} Compact display label (e.g. 'Rizurf HQ — KL', 'Penang Branch', 'Client Site', 'No Fixed Location')
 */
export function formatCompactLocation(location) {
  if (!location) return 'Unassigned';
  const name = typeof location === 'string' ? location : (location.name || '');
  if (!name) return 'Unassigned';

  // Explicit compact replacements for table/list views
  if (name.includes('HQ') || name.includes('Kuala Lumpur')) {
    return 'Rizurf HQ — KL';
  }
  if (name.includes('Penang')) {
    return 'Penang Branch';
  }
  if (name.includes('Remote') || name.includes('Hub') || (typeof location === 'object' && location.type === 'Remote')) {
    return 'No Fixed Location';
  }
  if (name.includes('Cyberjaya') || name.includes('Client')) {
    return 'Client Site';
  }

  // General fallback replacement for any compact location string containing 'Kuala Lumpur'
  return name.replace(/\bKuala Lumpur\b/g, 'KL');
}
