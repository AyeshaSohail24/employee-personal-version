import { pool } from "./pool.js";
import { listRows, getRow, insertRow, updateRow, RowNotFoundError } from "./crud.js";

export { RowNotFoundError };

export const listTemplates = (departmentId) =>
  listRows("offboarding_plan_templates", { where: departmentId ? { department_id: departmentId } : {}, orderBy: "id", orderDir: "ASC" });
export const getTemplate = (id) => getRow("offboarding_plan_templates", id);
export const createTemplate = (data) =>
  insertRow("offboarding_plan_templates", { name: data.name, department_id: data.departmentId ?? null, description: data.description ?? null });
export function updateTemplate(id, data) {
  const columns = {};
  if (data.name !== undefined) columns.name = data.name;
  if (data.description !== undefined) columns.description = data.description;
  if (data.active !== undefined) columns.active = data.active;
  return updateRow("offboarding_plan_templates", id, columns);
}

async function listTemplateTasks(templateId) {
  const [rows] = await pool.query(
    "SELECT * FROM offboarding_plan_tasks WHERE plan_template_id = ? AND active = TRUE ORDER BY sequence ASC",
    [templateId],
  );
  return rows;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Mirrors onboarding.js's launchInstance exactly — see its comment. Here
// `anchorDate` is the departing employee's last working day, and offsets are
// typically negative (clearance tasks due before departure).
export async function launchInstance({ planTemplateId, employeeId, anchorDate }) {
  const tasks = await listTemplateTasks(planTemplateId);
  const instanceId = await insertRow("offboarding_plan_instances", {
    plan_template_id: planTemplateId,
    employee_id: employeeId,
    started_at: new Date().toISOString().slice(0, 10),
    anchor_date: anchorDate,
  });

  for (const task of tasks) {
    const dueDate = addDays(anchorDate, task.relative_offset_days);
    const taskInstanceId = await insertRow("offboarding_task_instances", {
      plan_instance_id: instanceId,
      plan_task_id: task.id,
      title: task.title,
      description: task.description,
      activity_type_id: task.activity_type_id,
      assignment_rule: task.assignment_rule,
      originally_resolved_assignee_id: task.specific_assignee_id,
      relative_offset_days: task.relative_offset_days,
      originally_calculated_due_date: dueDate,
      required: task.required,
      sequence: task.sequence,
    });
    const activityId = await insertRow("activities", {
      type_id: task.activity_type_id,
      title: task.title,
      description: task.description,
      employee_id: employeeId,
      assignee_id: task.specific_assignee_id,
      due_date: dueDate,
      source: "Offboarding",
      source_entity_type: "OffboardingTaskInstance",
      source_entity_id: taskInstanceId,
    });
    await pool.query("UPDATE offboarding_task_instances SET activity_id = ? WHERE id = ?", [activityId, taskInstanceId]);
  }

  return instanceId;
}

export const getInstance = (id) => getRow("offboarding_plan_instances", id);

export async function listInstanceTasks(instanceId) {
  const [rows] = await pool.query(
    "SELECT * FROM offboarding_task_instances WHERE plan_instance_id = ? ORDER BY sequence ASC",
    [instanceId],
  );
  return rows;
}

export const getTaskInstance = (id) => getRow("offboarding_task_instances", id);

export async function setTaskInstanceCompleted(taskInstanceId, completed) {
  const taskInstance = await getRow("offboarding_task_instances", taskInstanceId);
  if (!taskInstance) throw new RowNotFoundError(`No offboarding task instance with id ${taskInstanceId}.`);
  await pool.query(
    "UPDATE activities SET completed = ?, completed_at = ? WHERE id = ?",
    [completed, completed ? new Date() : null, taskInstance.activity_id],
  );
}
