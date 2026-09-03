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
 * Enriches an Employee object with resolved organizational data
 * (Department, Position, Manager, Location, Schedule) without duplicating identity fields.
 * Explicitly separates:
 * - currentEmploymentRecord (active today)
 * - futureEmploymentRecord (scheduled for Upcoming)
 * - historicalEmploymentRecord (latest closed record for Former)
 * - effectiveEmploymentRecord (points to record used for display representation)
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
  referenceDate = new Date()
) {
  if (!employee) return null;

  const currentRecord = resolveCurrentRecord(employee.id, records, referenceDate);
  const futureRecord = !currentRecord && employee.status === 'Upcoming'
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
    manager: manager ? { id: manager.id, fullName: manager.fullName, workEmail: manager.workEmail } : null,
    supervisor: supervisor ? { id: supervisor.id, fullName: supervisor.fullName, workEmail: supervisor.workEmail } : null,
  };
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
