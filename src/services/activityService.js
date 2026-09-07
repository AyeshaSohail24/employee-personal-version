import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { employeeService } from './employeeService.js';
import { auditService, AUDIT_ACTIONS } from './auditService.js';
import {
  filterActivities,
  sortActivities,
  resolveDueState,
  validateActivity,
  ACTIVITY_SOURCES,
  ACTIVITY_DUE_STATES,
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
    const db = loadDatabase();
    return db.activityTypes || [];
  },

  /**
   * Fetches all active ActivityTypes (for creation dropdowns).
   */
  async getActiveTypes() {
    const types = await this.getAllTypes();
    return types.filter((t) => t.active !== false);
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
   * Helper to fetch activities assigned to the specified user.
   */
  async getMyActivities(assigneeId, options = {}) {
    return this.getAll({
      ...options,
      scope: 'my',
      currentUserId: assigneeId,
    });
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
   * Creates a new manual activity.
   */
  async create(activityData = {}, currentUserId = 'emp-001') {
    const { isValid, errors } = validateActivity(activityData);
    if (!isValid) {
      const errorMsg = Object.values(errors).join(', ');
      throw new Error(`Validation failed: ${errorMsg}`);
    }

    const db = loadDatabase();
    const activities = db.activities || [];

    const newId = `act-${String(activities.length + 1).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const newActivity = {
      id: newId,
      typeId: activityData.typeId,
      title: activityData.title.trim(),
      description: (activityData.description || activityData.notes || '').trim(),
      employeeId: activityData.employeeId,
      assigneeId: activityData.assigneeId,
      dueDate: activityData.dueDate,
      completed: false,
      completedAt: null,
      completedBy: null,
      source: activityData.source || ACTIVITY_SOURCES.MANUAL,
      sourceEntityType: activityData.sourceEntityType || null,
      sourceEntityId: activityData.sourceEntityId || null,
      createdAt: nowIso,
      createdBy: currentUserId,
      updatedAt: nowIso,
    };

    db.activities = [newActivity, ...activities];
    saveDatabase(db);

    // Audit log integration
    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ACTIVITY_CREATED || 'ACTIVITY_CREATED',
        'Activity',
        newId,
        `Created activity "${newActivity.title}" for ${newActivity.dueDate}`
      );
    } catch (auditErr) {
      // Graceful fallback if audit action key varies
    }

    return this.getById(newId);
  },

  /**
   * Updates an existing activity record.
   */
  async update(id, updateData = {}, currentUserId = 'emp-001') {
    const db = loadDatabase();
    const activities = db.activities || [];
    const index = activities.findIndex((a) => a.id === id);

    if (index === -1) {
      throw new Error(`Activity with ID "${id}" not found.`);
    }

    const existing = activities[index];
    const updatedRecord = {
      ...existing,
      ...updateData,
      title: updateData.title ? updateData.title.trim() : existing.title,
      description: updateData.description !== undefined
        ? updateData.description.trim()
        : (updateData.notes !== undefined ? updateData.notes.trim() : existing.description),
      sourceEntityType: updateData.sourceEntityType !== undefined ? updateData.sourceEntityType : existing.sourceEntityType,
      sourceEntityId: updateData.sourceEntityId !== undefined ? updateData.sourceEntityId : existing.sourceEntityId,
      updatedAt: new Date().toISOString(),
    };

    activities[index] = updatedRecord;
    db.activities = activities;
    saveDatabase(db);

    try {
      await auditService.logAction(
        currentUserId,
        AUDIT_ACTIONS.ACTIVITY_UPDATED || 'ACTIVITY_UPDATED',
        'Activity',
        id,
        `Updated activity "${updatedRecord.title}"`
      );
    } catch (auditErr) {}

    return this.getById(id);
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
   * Calculates KPI summary counts (Overdue, Due Today, Upcoming, Completed) for the target population.
   */
  async getSummaryStats(options = {}) {
    const { scope = 'all', currentUserId = null, referenceDate = getTodayLocalDateString() } = options;
    const allActivities = await this.getAll({ scope, currentUserId, referenceDate });

    const stats = {
      overdueCount: 0,
      dueTodayCount: 0,
      upcomingCount: 0,
      completedCount: 0,
      totalCount: allActivities.length,
    };

    allActivities.forEach((act) => {
      const state = resolveDueState(act, referenceDate);
      if (state === ACTIVITY_DUE_STATES.COMPLETED) {
        stats.completedCount += 1;
      } else if (state === ACTIVITY_DUE_STATES.DUE_TODAY) {
        stats.dueTodayCount += 1;
      } else if (state === ACTIVITY_DUE_STATES.OVERDUE) {
        stats.overdueCount += 1;
      } else if (state === ACTIVITY_DUE_STATES.UPCOMING) {
        stats.upcomingCount += 1;
      }
    });

    return stats;
  },
};
