import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { employeeService } from './employeeService.js';
import { activityTypeService } from './activityTypeService.js';
import { auditService, AUDIT_ACTIONS } from './auditService.js';
import {
  filterActivities,
  sortActivities,
} from '../domain/activityDomain.js';
import { getTodayLocalDateString } from '../utils/dateUtils.js';

/**
 * Enriches a raw Activity entity with related employee, assignee employee, and type objects.
 * Safely handles missing or inactive references.
 */
function enrichActivityItem(activity, employeeMap = new Map(), typeMap = new Map()) {
  if (!activity) return null;

  const type = typeMap.get(activity.typeId) || {
    id: activity.typeId || 'unknown',
    name: 'General Task',
    category: 'General',
    icon: 'CheckSquare',
    active: true,
  };

  const relatedEmployee = employeeMap.get(activity.employeeId) || {
    id: activity.employeeId || 'unknown',
    fullName: 'Unknown Employee',
    employeeId: 'N/A',
    status: 'Active',
    photo: 'UE',
  };

  const assigneeEmployee = employeeMap.get(activity.assigneeId) || {
    id: activity.assigneeId || 'unassigned',
    fullName: 'Unassigned',
    employeeId: 'N/A',
    status: 'Active',
    photo: 'UA',
  };

  return {
    ...activity,
    type,
    relatedEmployee,
    assigneeEmployee,
  };
}

export const activityService = {
  /**
   * Fetches all registered ActivityTypes.
   */
  async getAllTypes() {
    return activityTypeService.getAll();
  },

  /**
   * Fetches all active ActivityTypes (for creation dropdowns).
   */
  async getActiveTypes() {
    return activityTypeService.getActive();
  },

  /**
   * Fetches enriched activities matching search, scope, and filter criteria.
   */
  async getAll(options = {}) {
    const {
      scope = 'all', // 'all' | 'my' | 'overdue'
      currentUserId = null,
      search = '',
      typeId = '',
      assigneeId = '',
      employeeId = '',
      dueState = '',
      source = '',
      sortBy = 'dueDate',
      sortOrder = 'asc',
      referenceDate = getTodayLocalDateString(),
    } = options;

    const db = loadDatabase();
    const rawActivities = db.activities || [];
    const rawTypes = db.activityTypes || [];

    // Asynchronously resolve all employees via employeeService
    const allEmployees = await employeeService.getAll();
    const employeeMap = new Map(allEmployees.map((e) => [e.id, e]));
    const typeMap = new Map(rawTypes.map((t) => [t.id, t]));

    // Enrich raw activities with lookup objects
    const enrichedList = rawActivities
      .map((act) => enrichActivityItem(act, employeeMap, typeMap))
      .filter(Boolean);

    // Apply domain filtering
    const filtered = filterActivities(
      enrichedList,
      {
        scope,
        currentUserId,
        search,
        typeId,
        assigneeId,
        employeeId,
        dueState,
        source,
      },
      referenceDate
    );

    // Apply domain sorting
    return sortActivities(filtered, sortBy, sortOrder);
  },

  /**
   * Fetches a single enriched activity by ID.
   */
  async getById(id) {
    if (!id) return null;
    const db = loadDatabase();
    const raw = (db.activities || []).find((a) => a.id === id);
    if (!raw) return null;

    const allEmployees = await employeeService.getAll();
    const rawTypes = db.activityTypes || [];

    const employeeMap = new Map(allEmployees.map((e) => [e.id, e]));
    const typeMap = new Map(rawTypes.map((t) => [t.id, t]));

    return enrichActivityItem(raw, employeeMap, typeMap);
  },

  /**
   * Helper to fetch overdue incomplete activities.
   */
  async getOverdueActivities(referenceDate = getTodayLocalDateString(), options = {}) {
    return this.getAll({
      ...options,
      scope: 'overdue',
      referenceDate,
    });
  },

  /**
   * Marks an activity as completed and reconciles parent onboarding plan if linked.
   */
  async markComplete(id, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const activities = db.activities || [];
    const index = activities.findIndex((a) => a.id === id);

    if (index === -1) {
      throw new Error(`Activity with ID "${id}" not found.`);
    }

    const nowIso = new Date().toISOString();
    activities[index] = {
      ...activities[index],
      completed: true,
      completedAt: nowIso,
      completedBy: currentUserId,
      updatedAt: nowIso,
    };

    db.activities = activities;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ACTIVITY_COMPLETED || 'ACTIVITY_COMPLETED',
        'Activity',
        id,
        `Completed activity "${activities[index].title}"`
      );
    } catch (auditErr) {}

    // Dynamic import to maintain acyclic module graph
    if (activities[index].sourceEntityType === 'OnboardingTaskInstance') {
      try {
        const { onboardingService } = await import('./onboardingService.js');
        await onboardingService.reconcileOnboardingPlanProgress(id, db);
      } catch (reconcileErr) {}
    } else if (activities[index].sourceEntityType === 'OffboardingTaskInstance') {
      try {
        const { offboardingService } = await import('./offboardingService.js');
        await offboardingService.reconcileOffboardingPlanProgress(id, db);
      } catch (reconcileErr) {}
    }

    return this.getById(id);
  },

  /**
   * Reopens a completed activity and reconciles parent onboarding or offboarding plan if linked.
   */
  async reopen(id, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const activities = db.activities || [];
    const index = activities.findIndex((a) => a.id === id);

    if (index === -1) {
      throw new Error(`Activity with ID "${id}" not found.`);
    }

    const nowIso = new Date().toISOString();
    activities[index] = {
      ...activities[index],
      completed: false,
      completedAt: null,
      completedBy: null,
      updatedAt: nowIso,
    };

    db.activities = activities;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ACTIVITY_REOPENED || 'ACTIVITY_REOPENED',
        'Activity',
        id,
        `Reopened activity "${activities[index].title}"`
      );
    } catch (auditErr) {}

    // Dynamic import to maintain acyclic module graph
    if (activities[index].sourceEntityType === 'OnboardingTaskInstance') {
      try {
        const { onboardingService } = await import('./onboardingService.js');
        await onboardingService.reconcileOnboardingPlanProgress(id, db);
      } catch (reconcileErr) {}
    } else if (activities[index].sourceEntityType === 'OffboardingTaskInstance') {
      try {
        const { offboardingService } = await import('./offboardingService.js');
        await offboardingService.reconcileOffboardingPlanProgress(id, db);
      } catch (reconcileErr) {}
    }

    return this.getById(id);
  },

  /**
   * Marks a specific SET of activities complete — e.g. "Mark All as Complete" in the Overdue
   * Onboarding Tasks popup. Reuses markComplete() for every ID (the exact same single-activity
   * completion path, including its onboarding/offboarding plan reconciliation), so there is no
   * second, slightly-different bulk-completion rule — only the caller decides which IDs belong
   * in the set (e.g. the popup's own current overdue list), never this method.
   */
  async markCompleteMany(ids = [], currentUserId = 'emp-001') {
    const results = [];
    for (const id of ids) {
      results.push(await this.markComplete(id, currentUserId));
    }
    return results;
  },
};
