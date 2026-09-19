import { pool } from "./pool.js";
import { getRow, insertRow, updateRow } from "./crud.js";

export async function listEmployees({ status, departmentId, limit, offset }) {
  const conditions = [];
  const values = [];
  let joinClause = "";
  if (departmentId) {
    // department isn't a column on employees itself — it lives on the
    // current (effective_to IS NULL) employment_records row.
    joinClause = "JOIN employment_records er ON er.employee_id = e.id AND er.effective_to IS NULL";
    conditions.push("er.department_id = ?");
    values.push(departmentId);
  }
  if (status) {
    conditions.push("e.status = ?");
    values.push(status);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT e.* FROM employees e ${joinClause} ${whereClause} ORDER BY e.id DESC LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  return rows;
}

export const getEmployee = (id) => getRow("employees", id);

export function createEmployee(data) {
  return insertRow("employees", {
    employee_code: data.employeeCode,
    first_name: data.firstName,
    last_name: data.lastName,
    work_email: data.workEmail,
    work_phone: data.workPhone ?? null,
    employee_type_id: data.employeeTypeId,
    status: data.status ?? "Onboarding",
    work_mode: data.workMode ?? "On-site",
    allowance: data.allowance ?? "Paid",
    start_date: data.startDate,
    contract_end_date: data.contractEndDate ?? null,
    source_applicant_id: data.sourceApplicantId ?? null,
  });
}

export function updateEmployee(id, data) {
  const columns = {};
  if (data.employeeCode !== undefined) columns.employee_code = data.employeeCode;
  if (data.status !== undefined) columns.status = data.status;
  if (data.workEmail !== undefined) columns.work_email = data.workEmail;
  if (data.workPhone !== undefined) columns.work_phone = data.workPhone;
  if (data.allowance !== undefined) columns.allowance = data.allowance;
  if (data.workMode !== undefined) columns.work_mode = data.workMode;
  if (data.contractEndDate !== undefined) columns.contract_end_date = data.contractEndDate;
  if (data.internExternalId !== undefined) columns.intern_external_id = data.internExternalId;
  if (data.internRefNumber !== undefined) columns.intern_ref_number = data.internRefNumber;
  return updateRow("employees", id, columns);
}

export async function listEmploymentRecords(employeeId) {
  const [rows] = await pool.query(
    "SELECT * FROM employment_records WHERE employee_id = ? ORDER BY effective_from DESC",
    [employeeId],
  );
  return rows;
}

// AGENTS.md rule 5 — employment history is append-only: close whatever
// record is currently open, then insert the new one, rather than overwrite.
export async function createEmploymentRecord(employeeId, data) {
  await pool.query(
    "UPDATE employment_records SET effective_to = ? WHERE employee_id = ? AND effective_to IS NULL",
    [data.effectiveFrom, employeeId],
  );
  return insertRow("employment_records", {
    employee_id: employeeId,
    department_id: data.departmentId ?? null,
    position_id: data.positionId ?? null,
    manager_id: data.managerId ?? null,
    supervisor_id: data.supervisorId ?? null,
    schedule_id: data.scheduleId ?? null,
    location_id: data.locationId ?? null,
    effective_from: data.effectiveFrom,
    change_reason: data.changeReason ?? null,
  });
}
