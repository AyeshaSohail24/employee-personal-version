import { resolveCurrentRecord, getCurrentWorkforce } from './employmentDomain.js';
import { resolveDueState, ACTIVITY_DUE_STATES } from './activityDomain.js';

/**
 * Pure domain logic for Stage 10 Reporting & HR Analytics.
 * Strict Rule: 100% pure functions. No React, no localStorage, no mock-data imports, no service calls.
 */

/**
 * Standardizes and enriches a hydrated employee object with explicit reporting fields:
 * departmentName, positionTitle, locationName, workMode, startDate, finalWorkingDate.
 *
 * @param {Object} emp - Hydrated employee object from resolveHydratedEmployee
 * @returns {Object} Enriched reporting employee model
 */
export function enrichReportingEmployee(emp, offboardingInstances = []) {
  if (!emp) return null;

  const deptName = emp.department?.name || '—';
  const posTitle = emp.position?.name || emp.position?.title || '—';
  const locName = emp.location?.name || '—';
  const rec =
    emp.effectiveEmploymentRecord ||
    emp.currentEmploymentRecord ||
    emp.futureEmploymentRecord ||
    emp.historicalEmploymentRecord;

  // Strict Rule: Never default missing Work Mode to 'On-site'. Must display '—' if missing.
  const workMode = rec?.workMode || '—';
  const startDate = emp.startDate || '—';

  // Final working date precedence:
  // 1. Canonical EmploymentRecord.effectiveTo
  // 2. Canonical Employee.contractEndDate
  // 3. Offboarding PlanInstance anchor date (if launched plan instance exists for employee)
  let offboardingPlanAnchor = null;
  if (Array.isArray(offboardingInstances) && offboardingInstances.length > 0) {
    const activePlan = offboardingInstances.find(
      (inst) => inst.employeeId === emp.id && (inst.derivedStatus === 'In Progress' || inst.derivedStatus === 'Needs Attention' || inst.derivedStatus === 'Completed')
    );
    if (activePlan) {
      offboardingPlanAnchor = activePlan.customAnchorDate || activePlan.anchorDate || null;
    }
  }

  const finalWorkingDate = rec?.effectiveTo || emp.contractEndDate || offboardingPlanAnchor || '—';

  return {
    ...emp,
    departmentName: deptName,
    positionTitle: posTitle,
    locationName: locName,
    workMode,
    startDate,
    finalWorkingDate,
  };
}

export function enrichReportingEmployeeList(employees = [], offboardingInstances = []) {
  if (!Array.isArray(employees)) return [];
  return employees.map((e) => enrichReportingEmployee(e, offboardingInstances));
}


/**
 * Filters employee dataset to direct reports managed canonically via EmploymentRecord.managerId.
 * Includes the manager themselves for context.
 *
 * @param {Array<Object>} employees - List of employee objects
 * @param {Array<Object>} records - List of EmploymentRecords
 * @param {string} managerEmployeeId - ID of the manager employee
 * @param {string|Date} [referenceDate] - Date to evaluate active manager relationship
 * @returns {Array<Object>} Scoped list of employees
 */
export function applyCanonicalManagerScoping(
  employees = [],
  records = [],
  managerEmployeeId = '',
  referenceDate = new Date()
) {
  if (!managerEmployeeId || !Array.isArray(employees)) return [];

  // Find all employee IDs where active EmploymentRecord has managerId === managerEmployeeId
  const directReportIds = new Set();
  directReportIds.add(managerEmployeeId); // Include manager's self record

  records.forEach((rec) => {
    if (rec.managerId === managerEmployeeId) {
      // Check if record is currently active
      const activeRec = resolveCurrentRecord(rec.employeeId, records, referenceDate);
      if (activeRec && activeRec.id === rec.id) {
        directReportIds.add(rec.employeeId);
      }
    }
  });

  return employees.filter((emp) => directReportIds.has(emp.id));
}

/**
 * Calculates high-level workforce metrics dynamically from canonical datasets.
 * Explicitly separates Current Headcount, Upcoming Pipeline, and Former Employees.
 *
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {Object} Workforce summary counts
 */
export function calculateWorkforceMetrics(employees = [], records = [], referenceDate = new Date()) {
  const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);

  const activeCount = currentWorkforce.filter((e) => e.status === 'Active').length;
  const onboardingCount = currentWorkforce.filter((e) => e.status === 'Onboarding').length;
  const departingCount = currentWorkforce.filter((e) => e.status === 'Departing').length;

  const totalHeadcount = currentWorkforce.length;

  const upcomingCount = employees.filter((e) => e.status === 'Upcoming').length;
  const formerCount = employees.filter((e) => e.status === 'Former').length;

  return {
    totalHeadcount, // 15 for baseline seed
    activeCount, // 11
    onboardingCount, // 2
    departingCount, // 2
    upcomingCount, // 1 (Pipeline only, strictly excluded from Headcount)
    formerCount, // 2 (Historical exit, strictly excluded from Headcount)
    newJoinersPipelineCount: onboardingCount + upcomingCount, // 3
  };
}

/**
 * Calculates headcount breakdowns by department, work location, work mode, and employee type.
 *
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {Array<Object>} departments
 * @param {Array<Object>} locations
 * @param {Array<Object>} positions
 * @param {string|Date} [referenceDate]
 * @returns {Object} Detailed composition breakdowns
 */
export function calculateHeadcountBreakdowns(
  employees = [],
  records = [],
  departments = [],
  locations = [],
  positions = [],
  referenceDate = new Date()
) {
  const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);
  const total = currentWorkforce.length;

  // 1. Department Breakdown
  const deptCountsMap = new Map();
  departments.forEach((d) => deptCountsMap.set(d.id, { id: d.id, name: d.name, code: d.code, count: 0 }));

  // 2. Location Breakdown
  const locCountsMap = new Map();
  locations.forEach((l) => locCountsMap.set(l.id, { id: l.id, name: l.name, city: l.city, count: 0 }));

  // 3. Work Mode Breakdown
  const modeCountsMap = new Map([
    ['On-site', 0],
    ['Hybrid', 0],
    ['Remote', 0],
  ]);

  // 4. Employee Type Breakdown
  const typeCountsMap = new Map();

  currentWorkforce.forEach((emp) => {
    const activeRec = resolveCurrentRecord(emp.id, records, referenceDate);
    if (!activeRec) return;

    if (activeRec.departmentId && deptCountsMap.has(activeRec.departmentId)) {
      deptCountsMap.get(activeRec.departmentId).count += 1;
    }

    if (activeRec.locationId && locCountsMap.has(activeRec.locationId)) {
      locCountsMap.get(activeRec.locationId).count += 1;
    }

    const mode = activeRec.workMode || 'On-site';
    modeCountsMap.set(mode, (modeCountsMap.get(mode) || 0) + 1);

    const empType = activeRec.employmentType || emp.employeeType || 'Full-time Regular';
    typeCountsMap.set(empType, (typeCountsMap.get(empType) || 0) + 1);
  });

  const byDepartment = Array.from(deptCountsMap.values()).map((d) => ({
    ...d,
    percentage: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }));

  const byLocation = Array.from(locCountsMap.values()).map((l) => ({
    ...l,
    percentage: total > 0 ? Math.round((l.count / total) * 100) : 0,
  }));

  const byWorkMode = Array.from(modeCountsMap.entries()).map(([mode, count]) => ({
    mode,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  const byType = Array.from(typeCountsMap.entries()).map(([type, count]) => ({
    type,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  return {
    totalHeadcount: total,
    byDepartment,
    byLocation,
    byWorkMode,
    byType,
  };
}

/**
 * Derives presence analytics from Stage 6 presence overview dataset.
 *
 * @param {Object} presenceOverview - Result from presenceService.getPresenceOverview()
 * @returns {Object} Calculated presence analytics
 */
export function calculatePresenceAnalytics(presenceOverview = {}) {
  const summary = presenceOverview.summary || {};
  const employees = presenceOverview.employees || [];
  const total = summary.totalWorkforce || employees.length || 0;
  const presentCount = summary.presentCount || 0;
  const remoteCount = summary.remoteCount || 0;
  const leaveCount = summary.leaveCount || 0;
  const absentCount = summary.absentCount || 0;
  const notScheduledCount = summary.notScheduledCount || 0;
  const unknownCount = summary.unknownCount || 0;

  const activePresent = presentCount + remoteCount;
  const presenceHealthRate = total > 0 ? Math.round((activePresent / total) * 100) : 0;

  return {
    totalWorkforce: total,
    presentCount,
    remoteCount,
    leaveCount,
    absentCount,
    notScheduledCount,
    unknownCount,
    activePresent,
    presenceHealthRate,
  };
}

/**
 * Aggregates Activity workload metrics using Stage 7 activity domain rules.
 *
 * @param {Array<Object>} activities - Enriched activity objects
 * @param {string|Date} [referenceDate] - Date for due state resolution
 * @returns {Object} Activity metrics
 */
export function calculateActivityAnalytics(activities = [], referenceDate = new Date()) {
  let openCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let upcomingCount = 0;
  let completedCount = 0;
  let unassignedCount = 0;

  const sourceCounts = {
    Manual: 0,
    Onboarding: 0,
    Offboarding: 0,
  };

  const assigneeWorkloadMap = new Map();

  activities.forEach((act) => {
    if (act.completedAt) {
      completedCount += 1;
    } else {
      openCount += 1;

      const dueState = resolveDueState(act.dueDate, false, referenceDate);
      if (dueState === ACTIVITY_DUE_STATES.OVERDUE) overdueCount += 1;
      else if (dueState === ACTIVITY_DUE_STATES.DUE_TODAY) dueTodayCount += 1;
      else if (dueState === ACTIVITY_DUE_STATES.UPCOMING) upcomingCount += 1;

      if (!act.assigneeId || act.assigneeId === 'unassigned') {
        unassignedCount += 1;
      } else {
        const assigneeName = act.assigneeEmployee?.fullName || act.assigneeId;
        const current = assigneeWorkloadMap.get(act.assigneeId) || {
          id: act.assigneeId,
          name: assigneeName,
          openCount: 0,
          overdueCount: 0,
        };
        current.openCount += 1;
        if (dueState === ACTIVITY_DUE_STATES.OVERDUE) current.overdueCount += 1;
        assigneeWorkloadMap.set(act.assigneeId, current);
      }
    }

    const src = act.source || 'Manual';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const total = activities.length || 1;
  const overdueRatio = Math.round((overdueCount / total) * 100);

  return {
    totalActivities: activities.length,
    openCount,
    overdueCount,
    dueTodayCount,
    upcomingCount,
    completedCount,
    unassignedCount,
    overdueRatio,
    sourceCounts,
    assigneeWorkloads: Array.from(assigneeWorkloadMap.values()).sort((a, b) => b.openCount - a.openCount),
  };
}

/**
 * Aggregates Onboarding analytics from Stage 8 plan instances.
 *
 * @param {Array<Object>} instances - Enriched onboarding plan instances
 * @param {Array<Object>} templates - Plan templates
 * @param {Array<Object>} employees - All employees
 * @returns {Object} Onboarding analytics
 */
export function calculateOnboardingAnalytics(instances = [], templates = [], employees = []) {
  const totalInstances = instances.length;
  const inProgressCount = instances.filter((i) => i.derivedStatus === 'In Progress').length;
  const needsAttentionCount = instances.filter((i) => i.derivedStatus === 'Needs Attention').length;
  const completedCount = instances.filter((i) => i.derivedStatus === 'Completed').length;
  const activePlansCount = inProgressCount + needsAttentionCount;

  const newJoiners = employees.filter((e) => e.status === 'Onboarding' || e.status === 'Upcoming');

  return {
    totalInstances,
    activePlansCount,
    inProgressCount,
    needsAttentionCount,
    completedCount,
    newJoinersCount: newJoiners.length,
    onboardingEmployeesCount: employees.filter((e) => e.status === 'Onboarding').length,
    upcomingHiresCount: employees.filter((e) => e.status === 'Upcoming').length,
  };
}

/**
 * Aggregates Offboarding analytics from Stage 9 plan instances.
 *
 * @param {Array<Object>} instances - Enriched offboarding plan instances
 * @param {Array<Object>} templates - Offboarding plan templates
 * @param {Array<Object>} employees - All employees
 * @returns {Object} Offboarding analytics
 */
export function calculateOffboardingAnalytics(instances = [], templates = [], employees = []) {
  const totalInstances = instances.length;
  const inProgressCount = instances.filter((i) => i.derivedStatus === 'In Progress').length;
  const needsAttentionCount = instances.filter((i) => i.derivedStatus === 'Needs Attention').length;
  const completedCount = instances.filter((i) => i.derivedStatus === 'Completed').length;
  const activePlansCount = inProgressCount + needsAttentionCount;

  const departingEmployees = employees.filter((e) => e.status === 'Departing');

  return {
    totalInstances,
    activePlansCount,
    inProgressCount,
    needsAttentionCount,
    completedCount,
    departingCount: departingEmployees.length,
  };
}

/**
 * Filters a generic dataset by department, search term, work mode, or status.
 *
 * @param {Array<Object>} list
 * @param {Object} filters { search, departmentId, workModeFilter, statusFilter }
 * @returns {Array<Object>}
 */
export function filterReportDataset(list = [], filters = {}) {
  const { search = '', departmentId = '', workModeFilter = 'All', statusFilter = 'All' } = filters;

  return list.filter((item) => {
    if (departmentId && item.departmentId && item.departmentId !== departmentId) {
      return false;
    }
    if (workModeFilter !== 'All' && item.workMode && item.workMode !== workModeFilter) {
      return false;
    }
    if (statusFilter !== 'All' && item.status && item.status !== statusFilter) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = item.fullName ? item.fullName.toLowerCase().includes(q) : false;
      const codeMatch = item.employeeId ? item.employeeId.toLowerCase().includes(q) : false;
      const titleMatch = item.title ? item.title.toLowerCase().includes(q) : false;
      if (!nameMatch && !codeMatch && !titleMatch) return false;
    }
    return true;
  });
}
