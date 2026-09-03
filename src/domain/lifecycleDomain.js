export const LIFECYCLE_STATUSES = {
  UPCOMING: 'Upcoming',
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  DEPARTING: 'Departing',
  FORMER: 'Former',
};

const VALID_TRANSITIONS = {
  [LIFECYCLE_STATUSES.UPCOMING]: [LIFECYCLE_STATUSES.ONBOARDING, LIFECYCLE_STATUSES.ACTIVE, LIFECYCLE_STATUSES.FORMER],
  [LIFECYCLE_STATUSES.ONBOARDING]: [LIFECYCLE_STATUSES.ACTIVE, LIFECYCLE_STATUSES.DEPARTING, LIFECYCLE_STATUSES.FORMER],
  [LIFECYCLE_STATUSES.ACTIVE]: [LIFECYCLE_STATUSES.DEPARTING, LIFECYCLE_STATUSES.FORMER],
  [LIFECYCLE_STATUSES.DEPARTING]: [LIFECYCLE_STATUSES.FORMER, LIFECYCLE_STATUSES.ACTIVE],
  [LIFECYCLE_STATUSES.FORMER]: [LIFECYCLE_STATUSES.UPCOMING, LIFECYCLE_STATUSES.ONBOARDING, LIFECYCLE_STATUSES.ACTIVE], // Rehire transition
};

/**
 * Validates if an employee status transition is allowed.
 *
 * @param {string} currentStatus
 * @param {string} newStatus
 * @returns {boolean}
 */
export function isValidStatusTransition(currentStatus, newStatus) {
  if (!currentStatus || !newStatus) return false;
  if (currentStatus === newStatus) return true;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

/**
 * Filters a list of employees by lifecycle status.
 *
 * @param {Array<Object>} employees
 * @param {string} statusFilter
 * @returns {Array<Object>}
 */
export function filterEmployeesByStatus(employees = [], statusFilter = '') {
  if (!Array.isArray(employees)) return [];
  if (!statusFilter || statusFilter === 'All') return employees;
  return employees.filter((e) => e.status && e.status.toLowerCase() === statusFilter.toLowerCase());
}
