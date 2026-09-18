// The onboarding/offboarding <-> Interns DB connection. An employee only has
// a link to sync (`intern_external_id`) once POST /applicants/{id}/convert
// has actually pushed them there (db/applicantConversion.js) — everything
// here is a no-op for a non-intern employee.
import { pool } from "./pool.js";
import { getRow, insertRow } from "./crud.js";
import { createEmployee, updateEmployee, createEmploymentRecord } from "./employees.js";
import { getEmployeeTypeByCode } from "./orgStructure.js";
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

// Personnel Details' Personal Information section — IC/Passport Number and Home Address are
// collected by the Interns DB at intake but were never mirrored into this app's own `employees`
// table (unlike start/end date, mode, allowance, department), so they're read through live here
// rather than duplicated locally. null for a non-intern employee (no linked Interns DB record to
// read from at all) or if the read-through fails — never fabricated, same fallback contract as
// getLinkedIntern() above. Deliberately NOT resolving role_id here for a "Position" field: that
// service's Roles are an access-control concept for its own admin UI (Admin/Employee/Intern/
// Manager/Supervisor), not a job title — every intern would just show "Intern", duplicating the
// Type field already shown, so it's left out rather than wiring in a technically-present but
// meaningless value.
export async function getInternPersonalDetails(employee) {
  const intern = await getLinkedIntern(employee);
  if (!intern) return null;
  return {
    icPassportNumber: intern.ic_passport_number ?? null,
    homeAddress: intern.home_address ?? null,
  };
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

// Shared by resolveOrCreateEmployeeForIntern() (one intern, on first touch) and
// syncAllInternsToEmployees() (every intern, on demand via "Sync Personnel") — the actual
// "create a local employee row for this Interns DB record" logic lives in exactly one place.
async function createLocalEmployeeFromIntern(intern) {
  const internType = await getEmployeeTypeByCode("INTERN");

  const employeeId = await createEmployee({
    employeeCode: `RZ-${Date.now()}`,
    firstName: intern.first_name,
    lastName: intern.last_name,
    workEmail: intern.email_address,
    workPhone: intern.phone_number,
    employeeTypeId: internType.id,
    status: "Onboarding",
    startDate: intern.internship_start_date,
    contractEndDate: intern.internship_end_date,
    workMode: intern.mode,
    allowance: intern.allowance,
  });
  await updateEmployee(employeeId, { internExternalId: intern.id, internRefNumber: intern.ref_number });

  if (intern.department_id) {
    await createEmploymentRecord(employeeId, {
      departmentId: intern.department_id,
      effectiveFrom: intern.internship_start_date,
    });
  }

  return getRow("employees", employeeId);
}

// The local `employees` row already linked to this intern
// (`intern_external_id`), or — for a real intern the Interns DB knows about
// but this app has never touched (no Applicant conversion ever ran for
// them) — one created on first use, so a plan has somewhere local to
// attach its instance and activities. Mirrors applicantConversion.js's
// Applicants -> employees push, in reverse. Deliberately stays a cheap
// no-op once an employee already exists (called from hot per-view onboarding/
// offboarding code) — it never reconciles existing fields; that's
// syncAllInternsToEmployees()'s job.
export async function resolveOrCreateEmployeeForIntern(internId) {
  const [existing] = await pool.query("SELECT * FROM employees WHERE intern_external_id = ?", [internId]);
  if (existing.length > 0) return existing[0];

  const intern = await internsClient.getIntern(internId);
  return createLocalEmployeeFromIntern(intern);
}

// Mode/Salary always hold a value locally (createEmployee()'s own default), so — unlike
// contract_end_date, where NULL is a real "missing" sentinel — every intern-linked employee has
// to be compared against the Interns DB, not just ones with an obviously-missing field.
function computeInternReconciliation(row, intern) {
  const changes = {};
  if (!row.contract_end_date && intern?.internship_end_date) changes.contractEndDate = intern.internship_end_date;
  if (intern?.mode && intern.mode !== row.work_mode) changes.workMode = intern.mode;
  if (intern?.allowance && intern.allowance !== row.allowance) changes.allowance = intern.allowance;
  return changes;
}

// Powers the "Sync Personnel" button: pulls every intern from the Interns DB (the source of
// truth) and, for each, either creates their local employee record (a real intern this app has
// never touched yet) or reconciles Mode/Salary/End Date against the source if any have drifted
// (see server/scripts/backfillContractEndDates.js's own doc comment for why that drift can
// happen). Unlike resolveOrCreateEmployeeForIntern(), this is meant to be called on demand for a
// full pass, not from hot per-view code. One intern's failure (a transient Interns DB hiccup,
// bad data) is recorded and skipped, never aborting the rest of the batch — a partial sync is
// far more useful than the whole button failing because of a single bad record. `onItem`, if
// given, is called once per intern with { intern, action: 'created'|'updated'|'unchanged'|
// 'failed', changes, error } — the terminal script uses it for per-row progress output; the HTTP
// route (which only wants the final summary) leaves it out.
export async function syncAllInternsToEmployees({ onItem } = {}) {
  const { interns } = await internsClient.listInterns({ limit: 100 });

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const intern of interns ?? []) {
    try {
      const [existing] = await pool.query("SELECT * FROM employees WHERE intern_external_id = ?", [intern.id]);

      if (existing.length === 0) {
        await createLocalEmployeeFromIntern(intern);
        created += 1;
        onItem?.({ intern, action: "created" });
        continue;
      }

      const changes = computeInternReconciliation(existing[0], intern);
      if (Object.keys(changes).length === 0) {
        unchanged += 1;
        onItem?.({ intern, action: "unchanged" });
        continue;
      }
      await updateEmployee(existing[0].id, changes);
      updated += 1;
      onItem?.({ intern, action: "updated", changes });
    } catch (error) {
      failed += 1;
      onItem?.({ intern, action: "failed", error });
    }
  }

  return { created, updated, unchanged, failed, total: interns?.length ?? 0 };
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
