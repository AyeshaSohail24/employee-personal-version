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
};

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

  // Check one active plan policy
  const activePlan = existingInstances.find(
    (inst) => inst.employeeId === employee.id && !inst.completedAt
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
 * Plan completion policy: completion is based on ALL REQUIRED tasks being completed.
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
