import { pool } from "./pool.js";
import { listRows, getRow, insertRow, updateRow, RowNotFoundError } from "./crud.js";
import { getLinkedIntern, fetchRosterSources, listInternsWithOnboardingStatus, resolveOrCreateEmployeeForIntern, activateInternOnOnboardingComplete } from "./internSync.js";

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
  // Fetched once and reused below — see fetchRosterSources()'s own comment.
  const sources = await fetchRosterSources();
  const interns = await listInternsWithOnboardingStatus(sources);
  const pending = interns.filter((intern) => !intern.plan && intern.startDate);
  if (pending.length === 0) return interns;

  let launched = 0;
  for (const intern of pending) {
    try {
      const employee = await resolveOrCreateEmployeeForIntern(intern.internId);
      await launchInstance({
        employeeId: employee.id,
        personType: "intern",
        departmentId: intern.department?.id ?? null,
        anchorDate: intern.startDate,
      });
      launched += 1;
    } catch {
      // No active Universal/department task configured for this intern's
      // scope yet, or another per-intern issue — leave them at plan: null
      // rather than failing the whole roster view.
    }
  }

  // Only the local plans changed — re-read those, reusing the Interns DB/Departments data fetched
  // above instead of pulling every intern again. And if nothing launched (e.g. no tasks configured
  // for someone's scope yet, which would otherwise repeat on every single page load), nothing
  // changed at all, so the first result stands.
  return launched > 0 ? listInternsWithOnboardingStatus(sources) : interns;
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

export class TaskInstanceValidationError extends Error {}

// Edits ONE task in one person's plan (their own snapshot row + its linked activity) — the shared
// Universal/department task in Onboarding > Plans is never touched, so no one else's plan changes.
// Changing the due date also updates the task's relative day (vs. the plan's anchor date) so the
// "Relative Timing" column stays truthful; originally_calculated_due_date keeps the original.
export async function updateTaskInstanceDetails(taskInstanceId, { title, description, dueDate } = {}) {
  const taskInstance = await getRow("onboarding_task_instances", taskInstanceId);
  if (!taskInstance) throw new RowNotFoundError(`No onboarding task instance with id ${taskInstanceId}.`);

  const taskColumns = {};
  const activityColumns = {};
  if (title !== undefined) {
    const trimmed = String(title ?? "").trim();
    if (!trimmed) throw new TaskInstanceValidationError("The task title can't be empty.");
    if (trimmed.length > 255) throw new TaskInstanceValidationError("The task title must be 255 characters or fewer.");
    taskColumns.title = trimmed;
    activityColumns.title = trimmed;
  }
  if (description !== undefined) {
    const trimmed = String(description ?? "").trim();
    taskColumns.description = trimmed || null;
    activityColumns.description = trimmed || null;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (dueDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate))) throw new TaskInstanceValidationError("Enter a valid due date.");
      activityColumns.due_date = dueDate;
      const [[{ offset }]] = await conn.query(
        "SELECT DATEDIFF(?, anchor_date) AS offset FROM onboarding_plan_instances WHERE id = ?",
        [dueDate, taskInstance.plan_instance_id],
      );
      if (offset !== null && offset !== undefined) taskColumns.relative_offset_days = offset;
    }
    const setClause = (cols) => Object.keys(cols).map((c) => `\`${c}\` = ?`).join(", ");
    if (Object.keys(taskColumns).length > 0) {
      await conn.query(`UPDATE onboarding_task_instances SET ${setClause(taskColumns)} WHERE id = ?`, [...Object.values(taskColumns), taskInstanceId]);
    }
    if (Object.keys(activityColumns).length > 0 && taskInstance.activity_id) {
      await conn.query(`UPDATE activities SET ${setClause(activityColumns)} WHERE id = ?`, [...Object.values(activityColumns), taskInstance.activity_id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Adds a new task to ONE person's plan only (their own task row + its linked activity), placed
// after the existing tasks. It isn't added to Onboarding > Plans, so no one else's plan changes.
// Uses the "To Do" activity type and HR assignment, like the tasks HR configures there.
export async function addTaskToInstance(planInstanceId, { title, description, dueDate, required = true } = {}) {
  const trimmedTitle = String(title ?? "").trim();
  if (!trimmedTitle) throw new TaskInstanceValidationError("The task title can't be empty.");
  if (trimmedTitle.length > 255) throw new TaskInstanceValidationError("The task title must be 255 characters or fewer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate ?? ""))) throw new TaskInstanceValidationError("Enter a valid due date.");
  const trimmedDescription = String(description ?? "").trim() || null;

  const planInstance = await getRow("onboarding_plan_instances", planInstanceId);
  if (!planInstance) throw new RowNotFoundError(`No onboarding plan instance with id ${planInstanceId}.`);

  const [[todoType]] = await pool.query("SELECT id FROM activity_types WHERE name = 'To Do' LIMIT 1");
  const [[anyType]] = todoType ? [[todoType]] : await pool.query("SELECT id FROM activity_types ORDER BY id LIMIT 1");
  if (!anyType) throw new TaskInstanceValidationError("No activity types are configured.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[{ offset }]] = await conn.query("SELECT DATEDIFF(?, anchor_date) AS offset FROM onboarding_plan_instances WHERE id = ?", [dueDate, planInstanceId]);
    const [[{ nextSequence }]] = await conn.query(
      "SELECT COALESCE(MAX(sequence), 0) + 1 AS nextSequence FROM onboarding_task_instances WHERE plan_instance_id = ?",
      [planInstanceId],
    );
    const [taskResult] = await conn.query(
      `INSERT INTO onboarding_task_instances
         (plan_instance_id, plan_task_id, title, description, activity_type_id, assignment_rule,
          relative_offset_days, originally_calculated_due_date, required, sequence)
       VALUES (?, NULL, ?, ?, ?, 'hr', ?, ?, ?, ?)`,
      [planInstanceId, trimmedTitle, trimmedDescription, anyType.id, offset ?? 0, dueDate, Boolean(required), nextSequence],
    );
    const taskInstanceId = taskResult.insertId;
    const [activityResult] = await conn.query(
      `INSERT INTO activities (type_id, title, description, employee_id, due_date, source, source_entity_type, source_entity_id)
       VALUES (?, ?, ?, ?, ?, 'Onboarding', 'OnboardingTaskInstance', ?)`,
      [anyType.id, trimmedTitle, trimmedDescription, planInstance.employee_id, dueDate, taskInstanceId],
    );
    await conn.query("UPDATE onboarding_task_instances SET activity_id = ? WHERE id = ?", [activityResult.insertId, taskInstanceId]);
    await conn.commit();
    return taskInstanceId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Removes ONE task from one person's plan (their snapshot row + its linked activity) and renumbers
// the rest; the shared task in Onboarding > Plans is untouched. If what's left is now all done,
// the plan is complete and the usual Onboarding -> Active hand-off runs (activateIfPlanComplete).
export async function deleteTaskInstance(taskInstanceId) {
  const taskInstance = await getRow("onboarding_task_instances", taskInstanceId);
  if (!taskInstance) throw new RowNotFoundError(`No onboarding task instance with id ${taskInstanceId}.`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM onboarding_task_instances WHERE id = ?", [taskInstanceId]);
    if (taskInstance.activity_id) await conn.query("DELETE FROM activities WHERE id = ?", [taskInstance.activity_id]);
    const [remaining] = await conn.query(
      "SELECT id FROM onboarding_task_instances WHERE plan_instance_id = ? ORDER BY sequence ASC, id ASC",
      [taskInstance.plan_instance_id],
    );
    for (const [index, row] of remaining.entries()) {
      await conn.query("UPDATE onboarding_task_instances SET sequence = ? WHERE id = ?", [index + 1, row.id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await activateIfPlanComplete(taskInstance.plan_instance_id);
  return taskInstance.plan_instance_id;
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
