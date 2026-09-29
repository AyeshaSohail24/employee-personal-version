import { pool } from "./pool.js";
import { listRows, getRow, insertRow, updateRow, RowNotFoundError } from "./crud.js";
import { syncOffboardingLaunchToIntern, getLinkedIntern, resolveOrCreateEmployeeForIntern, fetchInternsForOverlay } from "./internSync.js";
import { departmentsClient } from "../clients/departmentsClient.js";
import { internsClient } from "../clients/internsClient.js";
import { toAppDateString } from "../dates.js";

export { RowNotFoundError, getLinkedIntern };

export const listTemplates = (departmentId, { limit, offset } = {}) =>
  listRows("offboarding_plan_templates", { where: departmentId ? { department_id: departmentId } : {}, orderBy: "id", orderDir: "ASC", limit, offset });
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

// Mirrors onboarding.js's scope-task model exactly — see its comments.
export async function listScopeTasks() {
  const [rows] = await pool.query("SELECT * FROM offboarding_plan_tasks WHERE active = TRUE ORDER BY sequence ASC");
  return rows;
}

export async function saveScopeTasks({ scopeType, personType, scopeDepartmentId, tasks }) {
  const whereSql = scopeType === "department"
    ? "scope_type = ? AND person_type = ? AND scope_department_id = ?"
    : "scope_type = ? AND person_type = ? AND scope_department_id IS NULL";
  const whereValues = scopeType === "department" ? [scopeType, personType, scopeDepartmentId] : [scopeType, personType];

  await pool.query(`DELETE FROM offboarding_plan_tasks WHERE ${whereSql}`, whereValues);

  let sequence = 1;
  for (const task of tasks) {
    await insertRow("offboarding_plan_tasks", {
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

async function composeApplicableTasks(personType, departmentId) {
  const conditions = ["active = TRUE", "person_type = ?"];
  const values = [personType];
  if (departmentId) {
    conditions.push("((scope_type = 'universal') OR (scope_type = 'department' AND scope_department_id = ?))");
    values.push(departmentId);
  } else {
    conditions.push("scope_type = 'universal'");
  }
  // By each task's own position; at an equal position Universal comes before the department task
  // (then creation order), so the combined order never depends on how MySQL breaks the tie.
  const [rows] = await pool.query(
    `SELECT * FROM offboarding_plan_tasks WHERE ${conditions.join(" AND ")} ORDER BY sequence ASC, scope_type = 'universal' DESC, id ASC`,
    values,
  );
  return rows;
}

// Mirrors onboarding.js's launchInstance exactly — see its comment. Here
// `anchorDate` is the departing employee's last working day, and offsets are
// typically negative (clearance tasks due before departure).
// `syncEndDate` (default true, the manual launch route's existing behaviour) also writes anchorDate
// back to the intern's internship_end_date. The automatic launch passes false: it anchors ON that
// end date, so it must never resave it.
export async function launchInstance({ employeeId, personType, departmentId, anchorDate, syncEndDate = true }) {
  const tasks = await composeApplicableTasks(personType, departmentId);
  if (tasks.length === 0) {
    throw new Error(`No offboarding tasks are configured for ${personType}${departmentId ? ` in department ${departmentId}` : ""} yet.`);
  }

  const instanceId = await insertRow("offboarding_plan_instances", {
    plan_template_id: null,
    employee_id: employeeId,
    started_at: new Date().toISOString().slice(0, 10),
    anchor_date: anchorDate,
  });

  // Numbered 1..n in the composed order (Universal and department tasks each start their own
  // sequence at 1, so copying task.sequence would give ties).
  for (const [index, task] of tasks.entries()) {
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
      sequence: index + 1,
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

  if (syncEndDate) await syncOffboardingLaunchToIntern(employeeId, anchorDate);

  return instanceId;
}

export const getInstance = (id) => getRow("offboarding_plan_instances", id);

export async function getLatestInstanceForEmployee(employeeId) {
  const [rows] = await pool.query(
    "SELECT * FROM offboarding_plan_instances WHERE employee_id = ? ORDER BY id DESC LIMIT 1",
    [employeeId],
  );
  return rows[0] ?? null;
}

export async function listInstanceTasks(instanceId) {
  // Joined with its linked activity for completed/completed_at/due_date —
  // see onboarding.js's identical listInstanceTasks() for why.
  const [rows] = await pool.query(
    `SELECT ti.*, a.completed, a.completed_at, a.due_date
       FROM offboarding_task_instances ti
       LEFT JOIN activities a ON a.id = ti.activity_id
      WHERE ti.plan_instance_id = ?
      ORDER BY ti.sequence ASC, ti.id ASC`,
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
  await syncPlanCompletedAt(taskInstance.plan_instance_id);
}

// A plan is complete when it has required tasks and every one of them is done (same rule as the
// Progress page's status). Keeps the plan's completed_at in step — mirrors onboarding.js's
// syncPlanCompletedAt(): stamped with today's Malaysia date (server/dates.js) the first time it
// becomes complete (an existing date is kept), cleared if a required task is reopened or added.
// Unlike Onboarding there's no status hand-off here: Offboarding -> Former comes from the Interns DB
// (after internship_end_date), not from finishing the plan. Returns whether the plan is complete.
async function syncPlanCompletedAt(planInstanceId) {
  const tasks = await listInstanceTasks(planInstanceId);
  const requiredTasks = tasks.filter((t) => t.required);
  const isComplete = requiredTasks.length > 0 && requiredTasks.every((t) => t.completed);
  if (isComplete) {
    await pool.query(
      "UPDATE offboarding_plan_instances SET completed_at = COALESCE(completed_at, ?) WHERE id = ?",
      [toAppDateString(), planInstanceId],
    );
  } else {
    await pool.query(
      "UPDATE offboarding_plan_instances SET completed_at = NULL WHERE id = ? AND completed_at IS NOT NULL",
      [planInstanceId],
    );
  }
  return isComplete;
}

export class TaskInstanceValidationError extends Error {}

// Edits one task in one person's offboarding plan only (title/description/due date) — mirrors
// onboarding.js's updateTaskInstanceDetails(). A new due date re-derives the task's relative day
// from the plan's anchor (the last working day). Offboarding > Plans is never touched.
export async function updateTaskInstanceDetails(taskInstanceId, { title, description, dueDate } = {}) {
  const taskInstance = await getRow("offboarding_task_instances", taskInstanceId);
  if (!taskInstance) throw new RowNotFoundError(`No offboarding task instance with id ${taskInstanceId}.`);

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
        "SELECT DATEDIFF(?, anchor_date) AS offset FROM offboarding_plan_instances WHERE id = ?",
        [dueDate, taskInstance.plan_instance_id],
      );
      if (offset !== null && offset !== undefined) taskColumns.relative_offset_days = offset;
    }
    const setClause = (cols) => Object.keys(cols).map((c) => `\`${c}\` = ?`).join(", ");
    if (Object.keys(taskColumns).length > 0) {
      await conn.query(`UPDATE offboarding_task_instances SET ${setClause(taskColumns)} WHERE id = ?`, [...Object.values(taskColumns), taskInstanceId]);
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

// Adds a task to one person's offboarding plan only — mirrors onboarding.js's addTaskToInstance().
// Its relative day is worked out from the plan's anchor (the last working day) and it goes to the
// end of the plan's order. Offboarding > Plans is never touched.
export async function addTaskToInstance(planInstanceId, { title, description, dueDate, required = true } = {}) {
  const trimmedTitle = String(title ?? "").trim();
  if (!trimmedTitle) throw new TaskInstanceValidationError("The task title can't be empty.");
  if (trimmedTitle.length > 255) throw new TaskInstanceValidationError("The task title must be 255 characters or fewer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate ?? ""))) throw new TaskInstanceValidationError("Enter a valid due date.");
  const trimmedDescription = String(description ?? "").trim() || null;

  const planInstance = await getRow("offboarding_plan_instances", planInstanceId);
  if (!planInstance) throw new RowNotFoundError(`No offboarding plan instance with id ${planInstanceId}.`);

  const [[todoType]] = await pool.query("SELECT id FROM activity_types WHERE name = 'To Do' LIMIT 1");
  const [[anyType]] = todoType ? [[todoType]] : await pool.query("SELECT id FROM activity_types ORDER BY id LIMIT 1");
  if (!anyType) throw new TaskInstanceValidationError("No activity types are configured.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[{ offset }]] = await conn.query("SELECT DATEDIFF(?, anchor_date) AS offset FROM offboarding_plan_instances WHERE id = ?", [dueDate, planInstanceId]);
    const [[{ nextSequence }]] = await conn.query(
      "SELECT COALESCE(MAX(sequence), 0) + 1 AS nextSequence FROM offboarding_task_instances WHERE plan_instance_id = ?",
      [planInstanceId],
    );
    const [taskResult] = await conn.query(
      `INSERT INTO offboarding_task_instances
         (plan_instance_id, plan_task_id, title, description, activity_type_id, assignment_rule,
          relative_offset_days, originally_calculated_due_date, required, sequence)
       VALUES (?, NULL, ?, ?, ?, 'hr', ?, ?, ?, ?)`,
      [planInstanceId, trimmedTitle, trimmedDescription, anyType.id, offset ?? 0, dueDate, Boolean(required), nextSequence],
    );
    const taskInstanceId = taskResult.insertId;
    const [activityResult] = await conn.query(
      `INSERT INTO activities (type_id, title, description, employee_id, due_date, source, source_entity_type, source_entity_id)
       VALUES (?, ?, ?, ?, ?, 'Offboarding', 'OffboardingTaskInstance', ?)`,
      [anyType.id, trimmedTitle, trimmedDescription, planInstance.employee_id, dueDate, taskInstanceId],
    );
    await conn.query("UPDATE offboarding_task_instances SET activity_id = ? WHERE id = ?", [activityResult.insertId, taskInstanceId]);
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

// Removes one task (and its activity) from one person's offboarding plan only, then renumbers the
// rest — mirrors onboarding.js's deleteTaskInstance(). Offboarding > Plans is never touched.
export async function deleteTaskInstance(taskInstanceId) {
  const taskInstance = await getRow("offboarding_task_instances", taskInstanceId);
  if (!taskInstance) throw new RowNotFoundError(`No offboarding task instance with id ${taskInstanceId}.`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM offboarding_task_instances WHERE id = ?", [taskInstanceId]);
    if (taskInstance.activity_id) await conn.query("DELETE FROM activities WHERE id = ?", [taskInstance.activity_id]);
    const [remaining] = await conn.query(
      "SELECT id FROM offboarding_task_instances WHERE plan_instance_id = ? ORDER BY sequence ASC, id ASC",
      [taskInstance.plan_instance_id],
    );
    for (const [index, row] of remaining.entries()) {
      await conn.query("UPDATE offboarding_task_instances SET sequence = ? WHERE id = ?", [index + 1, row.id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  // If what's left is now all done, the plan is complete (or, if not, no longer complete).
  await syncPlanCompletedAt(taskInstance.plan_instance_id);
  return taskInstance.plan_instance_id;
}

// Offboarding History: every COMPLETED offboarding plan (all required tasks done) — mirrors
// onboarding.js's listOnboardingHistory(), on the Offboarding tables. Read from this app's own
// tables rather than the Interns DB roster, so a person still appears here after their Interns DB
// status moves on to Former (the Offboarding Progress roster only lists status "Offboarding").
// Read-only. `completedAt` is the plan's recorded completed_at, or — for plans completed before that
// was recorded — the date its last task was ticked. `anchorDate` is the Final Working Date (Day 0).
// Current status and photo come from the Interns DB when it's reachable.
export async function listOffboardingHistory() {
  const [plans] = await pool.query(
    `SELECT p.id AS planInstanceId, p.employee_id AS employeeId,
            DATE_FORMAT(p.anchor_date, '%Y-%m-%d') AS anchorDate,
            DATE_FORMAT(p.started_at, '%Y-%m-%d') AS startedAt,
            DATE_FORMAT(p.completed_at, '%Y-%m-%d') AS recordedCompletedAt,
            e.employee_code AS refNumber, e.first_name, e.last_name, e.status AS localStatus,
            e.intern_external_id AS internId
       FROM offboarding_plan_instances p
       JOIN employees e ON e.id = p.employee_id
      ORDER BY p.id DESC`,
  );
  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.planInstanceId);
  const [tasks] = await pool.query(
    `SELECT ti.plan_instance_id, ti.required, a.completed, UNIX_TIMESTAMP(a.completed_at) AS completedEpoch
       FROM offboarding_task_instances ti
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

export class OffboardingHistoryError extends Error {}

// Deletes ONE completed offboarding plan from Offboarding History — the plan, its task rows and
// their linked activities — permanently. Mirrors onboarding.js's deleteCompletedOnboardingPlan():
// only a completed plan (every required task done) can be deleted, so a plan still in progress is
// never removed by mistake. The person themselves (employee record, Interns DB entry, status, end
// date) is not touched, nor are the shared tasks under Offboarding > Plans. Logged to audit_logs.
//
// One difference from Onboarding: an intern the Interns DB still has in Offboarding gets a plan
// launched automatically whenever they have none (internSync.js's autoLaunchOffboardingPlans()), so
// deleting their record would just create a new plan on the next Offboarding Progress load. It's
// therefore refused until they're no longer in Offboarding (e.g. Former) — or if their current
// status can't be confirmed.
export async function deleteCompletedOffboardingPlan(planInstanceId) {
  const plan = await getRow("offboarding_plan_instances", planInstanceId);
  if (!plan) throw new RowNotFoundError(`No offboarding plan with id ${planInstanceId}.`);

  const tasks = await listInstanceTasks(planInstanceId);
  const required = tasks.filter((t) => t.required);
  if (required.length === 0 || !required.every((t) => t.completed)) {
    throw new OffboardingHistoryError("Only completed offboarding records can be deleted from History.");
  }

  const [[employee]] = await pool.query("SELECT employee_code, first_name, last_name, intern_external_id FROM employees WHERE id = ?", [plan.employee_id]);
  if (employee?.intern_external_id) {
    let intern;
    try {
      intern = await internsClient.getIntern(employee.intern_external_id);
    } catch {
      throw new OffboardingHistoryError("Couldn't confirm this person's current status in the Interns database, so the record wasn't deleted. Please try again.");
    }
    if (intern?.status === "Offboarding") {
      throw new OffboardingHistoryError("This person is still in Offboarding. Their record can be deleted once they're no longer in Offboarding — deleting it now would automatically launch a new offboarding plan for them.");
    }
  }
  const activityIds = tasks.map((t) => t.activity_id).filter(Boolean);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Task rows go with the plan (ON DELETE CASCADE); their activities are deleted explicitly.
    await conn.query("DELETE FROM offboarding_plan_instances WHERE id = ?", [planInstanceId]);
    if (activityIds.length > 0) await conn.query("DELETE FROM activities WHERE id IN (?)", [activityIds]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await logOffboardingLaunch(
    "offboarding_history_deleted",
    plan.employee_id,
    `Deleted completed offboarding plan ${planInstanceId} (${tasks.length} tasks) for ${employee ? `${employee.first_name} ${employee.last_name} (${employee.employee_code})` : `employee ${plan.employee_id}`}.`,
  );
}

// ---------------------------------------------------------------------------
// Automatic Offboarding plan launch. Called for every intern the roster read
// sees in Offboarding (internSync.js's fetchRosterSources(), right after the
// existing 7-day Active -> Offboarding transition). Launches the configured
// Offboarding tasks (Universal + their department, same rule as
// launchInstance()) anchored on their existing internship_end_date as Day 0,
// WITHOUT resaving that date. Never creates a second plan: a per-person MySQL
// advisory lock serialises the check-then-launch, and anyone who already has
// an Offboarding plan (any, active or completed) is left alone.
// ---------------------------------------------------------------------------

async function logOffboardingLaunch(action, entityId, details, { oncePerDay = false } = {}) {
  try {
    if (oncePerDay) {
      const [[seen]] = await pool.query(
        "SELECT id FROM audit_logs WHERE action = ? AND entity = 'employees' AND entity_id = ? AND created_at >= NOW() - INTERVAL 1 DAY LIMIT 1",
        [action, String(entityId)],
      );
      if (seen) return;
    }
    await insertRow("audit_logs", { user_id: "system", action, entity: "employees", entity_id: String(entityId), details: String(details).slice(0, 2000) });
  } catch {
    // logging never blocks the roster
  }
}

/**
 * @param {Object} intern - Interns DB record (status Offboarding, internship_end_date set)
 * @param {Array} departments - Departments service list (already fetched by the roster read)
 * @returns {Promise<{ status: 'launched'|'exists'|'not_launched', planInstanceId?: number, reason?: string }>}
 */
export async function ensureOffboardingPlanForIntern(intern, departments = []) {
  const endDate = intern?.internship_end_date ? String(intern.internship_end_date).slice(0, 10) : null;
  if (!endDate) return { status: "not_launched", reason: "No internship end date." };

  // Same department resolution as the rosters: only a department the Departments service knows.
  const department = departments.find((d) => String(d.id) === String(intern.department_id)) ?? null;
  const tasks = await composeApplicableTasks("intern", department?.id ?? null);
  // Nothing configured under Offboarding > Plans for them yet: no plan, no local writes, no log noise.
  if (tasks.length === 0) return { status: "not_launched", reason: "No Offboarding tasks are configured for them yet." };

  let employee;
  try {
    employee = await resolveOrCreateEmployeeForIntern(intern.id);
  } catch (error) {
    await logOffboardingLaunch("offboarding_plan_auto_launch_failed", intern.id, `Could not create the local record for ${intern.ref_number ?? intern.id}: ${error.message ?? error}`, { oncePerDay: true });
    return { status: "not_launched", reason: String(error.message ?? error) };
  }

  const conn = await pool.getConnection();
  const lockName = `offboarding_launch_${employee.id}`;
  try {
    const [[{ got }]] = await conn.query("SELECT GET_LOCK(?, 15) AS got", [lockName]);
    if (got !== 1) return { status: "not_launched", reason: "Another launch for this person is in progress." };

    const [[existing]] = await conn.query(
      "SELECT id FROM offboarding_plan_instances WHERE employee_id = ? ORDER BY id DESC LIMIT 1",
      [employee.id],
    );
    if (existing) return { status: "exists", planInstanceId: existing.id };

    try {
      const planInstanceId = await launchInstance({
        employeeId: employee.id,
        personType: "intern",
        departmentId: department?.id ?? null,
        anchorDate: endDate,
        syncEndDate: false,
      });
      await logOffboardingLaunch("offboarding_plan_auto_launched", employee.id, `Launched offboarding plan ${planInstanceId} for ${intern.ref_number ?? intern.id}, anchored on internship_end_date ${endDate} (Day 0).`);
      return { status: "launched", planInstanceId };
    } catch (error) {
      await logOffboardingLaunch("offboarding_plan_auto_launch_failed", employee.id, String(error.message ?? error), { oncePerDay: true });
      return { status: "not_launched", reason: String(error.message ?? error) };
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => {});
    conn.release();
  }
}
