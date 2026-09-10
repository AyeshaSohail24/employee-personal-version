/**
 * Domain logic for Department reference data — currently just deterministic color
 * resolution used by the Employees Directory Timeline view.
 */

const DEPARTMENT_COLOR_PALETTE = [
  '#0E848D', '#2563EB', '#7C3AED', '#D97706', '#059669',
  '#DB2777', '#0891B2', '#CA8A04', '#4F46E5', '#DC2626',
];

const UNASSIGNED_COLOR = '#94A3B8';

/**
 * Resolves a deterministic display color for a Department.
 *
 * Prefers the department's own canonical `color` reference field (already used elsewhere
 * in the app, e.g. the Dashboard Department Snapshot widget), so a given department always
 * renders identically everywhere. Falls back to a stable hash of the department's `id` into
 * a fixed palette for departments that have no explicit color — so a department added later
 * (e.g. from a real backend/database) still receives a distinct, consistent color with no
 * Timeline/JSX changes required. Never branches on a department's name.
 *
 * @param {Object|null} department - Hydrated or raw Department record (must have `.id`)
 * @returns {string} Hex color string
 */
export function resolveDepartmentColor(department) {
  if (!department || !department.id) return UNASSIGNED_COLOR;
  if (department.color) return department.color;

  const idStr = String(department.id);
  let hash = 0;
  for (let i = 0; i < idStr.length; i += 1) {
    hash = (hash * 31 + idStr.charCodeAt(i)) >>> 0;
  }
  return DEPARTMENT_COLOR_PALETTE[hash % DEPARTMENT_COLOR_PALETTE.length];
}

/**
 * Builds a deduplicated department color legend from a set of (possibly filtered) hydrated
 * employees, generated dynamically from whatever departments are actually present — never a
 * hardcoded list — using the exact same resolver as the Timeline bars, so legend and bars can
 * never disagree.
 *
 * @param {Array<Object>} employees - Hydrated employees, each with an optional `.department`
 * @returns {Array<{ id: string, name: string, color: string }>}
 */
export function buildDepartmentLegend(employees = []) {
  const seen = new Map();

  employees.forEach((emp) => {
    const dept = emp.department;
    const key = dept && dept.id ? dept.id : 'unassigned';
    if (seen.has(key)) return;

    seen.set(key, {
      id: key,
      name: dept && dept.name ? dept.name : 'Unassigned',
      color: resolveDepartmentColor(dept),
    });
  });

  return Array.from(seen.values());
}
