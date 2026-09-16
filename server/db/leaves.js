import { listRows, getRow, insertRow, updateRow } from "./crud.js";

export function listLeaves({ employeeId, status, limit, offset }) {
  const where = {};
  if (employeeId) where.employee_id = employeeId;
  if (status) where.status = status;
  return listRows("leaves", { where, limit, offset });
}

export const getLeave = (id) => getRow("leaves", id);

export const createLeave = (data) =>
  insertRow("leaves", {
    employee_id: data.employeeId,
    leave_type: data.leaveType,
    start_date: data.startDate,
    end_date: data.endDate,
    reason: data.reason ?? null,
    applied_at: new Date().toISOString().slice(0, 10),
  });

export function updateLeave(id, data) {
  const columns = {};
  if (data.status !== undefined) columns.status = data.status;
  if (data.reason !== undefined) columns.reason = data.reason;
  return updateRow("leaves", id, columns);
}

export function listPresenceOverrides(employeeId) {
  return listRows("presence_overrides", { where: employeeId ? { employee_id: employeeId } : {} });
}

export const createPresenceOverride = (data) =>
  insertRow("presence_overrides", {
    employee_id: data.employeeId,
    override_state: data.overrideState,
    reason: data.reason ?? null,
    created_by: data.createdBy ?? null,
  });
