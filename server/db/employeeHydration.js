// Server-side equivalent of src/domain/employmentDomain.js's resolveHydratedEmployee()
// — the frontend expects employees pre-joined with their current department/
// position/location/schedule/manager, in camelCase, nested. Reshaping happens
// here so employeeService.js on the frontend can stay a thin fetch wrapper
// and every page/domain function downstream of it needs no changes at all.
import { pool } from "./pool.js";
import { departmentsClient } from "../clients/departmentsClient.js";

function toCamelEmployee(row) {
  return {
    id: row.id,
    employeeId: row.employee_code,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    workEmail: row.work_email,
    workPhone: row.work_phone,
    photo: row.photo_initials || `${(row.first_name || "")[0] || ""}${(row.last_name || "")[0] || ""}`.toUpperCase(),
    employeeTypeId: row.employee_type_id,
    status: row.status,
    workMode: row.work_mode,
    allowance: row.allowance,
    startDate: row.start_date,
    contractEndDate: row.contract_end_date,
    sourceApplicantId: row.source_applicant_id,
    internExternalId: row.intern_external_id,
    internRefNumber: row.intern_ref_number,
  };
}

function toCamelRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    departmentId: row.department_id,
    positionId: row.position_id,
    managerId: row.manager_id,
    supervisorId: row.supervisor_id,
    locationId: row.location_id,
    scheduleId: row.schedule_id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    changeReason: row.change_reason,
  };
}

function isoDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10);
}

// Mirrors resolveCurrentRecord/resolveNextRecord/resolveHistoricalRecord in
// employmentDomain.js exactly, operating on one employee's own records.
function resolveEffectiveRecord(records, status, referenceDate) {
  const ref = isoDate(referenceDate);
  const current = records
    .filter((r) => isoDate(r.effectiveFrom) <= ref && (!r.effectiveTo || isoDate(r.effectiveTo) >= ref))
    .sort((a, b) => isoDate(b.effectiveFrom).localeCompare(isoDate(a.effectiveFrom)))[0] ?? null;
  if (current) return { current, future: null, historical: null };

  if (status === "Upcoming" || status === "Onboarding") {
    const future = records
      .filter((r) => isoDate(r.effectiveFrom) > ref)
      .sort((a, b) => isoDate(a.effectiveFrom).localeCompare(isoDate(b.effectiveFrom)))[0] ?? null;
    return { current: null, future, historical: null };
  }
  if (status === "Former") {
    const historical = records
      .filter((r) => r.effectiveTo && isoDate(r.effectiveTo) <= ref)
      .sort((a, b) => isoDate(b.effectiveTo).localeCompare(isoDate(a.effectiveTo)))[0] ?? null;
    return { current: null, future: null, historical };
  }
  return { current: null, future: null, historical: null };
}

// Fetches every lookup table ONCE and reuses it across all employees being
// hydrated in this call — avoids an N+1 query (and N+1 external Departments
// API calls) per employee.
async function loadLookups() {
  const [[positions], [locations], [schedules], [employeeTypes], [employeeTags], [tagAssignments], departments] = await Promise.all([
    pool.query("SELECT * FROM positions"),
    pool.query("SELECT * FROM locations"),
    pool.query("SELECT * FROM schedules"),
    pool.query("SELECT * FROM employee_types"),
    pool.query("SELECT * FROM employee_tags"),
    pool.query("SELECT * FROM employee_tag_assignments"),
    departmentsClient.listDepartments().catch(() => []), // read-through; a failed external call shouldn't break the employee list
  ]);

  return {
    positionsById: new Map(positions.map((p) => [p.id, p])),
    locationsById: new Map(locations.map((l) => [l.id, l])),
    schedulesById: new Map(schedules.map((s) => [s.id, s])),
    employeeTypesById: new Map(employeeTypes.map((t) => [t.id, t])),
    employeeTagsById: new Map(employeeTags.map((t) => [t.id, t])),
    tagIdsByEmployeeId: tagAssignments.reduce((map, row) => {
      if (!map.has(row.employee_id)) map.set(row.employee_id, []);
      map.get(row.employee_id).push(row.tag_id);
      return map;
    }, new Map()),
    departmentsById: new Map(departments.map((d) => [d.id, d])),
  };
}

function normalizeDirectoryType(employeeType) {
  if (!employeeType) return "Employee";
  const code = (employeeType.code || "").toUpperCase();
  const name = (employeeType.name || "").toLowerCase();
  if (code === "INTERN" || name.includes("intern") || name.includes("apprentice")) return "Intern";
  return "Employee";
}

function hydrateOne(employeeRow, recordsByEmployeeId, employeesById, lookups) {
  const employee = toCamelEmployee(employeeRow);
  const records = (recordsByEmployeeId.get(employee.id) || []).map(toCamelRecord);
  const { current, future, historical } = resolveEffectiveRecord(records, employee.status, new Date());
  const effective = current || future || historical;

  const dept = effective?.departmentId ? lookups.departmentsById.get(effective.departmentId) : null;
  const pos = effective?.positionId ? lookups.positionsById.get(effective.positionId) : null;
  const loc = effective?.locationId ? lookups.locationsById.get(effective.locationId) : null;
  const sched = effective?.scheduleId ? lookups.schedulesById.get(effective.scheduleId) : null;
  const manager = effective?.managerId ? employeesById.get(effective.managerId) : null;
  const supervisor = effective?.supervisorId ? employeesById.get(effective.supervisorId) : null;
  const empType = lookups.employeeTypesById.get(employee.employeeTypeId) || null;
  const tagIds = lookups.tagIdsByEmployeeId.get(employee.id) || [];

  return {
    ...employee,
    currentEmploymentRecord: current,
    futureEmploymentRecord: future,
    historicalEmploymentRecord: historical,
    effectiveEmploymentRecord: effective,
    department: dept ? { id: dept.id, name: dept.name } : null,
    position: pos ? { id: pos.id, name: pos.name } : null,
    location: loc ? { id: loc.id, name: loc.name, type: loc.type, address: loc.address } : null,
    schedule: sched
      ? { id: sched.id, name: sched.name, workingDays: Array.isArray(sched.working_days) ? sched.working_days : JSON.parse(sched.working_days || "[]"), startTime: sched.start_time, endTime: sched.end_time, weeklyHours: sched.weekly_hours }
      : null,
    employeeType: empType ? { id: empType.id, code: empType.code, name: empType.name } : null,
    directoryType: normalizeDirectoryType(empType),
    resolvedTags: tagIds.map((id) => lookups.employeeTagsById.get(id)).filter(Boolean).map((t) => ({ id: t.id, name: t.name, category: t.category, color: t.color })),
    manager: manager ? { id: manager.id, fullName: manager.fullName, workEmail: manager.workEmail } : null,
    supervisor: supervisor ? { id: supervisor.id, fullName: supervisor.fullName, workEmail: supervisor.workEmail } : null,
  };
}

// Hydrates a set of raw employee rows (already filtered/paginated by the
// caller — see db/employees.js) into the shape src/domain/employmentDomain.js's
// resolveHydratedEmployee() used to produce from local mock arrays.
export async function hydrateEmployees(employeeRows) {
  if (employeeRows.length === 0) return [];

  const employeeIds = employeeRows.map((e) => e.id);
  const [allRecords] = await pool.query(
    `SELECT * FROM employment_records WHERE employee_id IN (${employeeIds.map(() => "?").join(",")})`,
    employeeIds,
  );
  // Manager/supervisor lookups can point outside this page's rows, so fetch
  // every employee once too — this app's whole headcount is small (HR PoC
  // scale), not worth a second round trip per referenced manager.
  const [allEmployeeRows] = await pool.query("SELECT * FROM employees");

  const recordsByEmployeeId = new Map();
  for (const record of allRecords) {
    if (!recordsByEmployeeId.has(record.employee_id)) recordsByEmployeeId.set(record.employee_id, []);
    recordsByEmployeeId.get(record.employee_id).push(record);
  }

  const employeesById = new Map(allEmployeeRows.map((row) => [row.id, toCamelEmployee(row)]));
  const lookups = await loadLookups();

  return employeeRows.map((row) => hydrateOne(row, recordsByEmployeeId, employeesById, lookups));
}

export async function hydrateEmployee(employeeRow) {
  if (!employeeRow) return null;
  const [hydrated] = await hydrateEmployees([employeeRow]);
  return hydrated;
}
