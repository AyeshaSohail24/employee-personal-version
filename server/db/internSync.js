// The onboarding/offboarding <-> Interns DB connection. An employee only has
// a link to sync (`intern_external_id`) once POST /applicants/{id}/convert
// has actually pushed them there (db/applicantConversion.js) — everything
// here is a no-op for a non-intern employee.
import { pool } from "./pool.js";
import { getRow, insertRow } from "./crud.js";
import { internsClient } from "../clients/internsClient.js";
import { departmentsClient } from "../clients/departmentsClient.js";

// Read-through: the live Interns DB record for display alongside an
// onboarding/offboarding view, never cached or duplicated locally (SS-13 —
// this app is a consumer of that record, not a second copy of it).
export async function getLinkedIntern(employee) {
  if (!employee?.intern_external_id) return null;
  try {
    return await internsClient.getIntern(employee.intern_external_id);
  } catch {
    return null; // the record failing to load shouldn't break the page it's shown on
  }
}

// AGENTS.md rule 6 — departure automation must be reversible and logged,
// never framed as instant/irreversible. Launching offboarding sets the
// intern's real end date in the Interns DB (the one field that's actually
// theirs to update at this point — see Delete Intern's own guidance in
// internsClient.js: many teams keep the record after an internship simply
// ends, so this never deletes it). Every attempt is written to audit_logs,
// success or failure, the same pattern applicant_conversions uses.
export async function syncOffboardingLaunchToIntern(employeeId, anchorDate) {
  const employee = await getRow("employees", employeeId);
  if (!employee?.intern_external_id) return;

  try {
    await internsClient.updateIntern(employee.intern_external_id, { internship_end_date: anchorDate });
    await insertRow("audit_logs", {
      user_id: "system",
      action: "offboarding_intern_sync",
      entity: "employees",
      entity_id: String(employeeId),
      details: `Set internship_end_date to ${anchorDate} in the Interns DB for ${employee.intern_ref_number ?? employee.intern_external_id}.`,
    });
  } catch (error) {
    await insertRow("audit_logs", {
      user_id: "system",
      action: "offboarding_intern_sync_failed",
      entity: "employees",
      entity_id: String(employeeId),
      details: String(error.message ?? error),
    });
  }
}

function deriveStatus(tasks) {
  if (tasks.length === 0) return "In Progress";
  const required = tasks.filter((t) => t.required);
  const completedRequired = required.filter((t) => t.completed);
  if (required.length > 0 && completedRequired.length === required.length) return "Completed";
  const today = new Date().toISOString().slice(0, 10);
  const needsAttention = required.some((t) => !t.completed && t.due_date && String(t.due_date).slice(0, 10) < today);
  return needsAttention ? "Needs Attention" : "In Progress";
}

function progressPercentage(tasks) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}

// Every real intern (Interns DB, external) cross-referenced with any local
// employee/plan — the view every Onboarding/Offboarding progress page
// actually wants: the real roster, joined with whatever this app itself
// knows about each person, rather than this app's own (currently empty)
// `employees` table treated as the roster.
//
// Batched, not a per-intern loop: the first version queried the plan
// instance and its tasks separately for each intern (2 sequential
// round-trips x 19 interns), which took ~5.5s end to end against the real
// VPS database. Fetching every relevant row in one query per table and
// joining in memory (this app's whole headcount is small — HR PoC scale)
// keeps this to a handful of round-trips regardless of intern count.
async function listInternsWithProgress(stage) {
  const [{ interns }, departments] = await Promise.all([
    internsClient.listInterns({ limit: 100 }),
    departmentsClient.listDepartments().catch(() => []),
  ]);
  const departmentsById = new Map(departments.map((d) => [d.id, d]));

  const [localEmployees] = await pool.query("SELECT * FROM employees WHERE intern_external_id IS NOT NULL");
  const employeeByInternId = new Map(localEmployees.map((e) => [e.intern_external_id, e]));
  const employeeIds = localEmployees.map((e) => e.id);

  const instanceTable = stage === "offboarding" ? "offboarding_plan_instances" : "onboarding_plan_instances";
  const taskTable = stage === "offboarding" ? "offboarding_task_instances" : "onboarding_task_instances";

  const latestInstanceByEmployeeId = new Map();
  const tasksByInstanceId = new Map();

  if (employeeIds.length > 0) {
    const placeholders = employeeIds.map(() => "?").join(",");
    const [instances] = await pool.query(
      `SELECT * FROM ${instanceTable} WHERE employee_id IN (${placeholders}) ORDER BY id DESC`,
      employeeIds,
    );
    // First row per employee_id wins — already ordered id DESC, so that's the latest.
    for (const instance of instances) {
      if (!latestInstanceByEmployeeId.has(instance.employee_id)) {
        latestInstanceByEmployeeId.set(instance.employee_id, instance);
      }
    }

    const instanceIds = [...latestInstanceByEmployeeId.values()].map((i) => i.id);
    if (instanceIds.length > 0) {
      const taskPlaceholders = instanceIds.map(() => "?").join(",");
      const [tasks] = await pool.query(
        `SELECT ti.*, a.completed, a.due_date FROM ${taskTable} ti LEFT JOIN activities a ON a.id = ti.activity_id WHERE ti.plan_instance_id IN (${taskPlaceholders})`,
        instanceIds,
      );
      for (const task of tasks) {
        if (!tasksByInstanceId.has(task.plan_instance_id)) tasksByInstanceId.set(task.plan_instance_id, []);
        tasksByInstanceId.get(task.plan_instance_id).push(task);
      }
    }
  }

  return interns.map((intern) => {
    const localEmployee = employeeByInternId.get(intern.id);
    let plan = null;

    if (localEmployee) {
      const instance = latestInstanceByEmployeeId.get(localEmployee.id);
      if (instance) {
        const tasks = tasksByInstanceId.get(instance.id) ?? [];
        plan = {
          instanceId: instance.id,
          anchorDate: instance.anchor_date,
          status: deriveStatus(tasks),
          progressPercentage: progressPercentage(tasks),
          taskCount: tasks.length,
        };
      }
    }

    const department = departmentsById.get(intern.department_id) ?? null;
    return {
      internId: intern.id,
      refNumber: intern.ref_number,
      fullName: `${intern.first_name} ${intern.last_name}`,
      email: intern.email_address,
      department: department ? { id: department.id, name: department.name } : null,
      mode: intern.mode,
      startDate: intern.internship_start_date,
      endDate: intern.internship_end_date,
      photoUrl: intern.photo_url,
      localEmployeeId: localEmployee ? localEmployee.id : null,
      plan,
    };
  });
}

export const listInternsWithOnboardingStatus = () => listInternsWithProgress("onboarding");
export const listInternsWithOffboardingStatus = () => listInternsWithProgress("offboarding");
