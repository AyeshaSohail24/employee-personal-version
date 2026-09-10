/**
 * Normalizes detailed EmployeeType master data into the simplified, directory-facing
 * classification used by the Employees Directory Type column/filter.
 *
 * Detailed employment types (Full-Time Permanent, Fixed-Term Contract, Part-Time, Executive, etc.)
 * remain intact as canonical master data — this mapping only derives a coarse view for the directory.
 *
 * @param {Object|null} employeeType - Hydrated EmployeeType reference record (or null)
 * @returns {'Employee'|'Intern'} Normalized directory-level workforce classification
 */
export function normalizeDirectoryType(employeeType) {
  if (!employeeType) return 'Employee';
  const code = (employeeType.code || '').toUpperCase();
  const name = (employeeType.name || '').toLowerCase();
  if (code === 'INTERN' || name.includes('intern') || name.includes('apprentice')) {
    return 'Intern';
  }
  return 'Employee';
}

/**
 * Reverse mapping of normalizeDirectoryType(): resolves which canonical detailed
 * EmployeeType a new record should be assigned given only the simplified directory
 * Type ('Employee' | 'Intern') chosen at creation time. Single centralized source
 * for this mapping so it is never duplicated/scattered across UI or service code.
 *
 * - 'Intern' resolves to the active detailed type that itself normalizes to 'Intern'
 *   (canonically the seeded "Intern / Apprentice" type).
 * - 'Employee' resolves to the safest existing baseline — the canonical Full-Time
 *   Permanent type ('type-1') when active — falling back to the first active
 *   non-Intern detailed type if that baseline is unavailable.
 *
 * @param {'Employee'|'Intern'} directoryType
 * @param {Array<Object>} employeeTypes - Detailed EmployeeType master data
 * @returns {string|null} employeeTypeId to assign, or null if no suitable active type exists
 */
export function resolveEmployeeTypeIdForDirectoryType(directoryType, employeeTypes = []) {
  const activeTypes = employeeTypes.filter((t) => t.active !== false);

  if (directoryType === 'Intern') {
    const internType = activeTypes.find((t) => normalizeDirectoryType(t) === 'Intern');
    return internType ? internType.id : null;
  }

  const fteBaseline = activeTypes.find((t) => t.id === 'type-1');
  if (fteBaseline) return fteBaseline.id;

  const firstNonIntern = activeTypes.find((t) => normalizeDirectoryType(t) !== 'Intern');
  if (firstNonIntern) return firstNonIntern.id;

  return activeTypes.length > 0 ? activeTypes[0].id : null;
}

/**
 * Computes safe, collision-proof next employee identifiers by scanning the maximum
 * existing numeric suffix of each ID scheme (never a fragile `count + 1`, which would
 * collide after a deletion). The two sequences are tracked independently so a gap in
 * one never corrupts the other.
 *
 * @param {Array<Object>} existingEmployees
 * @returns {{ id: string, employeeId: string }} Next safe 'emp-XXX' internal ID and 'RZ-XXXX' employee code
 */
export function generateNextEmployeeIdentifiers(existingEmployees = []) {
  let maxIdNum = 0;
  let maxCodeNum = 1000; // Seed employee codes begin at RZ-1001

  existingEmployees.forEach((emp) => {
    const idMatch = /^emp-(\d+)$/.exec(emp.id || '');
    if (idMatch) maxIdNum = Math.max(maxIdNum, parseInt(idMatch[1], 10));

    const codeMatch = /^RZ-(\d+)$/.exec(emp.employeeId || '');
    if (codeMatch) maxCodeNum = Math.max(maxCodeNum, parseInt(codeMatch[1], 10));
  });

  return {
    id: `emp-${String(maxIdNum + 1).padStart(3, '0')}`,
    employeeId: `RZ-${maxCodeNum + 1}`,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_DIRECTORY_TYPES = ['Employee', 'Intern'];
const VALID_WORK_MODES = ['On-site', 'Remote', 'Hybrid'];
const VALID_ALLOWANCES = ['Paid', 'Unpaid'];
const VALID_LIFECYCLE_STATUSES = ['Upcoming', 'Onboarding', 'Active', 'Departing', 'Former'];

/**
 * Validates a new Employee Directory creation payload.
 * Mirrors the { isValid, errors } shape used by validateActivity() in activityDomain.js
 * so it can be reused identically for immediate client-side UX feedback (Create Employee
 * modal) and as a defense-in-depth server-side check (employeeService.createDirectoryEmployee).
 *
 * @param {Object} data - Candidate employee payload (firstName, lastName, workEmail, departmentId,
 *   directoryType, startDate, contractEndDate, allowance, workMode, status, ...)
 * @param {Array<Object>} existingEmployees - Current raw employee records, for email uniqueness
 * @returns {{ isValid: boolean, errors: Object }}
 */
export function validateEmployeeCreation(data = {}, existingEmployees = []) {
  const errors = {};

  if (!data.firstName || !data.firstName.trim()) errors.firstName = 'First Name is required';
  if (!data.lastName || !data.lastName.trim()) errors.lastName = 'Last Name is required';

  if (!data.workEmail || !data.workEmail.trim()) {
    errors.workEmail = 'Email is required';
  } else if (!EMAIL_PATTERN.test(data.workEmail.trim())) {
    errors.workEmail = 'Enter a valid email address';
  } else {
    const normalized = data.workEmail.trim().toLowerCase();
    const isDuplicate = existingEmployees.some((e) => (e.workEmail || '').toLowerCase() === normalized);
    if (isDuplicate) errors.workEmail = 'An employee with this email already exists';
  }

  if (!data.departmentId) errors.departmentId = 'Department is required';

  if (!data.directoryType || !VALID_DIRECTORY_TYPES.includes(data.directoryType)) {
    errors.directoryType = 'Type is required';
  }

  if (!data.startDate) {
    errors.startDate = 'Start Date is required';
  }

  if (data.contractEndDate && data.startDate && data.contractEndDate < data.startDate) {
    errors.contractEndDate = 'End Date cannot be earlier than Start Date';
  }

  if (!data.allowance || !VALID_ALLOWANCES.includes(data.allowance)) {
    errors.allowance = 'Salary (Paid/Unpaid) is required';
  }

  if (!data.workMode || !VALID_WORK_MODES.includes(data.workMode)) {
    errors.workMode = 'Work Mode is required';
  }

  if (!data.status || !VALID_LIFECYCLE_STATUSES.includes(data.status)) {
    errors.status = 'Status is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Compares two employee display IDs (e.g. 'RZ-1017') by their meaningful numeric portion
 * rather than unsafe raw lexicographic string comparison (which would incorrectly order
 * 'RZ-1010' before 'RZ-1002' if a prefix length or digit count ever varied). Never mutates
 * or generates IDs — sorting only. Centralized here so Sort By 'ID' options are computed
 * once, in the query layer, rather than duplicated in JSX table code.
 *
 * @param {string} idA
 * @param {string} idB
 * @returns {number} Negative if idA < idB numerically, positive if idA > idB, 0 if equal
 */
export function compareEmployeeIdNumeric(idA, idB) {
  const numA = parseInt((idA || '').replace(/\D/g, ''), 10);
  const numB = parseInt((idB || '').replace(/\D/g, ''), 10);
  const safeA = Number.isNaN(numA) ? 0 : numA;
  const safeB = Number.isNaN(numB) ? 0 : numB;
  return safeA - safeB;
}

/**
 * Resolves the active EmploymentRecord for an employee on a given reference date.
 * Effective-date aware:
 * - Must satisfy: effectiveFrom <= referenceDate AND (effectiveTo === null OR effectiveTo >= referenceDate)
 * - Will NOT treat a future-dated record as current merely because effectiveTo is null.
 * - Closed records (effectiveTo < referenceDate) for former employees will not resolve as active.
 *
 * @param {string} employeeId - ID of the employee
 * @param {Array<Object>} records - List of all employment records
 * @param {string|Date} [referenceDate] - Date to evaluate against (defaults to today)
 * @returns {Object|null} The active EmploymentRecord on referenceDate or null
 */
export function resolveCurrentRecord(employeeId, records = [], referenceDate = new Date()) {
  if (!employeeId || !Array.isArray(records)) return null;

  const refIso = typeof referenceDate === 'string'
    ? referenceDate.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);

  const matchingRecords = records.filter((rec) => {
    if (rec.employeeId !== employeeId) return false;

    const fromDate = rec.effectiveFrom ? rec.effectiveFrom.slice(0, 10) : '1970-01-01';
    const toDate = rec.effectiveTo ? rec.effectiveTo.slice(0, 10) : null;

    const startsBeforeOrOnRef = fromDate <= refIso;
    const endsAfterOrOnRef = toDate === null || toDate >= refIso;

    return startsBeforeOrOnRef && endsAfterOrOnRef;
  });

  if (matchingRecords.length === 0) return null;

  matchingRecords.sort((a, b) => (b.effectiveFrom || '').localeCompare(a.effectiveFrom || ''));
  return matchingRecords[0];
}

/**
 * Resolves the next scheduled future EmploymentRecord for an employee starting after reference date.
 * Used explicitly for Upcoming hires whose contract has not yet started.
 *
 * @param {string} employeeId
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {Object|null} The next scheduled EmploymentRecord or null
 */
export function resolveNextRecord(employeeId, records = [], referenceDate = new Date()) {
  if (!employeeId || !Array.isArray(records)) return null;

  const refIso = typeof referenceDate === 'string'
    ? referenceDate.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);

  const futureRecords = records.filter((rec) => {
    if (rec.employeeId !== employeeId) return false;
    const fromDate = rec.effectiveFrom ? rec.effectiveFrom.slice(0, 10) : '';
    return fromDate > refIso;
  });

  if (futureRecords.length === 0) return null;

  futureRecords.sort((a, b) => (a.effectiveFrom || '').localeCompare(b.effectiveFrom || ''));
  return futureRecords[0];
}

/**
 * Resolves the most recent closed historical EmploymentRecord for a Former employee.
 * Used explicitly to display historical position, department, location, manager for Former employees
 * without treating them as currently employed.
 *
 * @param {string} employeeId
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {Object|null} The latest historical closed EmploymentRecord or null
 */
export function resolveHistoricalRecord(employeeId, records = [], referenceDate = new Date()) {
  if (!employeeId || !Array.isArray(records)) return null;

  const refIso = typeof referenceDate === 'string'
    ? referenceDate.slice(0, 10)
    : referenceDate.toISOString().slice(0, 10);

  const closedRecords = records.filter((rec) => {
    if (rec.employeeId !== employeeId) return false;
    const toDate = rec.effectiveTo ? rec.effectiveTo.slice(0, 10) : null;
    return toDate !== null && toDate <= refIso;
  });

  if (closedRecords.length === 0) return null;

  closedRecords.sort((a, b) => (b.effectiveTo || '').localeCompare(a.effectiveTo || ''));
  return closedRecords[0];
}

/**
 * Returns array of currently assigned employees participating in current organizational structure
 * (Active, Onboarding, and Departing employees with valid current EmploymentRecord on referenceDate).
 * Strictly excludes Former employees and not-yet-started Upcoming employees.
 *
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {Array<Object>} Filtered list of currently assigned employee objects with active record
 */
export function getCurrentWorkforce(employees = [], records = [], referenceDate = new Date()) {
  if (!Array.isArray(employees) || !Array.isArray(records)) return [];

  return employees.filter((emp) => {
    if (emp.status !== 'Active' && emp.status !== 'Onboarding' && emp.status !== 'Departing') {
      return false;
    }
    const currentRec = resolveCurrentRecord(emp.id, records, referenceDate);
    return currentRec !== null;
  });
}

/**
 * Calculates current headcount for a department based on active workforce assignments.
 *
 * @param {string} departmentId
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {number} Current headcount
 */
export function calculateDepartmentHeadcount(departmentId, employees = [], records = [], referenceDate = new Date()) {
  const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);
  return currentWorkforce.filter((emp) => {
    const activeRec = resolveCurrentRecord(emp.id, records, referenceDate);
    return activeRec && activeRec.departmentId === departmentId;
  }).length;
}

/**
 * Calculates current active occupants count for a job position.
 *
 * @param {string} positionId
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {number} Current occupants count
 */
export function calculatePositionOccupants(positionId, employees = [], records = [], referenceDate = new Date()) {
  const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);
  return currentWorkforce.filter((emp) => {
    const activeRec = resolveCurrentRecord(emp.id, records, referenceDate);
    return activeRec && activeRec.positionId === positionId;
  }).length;
}

/**
 * Calculates current assigned employee count for a work location.
 *
 * @param {string} locationId
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {number} Current location workforce count
 */
export function calculateLocationWorkforce(locationId, employees = [], records = [], referenceDate = new Date()) {
  const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);
  return currentWorkforce.filter((emp) => {
    const activeRec = resolveCurrentRecord(emp.id, records, referenceDate);
    return activeRec && activeRec.locationId === locationId;
  }).length;
}

/**
 * Calculates upcoming scheduled hires for a position starting in the future.
 *
 * @param {string} positionId
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {string|Date} [referenceDate]
 * @returns {number} Upcoming scheduled hires count
 */
export function calculateUpcomingPositionHires(positionId, employees = [], records = [], referenceDate = new Date()) {
  const upcomingEmployees = employees.filter((e) => e.status === 'Upcoming');
  return upcomingEmployees.filter((emp) => {
    const nextRec = resolveNextRecord(emp.id, records, referenceDate);
    return nextRec && nextRec.positionId === positionId;
  }).length;
}

/**
 * Enriches an Employee object with resolved organizational data.
 *
 * @param {Object} employee - Pure Employee record
 * @param {Array<Object>} records - Employment records
 * @param {Array<Object>} departments
 * @param {Array<Object>} positions
 * @param {Array<Object>} locations
 * @param {Array<Object>} schedules
 * @param {Array<Object>} allEmployees - To lookup manager names
 * @param {string|Date} [referenceDate]
 * @returns {Object} Hydrated employee view model
 */
export function resolveHydratedEmployee(
  employee,
  records = [],
  departments = [],
  positions = [],
  locations = [],
  schedules = [],
  allEmployees = [],
  employeeTypes = [],
  employeeTags = [],
  referenceDate = new Date()
) {
  if (!employee) return null;

  const currentRecord = resolveCurrentRecord(employee.id, records, referenceDate);
  // Onboarding employees can be created ahead of their official Start Date (a future-dated
  // EmploymentRecord), just like Upcoming hires — fall back to their next scheduled record
  // in both cases so Department/Position/etc. resolve instead of showing "Unassigned".
  const futureRecord = !currentRecord && (employee.status === 'Upcoming' || employee.status === 'Onboarding')
    ? resolveNextRecord(employee.id, records, referenceDate)
    : null;
  const historicalRecord = !currentRecord && employee.status === 'Former'
    ? resolveHistoricalRecord(employee.id, records, referenceDate)
    : null;

  const effectiveRecord = currentRecord || futureRecord || historicalRecord;

  const dept = effectiveRecord ? departments.find((d) => d.id === effectiveRecord.departmentId) : null;
  const pos = effectiveRecord ? positions.find((p) => p.id === effectiveRecord.positionId) : null;
  const loc = effectiveRecord ? locations.find((l) => l.id === effectiveRecord.locationId) : null;
  const sched = effectiveRecord ? schedules.find((s) => s.id === effectiveRecord.scheduleId) : null;
  const manager = effectiveRecord && effectiveRecord.managerId
    ? allEmployees.find((e) => e.id === effectiveRecord.managerId)
    : null;
  const supervisor = effectiveRecord && effectiveRecord.supervisorId
    ? allEmployees.find((e) => e.id === effectiveRecord.supervisorId)
    : null;

  const empType = Array.isArray(employeeTypes) && employeeTypes.length > 0
    ? employeeTypes.find((t) => t.id === employee.employeeTypeId) || null
    : null;

  const resolvedTags = Array.isArray(employee.tags) && Array.isArray(employeeTags) && employeeTags.length > 0
    ? employee.tags.map((tagId) => employeeTags.find((t) => t.id === tagId)).filter(Boolean)
    : [];

  return {
    ...employee,
    currentEmploymentRecord: currentRecord,       // Null for Former & Upcoming before start!
    futureEmploymentRecord: futureRecord,         // Populated explicitly for Upcoming!
    historicalEmploymentRecord: historicalRecord, // Populated explicitly for Former!
    effectiveEmploymentRecord: effectiveRecord,   // Record used for directory display representation
    department: dept || null,
    position: pos || null,
    location: loc || null,
    schedule: sched || null,
    employeeType: empType || null,
    directoryType: normalizeDirectoryType(empType),
    resolvedTags,
    workMode: employee.workMode || (loc?.type === 'Remote' ? 'Remote' : 'On-site'),
    allowance: employee.allowance || 'Paid',
    manager: manager ? { id: manager.id, fullName: manager.fullName, workEmail: manager.workEmail } : null,
    supervisor: supervisor ? { id: supervisor.id, fullName: supervisor.fullName, workEmail: supervisor.workEmail } : null,
  };
}

/**
 * Builds employee reporting tree structure rooted at top-level managers (managerId === null).
 * Forest-capable (handles single CEO root or multiple independent roots dynamically).
 * Includes cycle detection and self-manager protection to prevent infinite recursion.
 *
 * @param {Array<Object>} employees
 * @param {Array<Object>} records
 * @param {Array<Object>} departments
 * @param {Array<Object>} positions
 * @param {Array<Object>} locations
 * @param {Array<Object>} schedules
 * @param {string|Date} [referenceDate]
 * @returns {Array<Object>} Roots collection array containing tree nodes
 */
export function buildOrgChartTree(
  employees = [],
  records = [],
  departments = [],
  positions = [],
  locations = [],
  schedules = [],
  referenceDate = new Date()
) {
  const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);
  const hydratedWorkforce = currentWorkforce.map((emp) =>
    resolveHydratedEmployee(emp, records, departments, positions, locations, schedules, employees, referenceDate)
  );

  const activeIds = new Set(hydratedWorkforce.map((e) => e.id));

  // Identify root employees (managerId is null OR managerId is not in active workforce OR points to self)
  const roots = hydratedWorkforce.filter((emp) => {
    const mgrId = emp.currentEmploymentRecord?.managerId;
    return !mgrId || mgrId === emp.id || !activeIds.has(mgrId);
  });

  const buildNode = (emp, visited = new Set()) => {
    if (visited.has(emp.id)) {
      console.warn(`OrgChart cycle detected for employee ${emp.id}`);
      return null;
    }
    const newVisited = new Set(visited).add(emp.id);

    const directReports = hydratedWorkforce
      .filter((child) => child.id !== emp.id && child.currentEmploymentRecord?.managerId === emp.id)
      .map((child) => buildNode(child, newVisited))
      .filter(Boolean);

    return {
      employee: emp,
      directReports,
      totalReportCount: directReports.reduce((sum, r) => sum + 1 + r.totalReportCount, 0),
    };
  };

  return roots.map((root) => buildNode(root)).filter(Boolean);
}

/**
 * Traverses manager relationships up to top level (CEO).
 *
 * @param {string} employeeId
 * @param {Array<Object>} records
 * @param {Array<Object>} employees
 * @returns {Array<Object>} Ordered array of manager employee objects
 */
export function resolveManagerChain(employeeId, records = [], employees = []) {
  const chain = [];
  let currentId = employeeId;
  const visited = new Set();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const activeRec = resolveCurrentRecord(currentId, records);
    if (!activeRec || !activeRec.managerId) break;

    const manager = employees.find((e) => e.id === activeRec.managerId);
    if (manager) {
      chain.push({
        id: manager.id,
        fullName: manager.fullName,
        workEmail: manager.workEmail,
      });
      currentId = manager.id;
    } else {
      break;
    }
  }

  return chain;
}
