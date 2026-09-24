// The onboarding/offboarding <-> Interns DB connection. An employee only has
// a link to sync (`intern_external_id`) once POST /applicants/{id}/convert
// has actually pushed them there (db/applicantConversion.js) — everything
// here is a no-op for a non-intern employee.
import { pool } from "./pool.js";
import { getRow, insertRow } from "./crud.js";
import { createEmployee, updateEmployee, createEmploymentRecord } from "./employees.js";
import { getEmployeeTypeByCode } from "./orgStructure.js";
import { hydrateEmployees } from "./employeeHydration.js";
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
// rather than duplicated locally. Takes the already-resolved `intern` record (not the employee)
// so a caller that also needs applyInternOverlay() below for the same person — e.g. GET
// /employees/{id} — fetches it once via getLinkedIntern() and reuses it for both, rather than two
// separate live calls for one page. null for a non-intern employee (no linked Interns DB record at
// all) or a null `intern` — never fabricated. Deliberately NOT resolving role_id here for a
// "Position" field: that service's Roles are an access-control concept for its own admin UI
// (Admin/Employee/Intern/Manager/Supervisor), not a job title — every intern would just show
// "Intern", duplicating the Type field already shown, so it's left out rather than wiring in a
// technically-present but meaningless value.
export function getInternPersonalDetails(intern) {
  if (!intern) return null;
  return {
    icPassportNumber: intern.ic_passport_number ?? null,
    homeAddress: intern.home_address ?? null,
    photoUrl: intern.photo_url ?? null,
  };
}

// The actual field-overlay transform, shared by overlayInternFields() below (the bulk GET
// /employees list) and GET /employees/{id} (Personnel Details) — one definition of "what a live
// intern record overrides on a hydrated employee," so the two read paths can never quietly drift
// apart on which fields are live vs. stale-tolerant. Pure and read-only: no store is touched here.
export function applyInternOverlay(employee, intern) {
  return {
    ...employee,
    employeeId: intern.ref_number ?? employee.employeeId,
    status: intern.status ?? employee.status,
    workMode: intern.mode ?? employee.workMode,
    allowance: intern.allowance ?? employee.allowance,
    startDate: intern.internship_start_date ?? employee.startDate,
    contractEndDate: intern.internship_end_date ?? employee.contractEndDate,
    photoUrl: intern.photo_url ?? employee.photoUrl ?? null,
  };
}

// Resolves the signed-in gateway user's own photo for the app header — the
// identity token itself carries no picture claim (sub/email/name/role only,
// per MICROAPP_AUTH.md), so this follows that same doc's documented pattern
// for turning a bare email into real data: match it against this app's own
// employees table, then read through to their linked intern record if they
// have one. Returns null for anyone with no local employee record, or no
// linked intern (e.g. a pure HR/Admin account) — never a broken image.
export async function getPhotoUrlForEmail(email) {
  if (!email) return null;
  const [rows] = await pool.query("SELECT * FROM employees WHERE work_email = ? LIMIT 1", [email]);
  const employee = rows[0];
  if (!employee) return null;
  const intern = await getLinkedIntern(employee);
  return intern?.photo_url ?? null;
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

// AGENTS.md rule 6 (same discipline as syncOffboardingLaunchToIntern above and
// autoTransitionToOffboarding below) — moves a real intern's status on from Onboarding to Active
// once their onboarding plan (server/db/onboarding.js) is genuinely Completed, keeping BOTH the
// Interns DB and the local `employees.status` column in sync. Two independent data stores, no
// shared transaction possible between an external HTTP API and a local MySQL row — so each step
// below re-checks its OWN current state immediately before writing, rather than trusting a value
// read earlier or assuming the other store's write already landed. That makes the whole function
// safe to call again after a partial failure: a retry only repeats whichever step didn't already
// succeed, never re-issues a write that already landed, and never overwrites a status that has
// since moved on to something else (Active/Offboarding/Former) via a different path.
//
// Ordering: the Interns DB is updated FIRST. It is what most of this app actually reads for
// status (overlayInternFields() above overrides `employee.status` with `intern.status` on every
// GET /employees for an intern-linked person — Personnel/Dashboard/Onboarding-Offboarding
// filtering all read through that), so getting it right matters most; if it fails, the local
// column is deliberately left untouched too, rather than showing "Active" locally while the
// actual source of truth this app treats as authoritative still says otherwise. The local write in
// step 2 is independent of whether step 1 ran just now or already succeeded on an earlier call —
// it re-reads nothing further, just checks the `employee` row fetched at the top (never touched by
// step 1), so a retry that finds the Interns DB already Active still fixes a lagging local row.
//
// Retry path: no background job/queue exists in this app, so recovery from a partial failure is
// the existing UI action already available on a Completed plan — reopening and re-completing any
// one task fires setTaskInstanceCompleted() -> this function again. Both steps below are pure
// no-ops once already consistent, so a retry never double-writes or re-logs a step that already
// succeeded; only genuinely-still-stale state is touched. Every attempt (each step, success or
// failure) is logged to audit_logs. A no-op end to end for a non-intern employee (no
// intern_external_id to resolve at all) — this transition only ever applies to interns.
export async function activateInternOnOnboardingComplete(employeeId) {
  const employee = await getRow("employees", employeeId);
  if (!employee?.intern_external_id) return;
  const internId = employee.intern_external_id;

  // Step 1 — Interns DB. Re-read fresh; never write blind, never overwrite a status that has
  // already moved past Onboarding to something other than Active (Offboarding/Former).
  let intern;
  try {
    intern = await internsClient.getIntern(internId);
  } catch {
    return; // can't verify the current status — never write blind to either store
  }

  if (intern.status === "Onboarding") {
    try {
      await internsClient.updateIntern(internId, { status: "Active" });
      await insertRow("audit_logs", {
        user_id: "system",
        action: "intern_status_auto_active",
        entity: "interns",
        entity_id: String(internId),
        details: `Moved ${intern.first_name} ${intern.last_name} (${intern.ref_number}) from Onboarding to Active in the Interns DB — onboarding plan completed for employee ${employeeId}.`,
      });
    } catch (error) {
      await insertRow("audit_logs", {
        user_id: "system",
        action: "intern_status_auto_active_failed",
        entity: "interns",
        entity_id: String(internId),
        details: String(error.message ?? error),
      });
      // The Interns DB write failed — leave the local record untouched rather than getting the
      // two stores out of sync in the other direction. A later retry re-attempts both steps.
      return;
    }
  } else if (intern.status !== "Active") {
    return; // already moved on to Offboarding/Former — never overwritten by either step
  }

  // Step 2 — local employees.status, brought into sync with the Interns DB's now-current Active
  // status. Uses updateEmployee(), the same existing local-update helper every other status write
  // in this app already goes through — no direct SQL, no second write path.
  if (employee.status === "Onboarding") {
    try {
      await updateEmployee(employeeId, { status: "Active" });
      await insertRow("audit_logs", {
        user_id: "system",
        action: "employee_status_auto_active",
        entity: "employees",
        entity_id: String(employeeId),
        details: `Moved employee ${employeeId} (${employee.employee_code}) from Onboarding to Active locally, matching the Interns DB — onboarding plan completed.`,
      });
    } catch (error) {
      await insertRow("audit_logs", {
        user_id: "system",
        action: "employee_status_auto_active_failed",
        entity: "employees",
        entity_id: String(employeeId),
        details: String(error.message ?? error),
      });
      // Interns DB is already Active at this point; the local row stays stale until a retry
      // (reopen + re-complete a task) succeeds — reported via audit_logs, not silently dropped.
    }
  }
}

// Shared by resolveOrCreateEmployeeForIntern() (one intern, on first touch) and
// syncAllInternsToEmployees() (every intern, on demand via "Sync Personnel") — the actual
// "create a local employee row for this Interns DB record" logic lives in exactly one place.
async function createLocalEmployeeFromIntern(intern) {
  const internType = await getEmployeeTypeByCode("INTERN");

  const employeeId = await createEmployee({
    // The Interns DB's own ref_number (e.g. "INT-0017") is this person's real, already-visible
    // identifier there — using it here too (instead of a synthetic RZ-<timestamp> code) means
    // Personnel ID matches what that source of truth already calls them, everywhere it's shown
    // in this app (it's read from this single employee_code column, not special-cased per view).
    employeeCode: intern.ref_number,
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

// Mode/Salary/employee_code always hold a value locally (createEmployee()'s own defaults/prior
// behavior), so — unlike contract_end_date, where NULL is a real "missing" sentinel — every
// intern-linked employee has to be compared against the Interns DB, not just ones with an
// obviously-missing field. employee_code catches anyone created before the ref_number fix above
// (they'd have a synthetic RZ-<timestamp> code instead of their real "INT-0017"-style id).
function computeInternReconciliation(row, intern) {
  const changes = {};
  if (!row.contract_end_date && intern?.internship_end_date) changes.contractEndDate = intern.internship_end_date;
  if (intern?.mode && intern.mode !== row.work_mode) changes.workMode = intern.mode;
  if (intern?.allowance && intern.allowance !== row.allowance) changes.allowance = intern.allowance;
  if (intern?.ref_number && intern.ref_number !== row.employee_code) changes.employeeCode = intern.ref_number;
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
  const { interns } = await internsClient.listAllInterns();

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

// Fetches the full interns list for overlayInternFields() below, resolving to null (not throwing)
// on any failure — the one thing a caller needs to be able to kick this off early (before it even
// knows whether any employee is intern-linked) and run it alongside unrelated local DB work
// (MICROAPP_PERFORMANCE.md §2), rather than only starting it after that work finishes.
export async function fetchInternsForOverlay() {
  try {
    const { interns } = await internsClient.listAllInterns();
    return interns ?? [];
  } catch {
    return null;
  }
}

// Read-only live overlay, applied to an already-hydrated employee LIST (the bulk GET /employees
// path — GET /employees/{id} applies the same applyInternOverlay() transform directly against the
// one intern record it already fetches, rather than this list-oriented batch lookup). Every
// intern-linked employee's Personnel ID/Status/Mode/Allowance/Start Date/Contract End Date is
// replaced in memory with whatever the Interns DB (the source of truth) currently reports — the
// same set of fields createLocalEmployeeFromIntern() pulls from there when a record is first
// created. Nothing is written to either the local employees table or the Interns DB; nothing here
// calls createEmployee/updateEmployee/createEmploymentRecord or internsClient.createIntern/
// updateIntern/deleteIntern. Wired into GET /employees itself (not only the Sync button — see
// server/routes/employees.js), so a full browser refresh shows the same live values Sync does,
// instead of reverting to a stale local snapshot the next time the page loads; "Sync Personnel" is
// then just an explicit, on-demand re-fetch of this same always-live data via GET /employees/sync.
// A real intern the Interns DB knows about but this app has never locally created a record for has
// no local row here to overlay onto and so never appears from this alone — that would require a
// write (createEmployee), which this never does.
//
// `prefetchedInterns` (optional): the caller may pass an already-in-flight fetch of the interns
// list instead of letting this function start its own — see fetchInternsForOverlay() below and
// server/routes/employees.js's listEmployeesLive(), which kicks that fetch off before the local DB
// hydration work even starts (MICROAPP_PERFORMANCE.md §2), rather than only starting it once
// hydration finishes.
export async function overlayInternFields(hydratedEmployees, prefetchedInterns) {
  if (!hydratedEmployees.some((e) => e.internExternalId)) return hydratedEmployees;

  const interns = prefetchedInterns !== undefined ? prefetchedInterns : await fetchInternsForOverlay();
  if (!interns) return hydratedEmployees; // unreachable — show the local snapshot as-is rather than failing the whole page load
  const internsById = new Map(interns.map((intern) => [intern.id, intern]));

  // The Interns DB is the source of truth for who exists: an intern-linked employee whose intern
  // is no longer there (deleted upstream) is dropped from the result, not shown as a stale
  // snapshot. Hidden only — the local row itself is left untouched, so this stays reversible.
  return hydratedEmployees.flatMap((employee) => {
    if (!employee.internExternalId) return [employee];
    const intern = internsById.get(employee.internExternalId);
    if (!intern) return [];
    return [applyInternOverlay(employee, intern)];
  });
}

// True only when the Interns DB definitively says this employee's linked intern no longer exists
// (404). Any other failure (network, 5xx) is "unknown", never "deleted" — same never-break-the-page
// stance as getLinkedIntern().
export async function isLinkedInternDeleted(employee) {
  if (!employee?.intern_external_id) return false;
  try {
    await internsClient.getIntern(employee.intern_external_id);
    return false;
  } catch (error) {
    return error?.status === 404;
  }
}

// MICROAPP_PERFORMANCE.md §2 — GET /employees/{id} needs both "the live intern record" (for
// applyInternOverlay()/getInternPersonalDetails()) and "has it been deleted upstream" (to 404 the
// whole page), which used to mean two separate internsClient.getIntern() calls for the same person
// (getLinkedIntern() + isLinkedInternDeleted() above, still used as-is elsewhere — onboarding.js/
// offboarding.js only ever need one or the other, not both). This does it in one fetch: `deleted`
// is true only on a definitive 404, the same distinction isLinkedInternDeleted() makes, so a
// transient failure still leaves `deleted: false` and simply shows a null intern rather than a
// false 404.
export async function getLinkedInternForDetails(employee) {
  if (!employee?.intern_external_id) return { intern: null, deleted: false };
  try {
    const intern = await internsClient.getIntern(employee.intern_external_id);
    return { intern, deleted: false };
  } catch (error) {
    return { intern: null, deleted: error?.status === 404 };
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

// AGENTS.md rule 6 (same discipline as syncOffboardingLaunchToIntern below)
// — moves a real Active intern's status on to Offboarding once their
// internship_end_date is 7 days away or less (0 = ends today; negative =
// already past it, still transitioned rather than left stuck on Active
// forever). A forward-only, easily-reversible field change, never anything
// destructive — every attempt is logged to audit_logs, success or failure.
// Mutates each matched `intern` object's own `.status` in place so the
// SAME request's Onboarding/Offboarding status filter (below) sees the
// transition immediately, not only on a later reload.
async function autoTransitionToOffboarding(interns) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  for (const intern of interns) {
    if (intern.status !== "Active" || !intern.internship_end_date) continue;
    const end = new Date(intern.internship_end_date);
    if (Number.isNaN(end.getTime())) continue;
    const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    const daysLeft = Math.round((endUtc - todayUtc) / (24 * 60 * 60 * 1000));
    if (daysLeft > 7) continue;

    try {
      await internsClient.updateIntern(intern.id, { status: "Offboarding" });
      intern.status = "Offboarding";
      await insertRow("audit_logs", {
        user_id: "system",
        action: "intern_status_auto_offboarding",
        entity: "interns",
        entity_id: String(intern.id),
        details: `Moved ${intern.first_name} ${intern.last_name} (${intern.ref_number}) from Active to Offboarding — ${daysLeft} day(s) left on internship_end_date ${intern.internship_end_date}.`,
      });
    } catch (error) {
      await insertRow("audit_logs", {
        user_id: "system",
        action: "intern_status_auto_offboarding_failed",
        entity: "interns",
        entity_id: String(intern.id),
        details: String(error.message ?? error),
      });
    }
  }
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
//
// MICROAPP_PERFORMANCE.md §2 — the external half (fetchRosterSources()) and the local plan/task
// queries (loadLocalPlanProgress()) don't depend on each other, so they run together. A caller that
// already has the external half — onboarding.js re-reading plans right after auto-launching some —
// passes it as `sources` so only the local half re-runs, instead of re-fetching every intern.
export async function fetchRosterSources() {
  const [{ interns }, departments] = await Promise.all([
    internsClient.listAllInterns(),
    departmentsClient.listDepartments().catch(() => []),
  ]);
  await autoTransitionToOffboarding(interns);
  return { interns, departments };
}

async function listInternsWithProgress(stage, sources) {
  const [{ interns, departments }, { employeeByInternId, latestInstanceByEmployeeId, tasksByInstanceId }] = await Promise.all([
    sources ?? fetchRosterSources(),
    loadLocalPlanProgress(stage),
  ]);
  const departmentsById = new Map(departments.map((d) => [d.id, d]));

  const results = buildRosterRows(interns, departmentsById, employeeByInternId, latestInstanceByEmployeeId, tasksByInstanceId);

  // Each page only shows interns the Interns DB itself currently has in that
  // exact lifecycle stage (its own status enum: Onboarding/Active/
  // Offboarding/Former — see internsClient.js's getStatusEnum()) — not every
  // intern regardless of where they actually are, and not a local proxy like
  // "close to their end date". Trusts that field as the source of truth
  // rather than a plan already existing here: once HR moves someone's real
  // status on (e.g. Onboarding -> Active), they stop appearing on this page
  // even if a local plan instance is still around.
  const expectedStatus = stage === "offboarding" ? "Offboarding" : "Onboarding";
  return results.filter((intern) => intern.status === expectedStatus);
}

async function loadLocalPlanProgress(stage) {
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

  return { employeeByInternId, latestInstanceByEmployeeId, tasksByInstanceId };
}

function buildRosterRows(interns, departmentsById, employeeByInternId, latestInstanceByEmployeeId, tasksByInstanceId) {
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
      status: intern.status,
      mode: intern.mode,
      startDate: intern.internship_start_date,
      endDate: intern.internship_end_date,
      photoUrl: intern.photo_url,
      localEmployeeId: localEmployee ? localEmployee.id : null,
      plan,
    };
  });
}

export const listInternsWithOnboardingStatus = (sources) => listInternsWithProgress("onboarding", sources);
export const listInternsWithOffboardingStatus = (sources) => listInternsWithProgress("offboarding", sources);
