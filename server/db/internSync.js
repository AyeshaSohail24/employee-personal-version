// The onboarding/offboarding <-> Interns DB connection. An employee only has
// a link to sync (`intern_external_id`) once POST /applicants/{id}/convert
// has actually pushed them there (db/applicantConversion.js) — everything
// here is a no-op for a non-intern employee.
import { getRow, insertRow } from "./crud.js";
import { internsClient } from "../clients/internsClient.js";

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
