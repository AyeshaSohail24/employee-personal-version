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

export const PLAN_INSTANCE_STATUS = {
  IN_PROGRESS: 'In Progress',
  NEEDS_ATTENTION: 'Needs Attention',
  COMPLETED: 'Completed',
};

/**
 * Resolves the full onboarding history population: everyone who currently has, or has ever
 * had, an onboarding plan instance, plus anyone Upcoming/Onboarding without one yet. This
 * backs the Employees page so historical/completed plans remain reachable without a
 * dedicated history tab.
 */
export function resolveAllOnboardingHistory(employees, instanceMap) {
  return employees.filter((emp) => {
    if (emp.status === 'Upcoming' || emp.status === 'Onboarding') return true;
    return instanceMap.has(emp.id);
  });
}

/**
 * Resolves the appropriate anchor start date for an onboarding plan instance.
 * Preserves effective-date rules strictly without weakening resolveCurrentRecord().
 */
export function resolveOnboardingAnchorDate(employee, records = [], referenceDate = getTodayLocalDateString()) {
  if (!employee) return null;

  if (employee.status === 'Upcoming') {
    const nextRec = resolveNextRecord(employee.id, records, referenceDate);
    if (nextRec && nextRec.effectiveFrom) return nextRec.effectiveFrom.slice(0, 10);
  }

  const currentRec = resolveCurrentRecord(employee.id, records, referenceDate);
  if (currentRec && currentRec.effectiveFrom) return currentRec.effectiveFrom.slice(0, 10);

  if (employee.status === 'Former') {
    const histRec = resolveHistoricalRecord(employee.id, records, referenceDate);
    if (histRec && histRec.effectiveFrom) return histRec.effectiveFrom.slice(0, 10);
  }

  if (employee.startDate) return employee.startDate.slice(0, 10);
  return null;
}

/**
 * Resolves assignee Employee ID and details for a given assignment rule.
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
          assigneeName: emp.fullName || 'Onboarding Employee',
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
        // Prefer explicit 'HR' role account first (e.g. Sarah Abdullah user-3), fallback to 'HR Admin'
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
 * Generates an in-memory preview of an onboarding plan execution prior to launch.
 */
export function generatePlanPreview({
  template,
  planTasks = [],
  employee,
  records = [],
  userAccounts = [],
  allEmployees = [],
  referenceDate = getTodayLocalDateString(),
}) {
  if (!template || !employee) {
    return { isValid: false, error: 'Missing template or target employee.' };
  }

  const anchorDate = resolveOnboardingAnchorDate(employee, records, referenceDate);
  if (!anchorDate) {
    return { isValid: false, error: `Employee ${employee.fullName} does not have a valid start date.` };
  }

  const activeTasks = planTasks
    .filter((t) => t.planTemplateId === template.id && t.active !== false)
    .sort((a, b) => a.sequence - b.sequence);

  if (activeTasks.length === 0) {
    return { isValid: false, error: 'Cannot launch a plan template with 0 tasks.' };
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
    return { isValid: false, error: 'Plan template must contain at least 1 required task.' };
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
 * Task order is always the stable, ascending `sequence` field — never storage/insertion order.
 * onboardingService prepends newly-added task instances into db.onboardingTaskInstances (both
 * at plan launch and for manually-added employee-specific tasks), so relying on array order
 * here would surface new tasks above earlier ones despite their higher sequence number.
 */
export function calculatePlanProgress(taskInstances = [], activities = []) {
  const activityMap = new Map((activities || []).map((a) => [a.id, a]));
  const orderedTaskInstances = [...(taskInstances || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const enrichedTasks = orderedTaskInstances.map((ti) => {
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

  const requiredTasks = enrichedTasks.filter((t) => t.required);
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
 * Derives the workflow status for a PlanInstance dynamically.
 * Zero stored status drift!
 */
export function derivePlanInstanceStatus(
  planInstance,
  taskInstances = [],
  activities = [],
  employee = null,
  referenceDate = getTodayLocalDateString()
) {
  if (!planInstance) return PLAN_INSTANCE_STATUS.IN_PROGRESS;

  if (employee && employee.status === 'Former') {
    return PLAN_INSTANCE_STATUS.NEEDS_ATTENTION;
  }

  const { totalTasks, requiredTasksCount, completedRequiredCount, tasks } = calculatePlanProgress(
    taskInstances,
    activities
  );

  if (totalTasks === 0) return PLAN_INSTANCE_STATUS.IN_PROGRESS;

  if (requiredTasksCount > 0 && completedRequiredCount === requiredTasksCount) {
    return PLAN_INSTANCE_STATUS.COMPLETED;
  }

  // Check if any REQUIRED task is overdue or has broken assignment
  const hasNeedsAttention = tasks.some((t) => {
    if (!t.required) return false;
    if (t.isCompleted) return false;
    if (!t.currentAssigneeId) return true;
    if (t.currentDueDate && t.currentDueDate < referenceDate) return true;
    return false;
  });

  if (hasNeedsAttention) {
    return PLAN_INSTANCE_STATUS.NEEDS_ATTENTION;
  }

  return PLAN_INSTANCE_STATUS.IN_PROGRESS;
}

/**
 * Pure domain function to calculate whether a plan instance completedAt timestamp should update.
 * Acyclic module graph - no service imports!
 */
export function reconcilePlanInstanceCompletion(planInstance, taskInstances = [], activities = []) {
  if (!planInstance) return { shouldUpdate: false, completedAt: null };

  const { requiredTasksCount, completedRequiredCount } = calculatePlanProgress(taskInstances, activities);

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
