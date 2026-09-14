import {
  resolveCurrentRecord,
  resolveNextRecord,
  resolveHistoricalRecord,
} from './employmentDomain.js';
import { addDaysToLocalDate, getTodayLocalDateString } from '../utils/dateUtils.js';

export const ASSIGNMENT_RULES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  HR: 'hr',
  SPECIFIC_EMPLOYEE: 'specific_employee',
};

export const OFFBOARDING_INSTANCE_STATUS = {
  IN_PROGRESS: 'In Progress',
  NEEDS_ATTENTION: 'Needs Attention',
  COMPLETED: 'Completed',
  // Terminal state for a plan intentionally stopped/cancelled before successful completion (via
  // "Drop Plan"). Distinct from COMPLETED (successful finish) — both are non-active for
  // duplicate-launch eligibility, but only COMPLETED represents success. See
  // isActiveOffboardingPlanStatus(). This is offboarding's OWN independent status model — not
  // imported from or shared with onboardingDomain.js's PLAN_INSTANCE_STATUS.DROPPED.
  DROPPED: 'Dropped',
};

/**
 * Single source of truth for "is this offboarding plan instance currently active" — i.e. it can
 * still block a duplicate launch, still contribute to overdue alerts/active summary counts, and
 * can still be In Progress/Needs Attention. Both COMPLETED and DROPPED are non-active terminal
 * states. Mirrors onboardingDomain.js's isActivePlanStatus() in concept only — a fully
 * independent implementation over OFFBOARDING_INSTANCE_STATUS, never importing from
 * onboardingDomain.js.
 */
export function isActiveOffboardingPlanStatus(status) {
  return status !== OFFBOARDING_INSTANCE_STATUS.COMPLETED && status !== OFFBOARDING_INSTANCE_STATUS.DROPPED;
}

export const OFFBOARDING_TASK_SCOPES = {
  UNIVERSAL: 'universal',
  DEPARTMENT: 'department',
};

export const OFFBOARDING_PERSON_TYPES = {
  EMPLOYEE: 'employee',
  INTERN: 'intern',
};

/**
 * Composes a departing person's full set of applicable offboarding tasks from reusable,
 * person-type-aware scope-based task definitions: (Employee OR Intern) Universal + (Employee OR
 * Intern) Department (by the employee's own department ID) — mirroring the same composition
 * shape as composeOnboardingTasks(), but entirely independent: offboarding scope tasks
 * (db.offboardingPlanTasks) are never mixed with onboarding's. Person type is resolved once from
 * `employee.directoryType`, exactly like onboarding, and applied consistently to BOTH lookups —
 * an Employee Universal offboarding task and an Intern Universal offboarding task are two
 * entirely separate, non-overlapping task sets, and likewise for Department. This is the SINGLE
 * source of offboarding composition truth — the Plans page's per-type summary, the Launch modal's
 * preview, and the actual launch transaction all call this same function (or service methods
 * built directly on it) with the same inputs, so a previewed count can never drift from what
 * actually gets launched. `anchorDate` here is the resolved Final Working Date/departure anchor
 * (never an onboarding start-date anchor).
 */
export function composeOffboardingTasks(employee, taskDefinitions = [], anchorDate = null) {
  const personType = employee && employee.directoryType === 'Intern'
    ? OFFBOARDING_PERSON_TYPES.INTERN
    : OFFBOARDING_PERSON_TYPES.EMPLOYEE;
  const departmentId = (employee && employee.department && employee.department.id) || null;

  const bySequence = (a, b) => (a.sequence || 0) - (b.sequence || 0);
  const activeDefs = (taskDefinitions || []).filter((t) => t && t.active !== false);

  const universalTasks = activeDefs
    .filter((t) => t.scopeType === OFFBOARDING_TASK_SCOPES.UNIVERSAL && t.personType === personType)
    .sort(bySequence);

  const departmentTasks = departmentId
    ? activeDefs
        .filter((t) => t.scopeType === OFFBOARDING_TASK_SCOPES.DEPARTMENT && t.personType === personType && t.scopeDepartmentId === departmentId)
        .sort(bySequence)
    : [];

  const composed = [...universalTasks, ...departmentTasks];

  const tasks = composed.map((t, idx) => ({
    ...t,
    scopeSequence: t.sequence,
    sequence: idx + 1,
    calculatedDueDate: anchorDate ? addDaysToLocalDate(anchorDate, t.relativeOffsetDays || 0) : null,
  }));

  const counts = {
    universal: universalTasks.length,
    department: departmentTasks.length,
    typeSpecific: universalTasks.length,
    total: tasks.length,
    required: tasks.filter((t) => t.required).length,
  };

  return { tasks, personType, typeScope: personType, departmentId, counts };
}

/**
 * Resolves the canonical employment end date / final working date anchor for offboarding.
 * Precedence:
 * 1. customAnchorDate (explicit launch override - does NOT mutate EmploymentRecord)
 * 2. currentRecord.effectiveTo (if set)
 * 3. employee.contractEndDate (if set)
 * 4. historicalRecord.effectiveTo (for Former employees)
 */
export function resolveOffboardingAnchorDate(
  employee,
  records = [],
  customAnchorDate = null,
  referenceDate = getTodayLocalDateString()
) {
  if (customAnchorDate && customAnchorDate.trim()) {
    return customAnchorDate.trim().slice(0, 10);
  }

  if (!employee) return null;

  const currentRec = resolveCurrentRecord(employee.id, records, referenceDate);
  if (currentRec && currentRec.effectiveTo) {
    return currentRec.effectiveTo.slice(0, 10);
  }

  if (employee.contractEndDate) {
    return employee.contractEndDate.slice(0, 10);
  }

  if (employee.status === 'Former') {
    const histRec = resolveHistoricalRecord(employee.id, records, referenceDate);
    if (histRec && histRec.effectiveTo) {
      return histRec.effectiveTo.slice(0, 10);
    }
  }

  return null;
}

/**
 * Checks offboarding launch eligibility for an employee.
 * Provides explicit reasons for ineligibility.
 */
export function checkOffboardingEligibility(
  employee,
  records = [],
  existingInstances = [],
  customAnchorDate = null,
  referenceDate = getTodayLocalDateString()
) {
  if (!employee) {
    return { isEligible: false, reason: 'Employee not found.', resolvedAnchorDate: null };
  }

  if (employee.status === 'Upcoming' || employee.status === 'Onboarding') {
    return {
      isEligible: false,
      reason: `Employee is currently in ${employee.status} status and is not eligible for offboarding launch.`,
      resolvedAnchorDate: null,
    };
  }

  if (employee.status === 'Former') {
    return {
      isEligible: false,
      reason: 'Employee is already Former. New offboarding plans cannot be launched for Former employees.',
      resolvedAnchorDate: null,
    };
  }

  // Check one active plan policy — a Dropped plan (droppedAt set) is a non-active terminal state,
  // exactly like a Completed one, so it must NOT block a replacement launch. This mirrors
  // isActiveOffboardingPlanStatus()'s own definition of "active" without importing it here (this
  // function receives raw stored instances, not derived-status-enriched ones).
  const activePlan = existingInstances.find(
    (inst) => inst.employeeId === employee.id && !inst.completedAt && !inst.droppedAt
  );
  if (activePlan) {
    return {
      isEligible: false,
      reason: `Employee ${employee.fullName} already has an active offboarding plan (In Progress / Needs Attention).`,
      resolvedAnchorDate: null,
    };
  }

  const resolvedAnchorDate = resolveOffboardingAnchorDate(employee, records, customAnchorDate, referenceDate);

  if (!resolvedAnchorDate) {
    return {
      isEligible: false,
      reason: `Active employee ${employee.fullName} has no confirmed exit date on record. Please set a Final Working Date override to proceed.`,
      resolvedAnchorDate: null,
    };
  }

  return {
    isEligible: true,
    reason: 'Employee is eligible for offboarding launch.',
    resolvedAnchorDate,
  };
}

/**
 * Resolves assignee Employee ID and details for a given assignment rule in offboarding.
 * Dynamic and semantic - does not hardcode employee IDs.
 */
export function resolveAssigneeForRule(
  rule,
  employee,
  effectiveRecord = null,
  userAccounts = [],
  allEmployees = [],
  specificAssigneeId = null
) {
  if (!rule) return { assigneeId: null, assigneeName: 'Unassigned', isResolved: false };

  const employeeMap = new Map((allEmployees || []).map((e) => [e.id, e]));

  switch (rule) {
    case ASSIGNMENT_RULES.EMPLOYEE: {
      if (employee && employee.id) {
        const emp = employeeMap.get(employee.id) || employee;
        return {
          assigneeId: emp.id,
          assigneeName: emp.fullName || 'Departing Employee',
          isResolved: true,
        };
      }
      return { assigneeId: null, assigneeName: 'Unassigned (No Employee)', isResolved: false };
    }

    case ASSIGNMENT_RULES.MANAGER: {
      const managerId = effectiveRecord ? effectiveRecord.managerId : null;
      if (managerId) {
        const manager = employeeMap.get(managerId);
        if (manager && manager.status !== 'Former') {
          return {
            assigneeId: manager.id,
            assigneeName: manager.fullName,
            isResolved: true,
          };
        }
      }
      return { assigneeId: null, assigneeName: 'Unassigned (Missing/Former Manager)', isResolved: false };
    }

    case ASSIGNMENT_RULES.HR: {
      // Query userAccounts for role === 'HR' or role === 'HR Admin'
      const hrUsers = (userAccounts || []).filter((u) => u.role === 'HR' || u.role === 'HR Admin');
      if (hrUsers.length > 0) {
        const primaryHrUser = hrUsers.find((u) => u.role === 'HR') || hrUsers[0];
        const hrEmp = employeeMap.get(primaryHrUser.employeeId);
        if (hrEmp && hrEmp.status !== 'Former') {
          return {
            assigneeId: hrEmp.id,
            assigneeName: hrEmp.fullName,
            isResolved: true,
            allCandidates: hrUsers.map((u) => {
              const e = employeeMap.get(u.employeeId);
              return { id: u.employeeId, fullName: e ? e.fullName : u.username, role: u.role };
            }).filter((c) => c.id),
          };
        }
      }
      return { assigneeId: null, assigneeName: 'Unassigned (No Active HR)', isResolved: false };
    }

    case ASSIGNMENT_RULES.SPECIFIC_EMPLOYEE: {
      if (specificAssigneeId) {
        const target = employeeMap.get(specificAssigneeId);
        if (target && target.status !== 'Former') {
          return {
            assigneeId: target.id,
            assigneeName: target.fullName,
            isResolved: true,
          };
        }
      }
      return { assigneeId: null, assigneeName: 'Unassigned (Invalid/Former Specific Assignee)', isResolved: false };
    }

    default:
      return { assigneeId: null, assigneeName: 'Unassigned', isResolved: false };
  }
}

/**
 * Generates an in-memory preview of an offboarding plan execution prior to launch.
 */
export function generateOffboardingPlanPreview({
  template,
  planTasks = [],
  employee,
  records = [],
  userAccounts = [],
  allEmployees = [],
  customAnchorDate = null,
  referenceDate = getTodayLocalDateString(),
}) {
  if (!template || !employee) {
    return { isValid: false, error: 'Missing template or target employee.' };
  }

  const anchorDate = resolveOffboardingAnchorDate(employee, records, customAnchorDate, referenceDate);
  if (!anchorDate) {
    return {
      isValid: false,
      error: `Employee ${employee.fullName} does not have a confirmed exit date. Please set a Final Working Date override.`,
    };
  }

  const activeTasks = planTasks
    .filter((t) => t.planTemplateId === template.id && t.active !== false)
    .sort((a, b) => a.sequence - b.sequence);

  if (activeTasks.length === 0) {
    return { isValid: false, error: 'Cannot launch an offboarding plan template with 0 tasks.' };
  }

  const currentRecord = resolveCurrentRecord(employee.id, records, referenceDate);
  const futureRecord = resolveNextRecord(employee.id, records, referenceDate);
  const effectiveRecord = currentRecord || futureRecord;

  let hasUnresolvedRequired = false;
  let unresolvedCount = 0;

  const taskPreviews = activeTasks.map((pt) => {
    const calculatedDueDate = addDaysToLocalDate(anchorDate, pt.relativeOffsetDays || 0);
    const resolution = resolveAssigneeForRule(
      pt.assignmentRule,
      employee,
      effectiveRecord,
      userAccounts,
      allEmployees,
      pt.specificAssigneeId
    );

    if (!resolution.isResolved) {
      unresolvedCount += 1;
      if (pt.required) {
        hasUnresolvedRequired = true;
      }
    }

    return {
      planTaskId: pt.id,
      title: pt.title,
      description: pt.description,
      activityTypeId: pt.activityTypeId,
      assignmentRule: pt.assignmentRule,
      specificAssigneeId: pt.specificAssigneeId,
      resolvedAssigneeId: resolution.assigneeId,
      resolvedAssigneeName: resolution.assigneeName,
      isResolved: resolution.isResolved,
      allCandidates: resolution.allCandidates || [],
      relativeOffsetDays: pt.relativeOffsetDays,
      calculatedDueDate,
      required: pt.required,
      sequence: pt.sequence,
    };
  });

  const requiredCount = taskPreviews.filter((t) => t.required).length;
  if (requiredCount === 0) {
    return { isValid: false, error: 'Offboarding plan template must contain at least 1 required task.' };
  }

  return {
    isValid: !hasUnresolvedRequired,
    anchorDate,
    employee,
    template,
    taskPreviews,
    hasUnresolvedRequired,
    unresolvedCount,
    totalTasks: taskPreviews.length,
    requiredTasksCount: requiredCount,
  };
}

/**
 * Calculates plan execution progress percentage and task metrics based on linked activities.
 * UPDATED — "Required Task" is no longer a configurable, HR-facing concept (the Offboarding
 * Plans scope editor never collects it, and the individual detail page no longer shows a
 * separate "Required Tasks Progress" block) — every launched/added task now counts equally
 * toward completion, mirroring onboardingDomain.js's own identical fix. Legacy scope tasks
 * migrated from the old template model may still carry `required: false` internally (e.g. the
 * old "Post-Exit Payroll & Tax Certificate Settlement" task) — rather than silently excluding
 * those from progress (which previously could leave percentage=100% while status stayed stuck
 * at "In Progress", a real contradiction found via testing), progress/completion is computed
 * against the FULL task set unconditionally. requiredTasksCount/completedRequiredCount are kept
 * as field names for backward shape-compatibility with existing callers, but their values are
 * now always equal to totalTasks/completedTasksCount.
 */
export function calculateOffboardingProgress(taskInstances = [], activities = []) {
  const activityMap = new Map((activities || []).map((a) => [a.id, a]));

  const enrichedTasks = (taskInstances || []).map((ti) => {
    const linkedActivity = activityMap.get(ti.activityId) || null;
    const isCompleted = linkedActivity ? Boolean(linkedActivity.completed) : false;
    const currentAssigneeId = linkedActivity ? linkedActivity.assigneeId : ti.originallyResolvedAssigneeId;
    const currentDueDate = linkedActivity ? linkedActivity.dueDate : ti.originallyCalculatedDueDate;
    const currentTitle = linkedActivity ? linkedActivity.title : ti.title;

    return {
      ...ti,
      linkedActivity,
      isCompleted,
      currentAssigneeId,
      currentDueDate,
      currentTitle,
    };
  });

  const requiredTasks = enrichedTasks;
  const completedRequiredTasks = requiredTasks.filter((t) => t.isCompleted);

  const progressPercentage = requiredTasks.length > 0
    ? Math.round((completedRequiredTasks.length / requiredTasks.length) * 100)
    : (enrichedTasks.length > 0 && enrichedTasks.every((t) => t.isCompleted) ? 100 : 0);

  return {
    totalTasks: enrichedTasks.length,
    requiredTasksCount: requiredTasks.length,
    completedTasksCount: enrichedTasks.filter((t) => t.isCompleted).length,
    completedRequiredCount: completedRequiredTasks.length,
    progressPercentage,
    tasks: enrichedTasks,
  };
}

/**
 * Derives the workflow status for an Offboarding PlanInstance dynamically.
 * Rule: Former + required done = Completed. Former + required incomplete = Needs Attention.
 */
export function deriveOffboardingInstanceStatus(
  planInstance,
  taskInstances = [],
  activities = [],
  employee = null,
  referenceDate = getTodayLocalDateString()
) {
  if (!planInstance) return OFFBOARDING_INSTANCE_STATUS.IN_PROGRESS;

  // Dropped is a permanent terminal state — checked first, ahead of every other rule (including
  // the Former-employee override and the all-required-done Completed check below), so a dropped
  // plan can never be resurrected into Completed/Needs Attention/In Progress by a later change in
  // task completion or the employee's lifecycle status. Mirrors the exact same ordering/reasoning
  // as onboardingDomain.js's derivePlanInstanceStatus(), independently implemented here.
  if (planInstance.droppedAt) {
    return OFFBOARDING_INSTANCE_STATUS.DROPPED;
  }

  const { totalTasks, requiredTasksCount, completedRequiredCount, tasks } = calculateOffboardingProgress(
    taskInstances,
    activities
  );

  if (totalTasks === 0) return OFFBOARDING_INSTANCE_STATUS.IN_PROGRESS;

  const allRequiredDone = requiredTasksCount > 0 && completedRequiredCount === requiredTasksCount;

  if (allRequiredDone) {
    return OFFBOARDING_INSTANCE_STATUS.COMPLETED;
  }

  if (employee && employee.status === 'Former') {
    return OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION;
  }

  // Check if any REQUIRED task is overdue or missing assignee
  const hasNeedsAttention = tasks.some((t) => {
    if (!t.required) return false;
    if (t.isCompleted) return false;
    if (!t.currentAssigneeId) return true;
    if (t.currentDueDate && t.currentDueDate < referenceDate) return true;
    return false;
  });

  if (hasNeedsAttention) {
    return OFFBOARDING_INSTANCE_STATUS.NEEDS_ATTENTION;
  }

  return OFFBOARDING_INSTANCE_STATUS.IN_PROGRESS;
}

/**
 * Pure domain function to calculate whether an offboarding plan instance completedAt timestamp should update.
 * Acyclic module graph - no service imports!
 */
export function reconcileOffboardingPlanInstanceCompletion(planInstance, taskInstances = [], activities = []) {
  if (!planInstance) return { shouldUpdate: false, completedAt: null };

  const { requiredTasksCount, completedRequiredCount } = calculateOffboardingProgress(taskInstances, activities);
  const allRequiredDone = requiredTasksCount > 0 && completedRequiredCount === requiredTasksCount;

  if (allRequiredDone && !planInstance.completedAt) {
    return {
      shouldUpdate: true,
      completedAt: new Date().toISOString(),
      transition: 'COMPLETED',
    };
  }

  if (!allRequiredDone && planInstance.completedAt) {
    return {
      shouldUpdate: true,
      completedAt: null,
      transition: 'REOPENED',
    };
  }

  return { shouldUpdate: false, completedAt: planInstance.completedAt };
}
