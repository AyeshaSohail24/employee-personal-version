import { pool } from "./pool.js";
import { listRows, getRow, insertRow, updateRow, RowNotFoundError } from "./crud.js";
import { getLinkedIntern, listInternsWithOnboardingStatus, resolveOrCreateEmployeeForIntern, activateInternOnOnboardingComplete } from "./internSync.js";

export { RowNotFoundError, getLinkedIntern };

export const listTemplates = (departmentId, { limit, offset } = {}) =>
  listRows("onboarding_plan_templates", { where: departmentId ? { department_id: departmentId } : {}, orderBy: "id", orderDir: "ASC", limit, offset });
export const getTemplate = (id) => getRow("onboarding_plan_templates", id);
export const createTemplate = (data) =>
  insertRow("onboarding_plan_templates", { name: data.name, department_id: data.departmentId ?? null, description: data.description ?? null });
export function updateTemplate(id, data) {
  const columns = {};
  if (data.name !== undefined) columns.name = data.name;
  if (data.description !== undefined) columns.description = data.description;
  if (data.active !== undefined) columns.active = data.active;
  return updateRow("onboarding_plan_templates", id, columns);
}

// The actual live task model: every task belongs to ONE (personType, scopeType
// [, scopeDepartmentId]) scope — Universal (applies regardless of department)
// or Department-specific — never a named template. `plan_template_id` stays
// on the table for a legacy path nothing real calls; scope tasks always leave
// it NULL.
export async function listScopeTasks() {
  const [rows] = await pool.query("SELECT * FROM onboarding_plan_tasks WHERE active = TRUE ORDER BY sequence ASC");
  return rows;
}

// Replace-by-key: every existing task in this exact (personType, scopeType[,
// scopeDepartmentId]) scope is replaced by the given set — every OTHER scope
// is untouched. Mirrors the same soft-replace pattern used elsewhere in this
// app (e.g. employment_records' append-only history close-out).
export async function saveScopeTasks({ scopeType, personType, scopeDepartmentId, tasks }) {
  const whereSql = scopeType === "department"
    ? "scope_type = ? AND person_type = ? AND scope_department_id = ?"
    : "scope_type = ? AND person_type = ? AND scope_department_id IS NULL";
  const whereValues = scopeType === "department" ? [scopeType, personType, scopeDepartmentId] : [scopeType, personType];

  await pool.query(`DELETE FROM onboarding_plan_tasks WHERE ${whereSql}`, whereValues);

  let sequence = 1;
  for (const task of tasks) {
    await insertRow("onboarding_plan_tasks", {
      plan_template_id: null,
      activity_type_id: task.activityTypeId,
      title: task.title,
      description: task.description ?? null,
      assignment_rule: task.assignmentRule ?? "hr",
      specific_assignee_id: task.specificAssigneeId ?? null,
      relative_offset_days: task.relativeOffsetDays ?? 0,
      required: task.required !== false,
      sequence: sequence++,
      scope_type: scopeType,
      person_type: personType,
      scope_department_id: scopeType === "department" ? scopeDepartmentId : null,
    });
  }

  return listScopeTasks();
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The tasks that actually apply to one person: every active Universal task
// for their personType, plus every active Department task scoped to their
// personType AND their specific department — mirrors
// src/domain/onboardingDomain.js's composeOnboardingTasks() exactly.
async function composeApplicableTasks(personType, departmentId) {
  const conditions = ["active = TRUE", "person_type = ?"];
  const values = [personType];
  if (departmentId) {
    conditions.push("((scope_type = 'universal') OR (scope_type = 'department' AND scope_department_id = ?))");
    values.push(departmentId);
  } else {
    conditions.push("scope_type = 'universal'");
  }
  const [rows] = await pool.query(
    `SELECT * FROM onboarding_plan_tasks WHERE ${conditions.join(" AND ")} ORDER BY sequence ASC`,
    values,
  );
  return rows;
}

// Snapshots the composed task set into its own task instances (so a later
// scope edit never rewrites history for someone already mid-plan — see the
// onboarding_task_instances comment in db/schema_employees.sql), and
// creates the linked `activities` row each task instance is tracked through.
export async function launchInstance({ employeeId, personType, departmentId, anchorDate }) {
  const tasks = await composeApplicableTasks(personType, departmentId);
  if (tasks.length === 0) {
    throw new Error(`No onboarding tasks are configured for ${personType}${departmentId ? ` in department ${departmentId}` : ""} yet.`);
  }

  const instanceId = await insertRow("onboarding_plan_instances", {
    plan_template_id: null,
    employee_id: employeeId,
    started_at: new Date().toISOString().slice(0, 10),
    anchor_date: anchorDate,
  });

  for (const task of tasks) {
    const dueDate = addDays(anchorDate, task.relative_offset_days);
    const taskInstanceId = await insertRow("onboarding_task_instances", {
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
      source: "Onboarding",
      source_entity_type: "OnboardingTaskInstance",
      source_entity_id: taskInstanceId,
    });
    await pool.query("UPDATE onboarding_task_instances SET activity_id = ? WHERE id = ?", [activityId, taskInstanceId]);
  }

  return instanceId;
}

// "Each intern should already be assigned" — HR never manually launches
// onboarding for an intern: the moment a real intern shows up with no local
// plan yet, one is composed and launched automatically from their real
// department + the active Universal tasks. A silent per-intern no-op (not a
// request-failing error) when nothing is configured for their scope yet, or
// they have no resolvable start date — they simply keep showing with
// plan: null, exactly as before, until HR adds Universal/department tasks.
export async function listInternsWithAutoLaunchedOnboarding() {
  const interns = await listInternsWithOnboardingStatus();
  const pending = interns.filter((intern) => !intern.plan && intern.startDate);
  if (pending.length === 0) return interns;

  for (const intern of pending) {
    try {
      const employee = await resolveOrCreateEmployeeForIntern(intern.internId);
      await launchInstance({
        employeeId: employee.id,
        personType: "intern",
        departmentId: intern.department?.id ?? null,
        anchorDate: intern.startDate,
      });
    } catch {
      // No active Universal/department task configured for this intern's
      // scope yet, or another per-intern issue — leave them at plan: null
      // rather than failing the whole roster view.
    }
  }

  return listInternsWithOnboardingStatus();
}

export const getInstance = (id) => getRow("onboarding_plan_instances", id);

export async function getLatestInstanceForEmployee(employeeId) {
  const [rows] = await pool.query(
    "SELECT * FROM onboarding_plan_instances WHERE employee_id = ? ORDER BY id DESC LIMIT 1",
    [employeeId],
  );
  return rows[0] ?? null;
}

export async function listInstanceTasks(instanceId) {
  // Joined with its linked activity for completed/completed_at/due_date — a
  // task instance's own row never carries completion state, only the
  // originally-calculated snapshot (see the schema note on
  // onboarding_task_instances); the activity is where Done/Reopen lives.
  const [rows] = await pool.query(
    `SELECT ti.*, a.completed, a.completed_at, a.due_date
       FROM onboarding_task_instances ti
       LEFT JOIN activities a ON a.id = ti.activity_id
      WHERE ti.plan_instance_id = ?
      ORDER BY ti.sequence ASC`,
    [instanceId],
  );
  return rows;
}

export const getTaskInstance = (id) => getRow("onboarding_task_instances", id);

export async function setTaskInstanceCompleted(taskInstanceId, completed) {
  const taskInstance = await getRow("onboarding_task_instances", taskInstanceId);
  if (!taskInstance) throw new RowNotFoundError(`No onboarding task instance with id ${taskInstanceId}.`);
  await pool.query(
    "UPDATE activities SET completed = ?, completed_at = ? WHERE id = ?",
    [completed, completed ? new Date() : null, taskInstance.activity_id],
  );

  if (completed) {
    await activateIfPlanComplete(taskInstance.plan_instance_id);
  }
}

// Checks whether every required task in this plan instance is now done and, if so, hands off to
// activateInternOnOnboardingComplete() (internSync.js) to advance the linked intern's status to
// Active in both the Interns DB and the local employees record (see that function's own doc
// comment for the two-store ordering/partial-failure handling). Mirrors src/domain/
// onboardingDomain.js's derivePlanInstanceStatus() completion rule (every required task done) so
// "genuinely Completed" means the same thing here as it does for the plan's own displayed status
// — an incomplete plan (any required task still open) never reaches
// activateInternOnOnboardingComplete() at all.
async function activateIfPlanComplete(planInstanceId) {
  const tasks = await listInstanceTasks(planInstanceId);
  const requiredTasks = tasks.filter((t) => t.required);
  if (requiredTasks.length === 0 || !requiredTasks.every((t) => t.completed)) return;

  const planInstance = await getRow("onboarding_plan_instances", planInstanceId);
  if (!planInstance) return;

  await activateInternOnOnboardingComplete(planInstance.employee_id);
}
