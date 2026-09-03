/**
 * Domain logic for HR Activities & Task Management.
 */

import { getTodayLocalDateString } from '../utils/dateUtils.js';

export const ACTIVITY_DUE_STATES = {
  OVERDUE: 'Overdue',
  DUE_TODAY: 'Due Today',
  UPCOMING: 'Upcoming',
  COMPLETED: 'Completed',
};

export const ACTIVITY_SOURCES = {
  MANUAL: 'Manual',
  ONBOARDING: 'Onboarding',
  OFFBOARDING: 'Offboarding',
  SYSTEM: 'System',
};

/**
 * Resolves the dynamic due state of an activity against a reference date.
 * Precedence: Completed > Due Today > Overdue > Upcoming
 * 
 * @param {Object} activity Activity record
 * @param {string} referenceDate Date string 'YYYY-MM-DD'
 * @returns {string} One of ACTIVITY_DUE_STATES ('Completed', 'Due Today', 'Overdue', 'Upcoming')
 */
export function resolveDueState(activity, referenceDate = getTodayLocalDateString()) {
  if (!activity) return ACTIVITY_DUE_STATES.UPCOMING;
  
  if (activity.completed) {
    return ACTIVITY_DUE_STATES.COMPLETED;
  }
  
  const dueDate = activity.dueDate;
  if (!dueDate) return ACTIVITY_DUE_STATES.UPCOMING;
  
  if (dueDate === referenceDate) {
    return ACTIVITY_DUE_STATES.DUE_TODAY;
  }
  
  if (dueDate < referenceDate) {
    return ACTIVITY_DUE_STATES.OVERDUE;
  }
  
  return ACTIVITY_DUE_STATES.UPCOMING;
}

/**
 * Filters enriched activity items by search text, scope, type, assignee, employee, due state, and source.
 * 
 * @param {Array<Object>} activities List of enriched activity view models
 * @param {Object} options Filter options ({ search, scope, typeId, assigneeId, employeeId, dueState, source })
 * @param {string} referenceDate Reference date string
 * @returns {Array<Object>} Filtered list of enriched activities
 */
export function filterActivities(activities = [], options = {}, referenceDate = getTodayLocalDateString()) {
  const {
    search = '',
    scope = 'all', // 'all' | 'my' | 'overdue'
    currentUserId = null,
    typeId = '',
    assigneeId = '',
    employeeId = '',
    dueState = '',
    source = '',
  } = options;

  const query = search.trim().toLowerCase();

  return activities.filter((act) => {
    // 1. Scope filter
    if (scope === 'my') {
      if (currentUserId && act.assigneeId !== currentUserId) return false;
    } else if (scope === 'overdue') {
      const derivedState = resolveDueState(act, referenceDate);
      if (derivedState !== ACTIVITY_DUE_STATES.OVERDUE) return false;
    }

    // 2. Due state filter
    if (dueState) {
      const derivedState = resolveDueState(act, referenceDate);
      if (derivedState !== dueState) return false;
    }

    // 3. Activity Type filter
    if (typeId && act.typeId !== typeId) {
      return false;
    }

    // 4. Assignee filter
    if (assigneeId && act.assigneeId !== assigneeId) {
      return false;
    }

    // 5. Related Employee filter
    if (employeeId && act.employeeId !== employeeId) {
      return false;
    }

    // 6. Source filter
    if (source && act.source !== source) {
      return false;
    }

    // 7. Search query filter
    if (query) {
      const titleMatch = (act.title || '').toLowerCase().includes(query);
      const descMatch = (act.description || '').toLowerCase().includes(query);
      const empNameMatch = act.relatedEmployee
        ? (act.relatedEmployee.fullName || '').toLowerCase().includes(query) ||
          (act.relatedEmployee.employeeId || '').toLowerCase().includes(query)
        : false;
      const assigneeNameMatch = act.assigneeEmployee
        ? (act.assigneeEmployee.fullName || '').toLowerCase().includes(query)
        : false;
      const typeMatch = act.type ? (act.type.name || '').toLowerCase().includes(query) : false;

      if (!titleMatch && !descMatch && !empNameMatch && !assigneeNameMatch && !typeMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts activities by due date, created date, or title.
 * 
 * @param {Array<Object>} activities List of activities
 * @param {string} sortBy 'dueDate' | 'createdAt' | 'title'
 * @param {string} sortOrder 'asc' | 'desc'
 * @returns {Array<Object>} Sorted list of activities
 */
export function sortActivities(activities = [], sortBy = 'dueDate', sortOrder = 'asc') {
  const sorted = [...activities];
  const orderMult = sortOrder === 'desc' ? -1 : 1;

  sorted.sort((a, b) => {
    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '') * orderMult;
    }
    if (sortBy === 'createdAt') {
      return ((a.createdAt || '') > (b.createdAt || '') ? 1 : -1) * orderMult;
    }
    // Default: dueDate
    const d1 = a.dueDate || '9999-12-31';
    const d2 = b.dueDate || '9999-12-31';
    if (d1 === d2) return 0;
    return (d1 > d2 ? 1 : -1) * orderMult;
  });

  return sorted;
}

/**
 * Validates new or updated activity data.
 * 
 * @param {Object} data Activity payload
 * @returns {Object} { isValid: boolean, errors: Object }
 */
export function validateActivity(data = {}) {
  const errors = {};

  if (!data.title || !data.title.trim()) {
    errors.title = 'Title is required';
  }

  if (!data.typeId) {
    errors.typeId = 'Activity Type is required';
  }

  if (!data.employeeId) {
    errors.employeeId = 'Related Employee is required';
  }

  if (!data.assigneeId) {
    errors.assigneeId = 'Assignee is required';
  }

  if (!data.dueDate) {
    errors.dueDate = 'Due Date is required';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)) {
    errors.dueDate = 'Due Date must be YYYY-MM-DD';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
