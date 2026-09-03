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

  // If multiple matching (e.g. overlapping), sort by effectiveFrom descending
  matchingRecords.sort((a, b) => (b.effectiveFrom || '').localeCompare(a.effectiveFrom || ''));
  return matchingRecords[0];
}

/**
 * Enriches an Employee object with current resolved organizational data
 * (Department, Position, Manager, Location, Schedule) without duplicating identity fields.
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

  const dept = currentRecord ? departments.find((d) => d.id === currentRecord.departmentId) : null;
  const pos = currentRecord ? positions.find((p) => p.id === currentRecord.positionId) : null;
  const loc = currentRecord ? locations.find((l) => l.id === currentRecord.locationId) : null;
  const sched = currentRecord ? schedules.find((s) => s.id === currentRecord.scheduleId) : null;
  const manager = currentRecord && currentRecord.managerId
    ? allEmployees.find((e) => e.id === currentRecord.managerId)
    : null;
  const supervisor = currentRecord && currentRecord.supervisorId
    ? allEmployees.find((e) => e.id === currentRecord.supervisorId)
    : null;

  return {
    ...employee,
    currentEmploymentRecord: currentRecord,
    department: dept || null,
    position: pos || null,
    location: loc || null,
    schedule: sched || null,
    manager: manager ? { id: manager.id, fullName: manager.fullName, workEmail: manager.workEmail } : null,
    supervisor: supervisor ? { id: supervisor.id, fullName: supervisor.fullName, workEmail: supervisor.workEmail } : null,
  };
}

/**
 * Traverses manager relationships up to the top level (CEO).
 *
 * @param {string} employeeId
 * @param {Array<Object>} records
 * @param {Array<Object>} employees
 * @returns {Array<Object>} Ordered array of manager employee objects from direct manager to CEO
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
