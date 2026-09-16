import { listRows, getRow, insertRow, updateRow } from "./crud.js";

export function listActivities({ employeeId, assigneeId, limit, offset }) {
  const where = {};
  if (employeeId) where.employee_id = employeeId;
  if (assigneeId) where.assignee_id = assigneeId;
  return listRows("activities", { where, limit, offset });
}

export const getActivity = (id) => getRow("activities", id);

export const createActivity = (data) =>
  insertRow("activities", {
    type_id: data.typeId,
    title: data.title,
    description: data.description ?? null,
    employee_id: data.employeeId,
    assignee_id: data.assigneeId ?? null,
    due_date: data.dueDate ?? null,
    source: data.source ?? "Manual",
  });

export function updateActivity(id, data) {
  const columns = {};
  if (data.title !== undefined) columns.title = data.title;
  if (data.dueDate !== undefined) columns.due_date = data.dueDate;
  if (data.completed !== undefined) {
    columns.completed = data.completed;
    columns.completed_at = data.completed ? new Date() : null;
  }
  return updateRow("activities", id, columns);
}
