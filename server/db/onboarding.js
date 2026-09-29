import { pool } from "./pool.js";
import { listRows, getRow, insertRow, updateRow, RowNotFoundError } from "./crud.js";
import { getLinkedIntern, fetchRosterSources, listInternsWithOnboardingStatus, resolveOrCreateEmployeeForIntern, activateInternOnOnboardingComplete, fetchInternsForOverlay } from "./internSync.js";
import { departmentsClient } from "../clients/departmentsClient.js";
import { internsClient } from "../clients/internsClient.js";
import { toAppDateString } from "../dates.js";

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

// Onboarding plans are launched when a person enters Onboarding — at Accept
// (applicantConversion.js) — or by HR from Progress (Launch Plan / Retry
// Launch) for interns who entered Onboarding directly in the Interns DB. Both
// go through ensureOnboardingPlan() below, which never creates a second plan.
// Reading the Progress roster only DISPLAYS: an intern with no plan is shown
// with the likely reason (launchIssue) instead of being launched on page load.
export async function listInternsForOnboardingProgress() {
  // fetchRosterSources() still applies the existing Active -> Offboarding transition (unchanged).
  const sources = await fetchRosterSources();
  const interns = await listInternsWithOnboardingStatus(sources);
  const withoutPlan = interns.filter((intern) => !intern.plan);
  if (withoutPlan.length === 0) return interns;

  const [taskRows] = await pool.query(
    "SELECT scope_type, scope_department_id FROM onboarding_plan_tasks WHERE active = TRUE AND person_type = 'intern'",
  );
  const universalCount = taskRows.filter((t) => t.scope_type === "universal").length;
  const departmentCount = (departmentId) =>
    taskRows.filter((t) => t.scope_type === "department" && t.scope_department_id === departmentId).length;

  return interns.map((intern) =>
    intern.plan ? intern : { ...intern, launchIssue: describeLaunchIssue(intern, universalCount, departmentCount) });
}

// Why an Onboarding intern has no plan, from data already on hand — mirrors what
// ensureOnboardingPlan() would hit: start date first, then whether ANY applicable task exists
// (Universal + their department, same rule as launchInstance()), then whether they're set up here.
export function describeLaunchIssue(intern, universalCount, departmentCount) {
  if (!intern.startDate) return "No internship start date in the Interns database.";
  const applicable = universalCount + (intern.department?.id ? departmentCount(intern.department.id) : 0);
  if (applicable === 0) {
    return `No onboarding tasks are set up for ${intern.department?.name ?? "their department"} (Universal or department) yet.`;
  }
  if (!intern.localEmployeeId) return "Not set up in this app yet — Launch Plan creates their record and plan.";
  return "Plan not launched yet.";
}

async function logLaunch(action, employeeId, details) {
  await insertRow("audit_logs", {
    user_id: "system",
    action,
    entity: "employees",
    entity_id: String(employeeId),
    details: String(details).slice(0, 2000),
  }).catch(() => {});
}

/**
 * Launches one person's onboarding plan if — and only if — they don't have one yet (active OR
 * completed), using exactly the existing launch rules: their applicable Universal + department
 * intern tasks (launchInstance()), anchored on their internship start date. Safe to call any
 * number of times, including concurrently: a per-person MySQL advisory lock (GET_LOCK) serialises
 * the check-then-launch, so two calls can never both create a plan.
 *
 * Returns { status: "launched", planInstanceId } | { status: "exists", planInstanceId } |
 *         { status: "not_launched", reason }.
 */
export async function ensureOnboardingPlan(employeeId) {
  const employee = await getRow("employees", employeeId);
  if (!employee) return { status: "not_launched", reason: "This person has no record in this app yet." };
  if (!employee.intern_external_id) {
    return { status: "not_launched", reason: "Onboarding plans are launched automatically for interns only." };
  }

  const conn = await pool.getConnection();
  const lockName = `onboarding_launch_${employeeId}`;
  try {
    const [[{ got }]] = await conn.query("SELECT GET_LOCK(?, 15) AS got", [lockName]);
    if (got !== 1) return { status: "not_launched", reason: "Another launch for this person is in progress — try again in a moment." };

    const [[existing]] = await conn.query(
      "SELECT id FROM onboarding_plan_instances WHERE employee_id = ? ORDER BY id DESC LIMIT 1",
      [employeeId],
    );
    if (existing) return { status: "exists", planInstanceId: existing.id };

    const intern = await internsClient.getIntern(employee.intern_external_id);
    const startDate = intern?.internship_start_date ? String(intern.internship_start_date).slice(0, 10) : null;
    if (!startDate) {
      const reason = "No internship start date in the Interns database.";
      await logLaunch("onboarding_plan_launch_failed", employeeId, reason);
      return { status: "not_launched", reason };
    }
    // Same department resolution as the Progress roster: only a department the Departments
    // service knows is used for department tasks (otherwise Universal tasks only).
    const departments = await departmentsClient.listDepartments().catch(() => []);
    const department = departments.find((d) => String(d.id) === String(intern.department_id)) ?? null;

    try {
      const planInstanceId = await launchInstance({
        employeeId,
        personType: "intern",
        departmentId: department?.id ?? null,
        anchorDate: startDate,
      });
      await logLaunch("onboarding_plan_launched", employeeId, `Launched onboarding plan ${planInstanceId} for ${intern.ref_number ?? employeeId}, anchored on ${startDate}.`);
      return { status: "launched", planInstanceId };
    } catch (error) {
      const reason = /No onboarding tasks are configured/.test(String(error.message))
        ? `No onboarding tasks are set up for ${department?.name ?? "their department"} (Universal or department) yet.`
        : String(error.message ?? error);
      await logLaunch("onboarding_plan_launch_failed", employeeId, reason);
      return { status: "not_launched", reason };
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    conn.release();
  }
}

/** Launch Plan / Retry Launch from Progress, by Interns DB id (creates the local record if needed). */
export async function ensureOnboardingPlanForIntern(internId) {
  let employee;
  try {
    employee = await resolveOrCreateEmployeeForIntern(internId);
  } catch (error) {
    const message = String(error.message ?? error);
    const reason = /Duplicate entry .* for key '.*email.*'/i.test(message)
      ? "Their email address is already used by another employee in this app, so their record can't be created."
      : `Their record in this app couldn't be created: ${message}`;
    return { status: "not_launched", reason };
  }
  return { employeeId: employee.id, ...(await ensureOnboardingPlan(employee.id)) };
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
  } else {
    await syncPlanCompletedAt(taskInstance.plan_instance_id);
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
    // A new required task reopens a completed plan (clears completed_at).
    await syncPlanCompletedAt(planInstanceId);
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
  const isComplete = await syncPlanCompletedAt(planInstanceId);
  if (!isComplete) return;

  const planInstance = await getRow("onboarding_plan_instances", planInstanceId);
  if (!planInstance) return;

  await activateInternOnOnboardingComplete(planInstance.employee_id);
}

// A plan is complete when it has required tasks and every one of them is done (same rule as the
// Progress page's status and the Onboarding -> Active hand-off). Keeps the plan's completed_at in
// step: stamped with today's Malaysia date (server/dates.js — not the UTC database's CURDATE())
// the first time it becomes complete (an existing date is kept), cleared if a required task is
// reopened or added. Returns whether the plan is complete.
async function syncPlanCompletedAt(planInstanceId) {
  const tasks = await listInstanceTasks(planInstanceId);
  const requiredTasks = tasks.filter((t) => t.required);
  const isComplete = requiredTasks.length > 0 && requiredTasks.every((t) => t.completed);
  if (isComplete) {
    await pool.query(
      "UPDATE onboarding_plan_instances SET completed_at = COALESCE(completed_at, ?) WHERE id = ?",
      [toAppDateString(), planInstanceId],
    );
  } else {
    await pool.query(
      "UPDATE onboarding_plan_instances SET completed_at = NULL WHERE id = ? AND completed_at IS NOT NULL",
      [planInstanceId],
    );
  }
  return isComplete;
}

// Onboarding History: every COMPLETED onboarding plan (all required tasks done), including people
// who have since moved to Active, Offboarding or Former — read from this app's own tables, so no
// one disappears when their Interns DB status moves on. Read-only. `completedAt` is the plan's
// recorded completed_at, or — for plans completed before that was recorded — the date its last
// task was ticked. Current status and photo come from the Interns DB when it's reachable.
export async function listOnboardingHistory() {
  const [plans] = await pool.query(
    `SELECT p.id AS planInstanceId, p.employee_id AS employeeId,
            DATE_FORMAT(p.anchor_date, '%Y-%m-%d') AS anchorDate,
            DATE_FORMAT(p.started_at, '%Y-%m-%d') AS startedAt,
            DATE_FORMAT(p.completed_at, '%Y-%m-%d') AS recordedCompletedAt,
            e.employee_code AS refNumber, e.first_name, e.last_name, e.status AS localStatus,
            e.intern_external_id AS internId
       FROM onboarding_plan_instances p
       JOIN employees e ON e.id = p.employee_id
      ORDER BY p.id DESC`,
  );
  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.planInstanceId);
  const [tasks] = await pool.query(
    `SELECT ti.plan_instance_id, ti.required, a.completed, UNIX_TIMESTAMP(a.completed_at) AS completedEpoch
       FROM onboarding_task_instances ti
       LEFT JOIN activities a ON a.id = ti.activity_id
      WHERE ti.plan_instance_id IN (${planIds.map(() => "?").join(",")})`,
    planIds,
  );
  const tasksByPlan = new Map();
  for (const t of tasks) {
    if (!tasksByPlan.has(t.plan_instance_id)) tasksByPlan.set(t.plan_instance_id, []);
    tasksByPlan.get(t.plan_instance_id).push(t);
  }

  const completedPlans = plans.filter((p) => {
    const required = (tasksByPlan.get(p.planInstanceId) ?? []).filter((t) => t.required);
    return required.length > 0 && required.every((t) => t.completed);
  });
  if (completedPlans.length === 0) return [];

  const employeeIds = [...new Set(completedPlans.map((p) => p.employeeId))];
  const [records] = await pool.query(
    `SELECT employee_id, department_id FROM employment_records
      WHERE employee_id IN (${employeeIds.map(() => "?").join(",")}) AND effective_to IS NULL
      ORDER BY effective_from DESC, id DESC`,
    employeeIds,
  );
  const departmentIdByEmployee = new Map();
  for (const r of records) if (!departmentIdByEmployee.has(r.employee_id)) departmentIdByEmployee.set(r.employee_id, r.department_id);

  const [departments, interns] = await Promise.all([
    departmentsClient.listDepartments().catch(() => []),
    fetchInternsForOverlay(),
  ]);
  const departmentsById = new Map(departments.map((d) => [String(d.id), d]));
  const internsById = new Map((interns ?? []).map((i) => [i.id, i]));

  return completedPlans
    .map((p) => {
      const planTasks = tasksByPlan.get(p.planInstanceId) ?? [];
      // Fallback completion date: the last task's completion moment (an exact epoch, so neither
      // the database's nor the server's time zone matters), as a Malaysia calendar date.
      const lastEpoch = Math.max(0, ...planTasks.map((t) => Number(t.completedEpoch) || 0));
      const lastTicked = lastEpoch > 0 ? toAppDateString(new Date(lastEpoch * 1000)) : null;
      const intern = p.internId ? internsById.get(p.internId) : null;
      const department = departmentsById.get(String(departmentIdByEmployee.get(p.employeeId) ?? ""));
      return {
        planInstanceId: p.planInstanceId,
        employeeId: p.employeeId,
        refNumber: intern?.ref_number ?? p.refNumber,
        fullName: `${p.first_name} ${p.last_name}`.trim(),
        department: department ? { id: department.id, name: department.name } : null,
        currentStatus: intern?.status ?? p.localStatus,
        photoUrl: intern?.photo_url ?? null,
        anchorDate: p.anchorDate,
        startedAt: p.startedAt,
        completedAt: p.recordedCompletedAt ?? lastTicked,
        taskCount: planTasks.length,
      };
    })
    .sort((a, b) => String(b.completedAt ?? "").localeCompare(String(a.completedAt ?? "")));
}

export class OnboardingHistoryError extends Error {}

// Deletes ONE completed onboarding plan from Onboarding History — the plan, its task rows and
// their linked activities — permanently. Only a completed plan (every required task done) can be
// deleted here, so a plan still in progress is never removed from History by mistake. The person
// themselves (employee record, Interns DB entry, status) is not touched. Logged to audit_logs.
export async function deleteCompletedOnboardingPlan(planInstanceId) {
  const plan = await getRow("onboarding_plan_instances", planInstanceId);
  if (!plan) throw new RowNotFoundError(`No onboarding plan with id ${planInstanceId}.`);

  const tasks = await listInstanceTasks(planInstanceId);
  const required = tasks.filter((t) => t.required);
  if (required.length === 0 || !required.every((t) => t.completed)) {
    throw new OnboardingHistoryError("Only completed onboarding records can be deleted from History.");
  }

  const [[employee]] = await pool.query("SELECT employee_code, first_name, last_name FROM employees WHERE id = ?", [plan.employee_id]);
  const activityIds = tasks.map((t) => t.activity_id).filter(Boolean);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Task rows go with the plan (ON DELETE CASCADE); their activities are deleted explicitly.
    await conn.query("DELETE FROM onboarding_plan_instances WHERE id = ?", [planInstanceId]);
    if (activityIds.length > 0) await conn.query("DELETE FROM activities WHERE id IN (?)", [activityIds]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await logLaunch(
    "onboarding_history_deleted",
    plan.employee_id,
    `Deleted completed onboarding plan ${planInstanceId} (${tasks.length} tasks) for ${employee ? `${employee.first_name} ${employee.last_name} (${employee.employee_code})` : `employee ${plan.employee_id}`}.`,
  );
}
