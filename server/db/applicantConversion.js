// The one place this app hands a person off from the external Applicants DB
// to the external Interns DB, per its own architecture note in
// db/schema_employees.sql: soft-referenced, never a cross-database FK, with
// every successful hand-off recorded in applicant_conversions.
//
// Accepting a candidate on the Upcoming page runs this. Order matters:
//  1. Create the intern in the Interns DB (the source of truth for interns)
//     with status Onboarding. If that fails, nothing else is written, so HR
//     can fix the details and try again.
//  2. Create/link the local employees record from that intern (the same
//     helper the Onboarding page uses), so Personnel shows them as Onboarding
//     with their department, and record the conversion.
//  3. Move the applicant to the `completed` phase in the Recruitment API.
//     GET /candidates also hides anyone with a successful conversion, so the
//     candidate leaves Upcoming even if this last step fails.
// The Onboarding page then lists them (it reads Onboarding interns from the
// Interns DB) and auto-launches their onboarding plan.
import { pool } from "./pool.js";
import { insertRow, getRow } from "./crud.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { internsClient } from "../clients/internsClient.js";
import { resolveOrCreateEmployeeForIntern } from "./internSync.js";

export class ConversionError extends Error {}

const MODES = ["On-site", "Remote", "Hybrid"];
const ALLOWANCES = ["Paid", "Unpaid"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// The Interns API requires several fields (ic_passport_number, home_address,
// internship_end_date, department_id, …) that an applicant record has no
// field for — confirmed via a live call. HR supplies them when accepting.
function validateInput(input) {
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const fields = {
    startDate: text(input.startDate),
    internshipEndDate: text(input.internshipEndDate),
    icPassportNumber: text(input.icPassportNumber),
    phone: text(input.phone),
    homeAddress: text(input.homeAddress),
    departmentId: text(input.departmentId),
    mode: text(input.mode) || "On-site",
    allowance: text(input.allowance) || "Paid",
  };
  const missing = [];
  if (!DATE_PATTERN.test(fields.startDate)) missing.push("internship start date");
  if (!DATE_PATTERN.test(fields.internshipEndDate)) missing.push("internship end date");
  if (!fields.icPassportNumber) missing.push("IC / passport number");
  if (!fields.phone) missing.push("phone number");
  if (!fields.homeAddress) missing.push("home address");
  if (!fields.departmentId) missing.push("department");
  if (missing.length > 0) throw new ConversionError(`Please fill in: ${missing.join(", ")}.`);
  if (fields.internshipEndDate < fields.startDate) throw new ConversionError("The internship end date must be on or after the start date.");
  if (!MODES.includes(fields.mode)) throw new ConversionError(`Work mode must be one of: ${MODES.join(", ")}.`);
  if (!ALLOWANCES.includes(fields.allowance)) throw new ConversionError(`Allowance must be one of: ${ALLOWANCES.join(", ")}.`);
  return { ...fields, photoUrl: text(input.photoUrl) || null, roleId: text(input.roleId) || null };
}

export async function getSuccessfulConversion(applicantId) {
  const [rows] = await pool.query(
    "SELECT * FROM applicant_conversions WHERE applicant_id = ? AND status = 'success' ORDER BY id DESC LIMIT 1",
    [applicantId],
  );
  return rows[0] ?? null;
}

export async function convertApplicant(applicantId, input = {}) {
  const fields = validateInput(input);

  const existing = await getSuccessfulConversion(applicantId);
  if (existing) {
    throw new ConversionError(`This candidate was already accepted and added to the Interns database as ${existing.external_ref_number ?? "an intern"}.`);
  }

  const applicant = await applicantsClient.getApplicant(applicantId);
  if (!applicant) throw new ConversionError("This applicant no longer exists in the Recruitment system.");

  // Confirmed via a live call (2026-09-18): a real applicant record has
  // first_name/last_name (and a redundant fullName).
  const firstName = applicant.first_name || String(applicant.fullName ?? "").split(" ")[0] || "";
  const lastName = applicant.last_name || String(applicant.fullName ?? "").split(" ").slice(1).join(" ") || "";

  // 1. Interns DB first — if this fails, nothing local has been written.
  let intern;
  try {
    intern = await internsClient.createIntern({
      first_name: firstName,
      last_name: lastName,
      ic_passport_number: fields.icPassportNumber,
      internship_start_date: fields.startDate,
      internship_end_date: fields.internshipEndDate,
      email_address: applicant.email,
      phone_number: fields.phone,
      home_address: fields.homeAddress,
      department_id: fields.departmentId,
      role_id: fields.roleId,
      mode: fields.mode,
      allowance: fields.allowance,
      photo_url: fields.photoUrl,
      status: "Onboarding",
    });
  } catch (error) {
    throw new ConversionError(`The Interns database didn't accept this intern, so nothing was changed. ${String(error.message ?? error).replace(/^Interns API [^:]+: /, "")}`);
  }
  if (!intern?.id) throw new ConversionError("The Interns database didn't return the new intern's id, so nothing else was changed.");

  // 2. Local employee (linked by intern id, with department) + conversion record.
  let employee;
  try {
    employee = await resolveOrCreateEmployeeForIntern(intern.id);
    await pool.query("UPDATE employees SET source_applicant_id = ? WHERE id = ?", [applicantId, employee.id]);
    await insertRow("applicant_conversions", {
      applicant_id: applicantId,
      employee_id: employee.id,
      target_system: "interns_db",
      status: "success",
      external_id: intern.id,
      external_ref_number: intern.ref_number ?? null,
      pushed_at: new Date(),
    });
  } catch (error) {
    // The intern exists in the Interns DB, which is what Onboarding/Personnel read from; the
    // local record is created automatically the next time either page loads.
    throw new ConversionError(`${firstName} was added to the Interns database as ${intern.ref_number ?? intern.id}, but this app couldn't finish its own record (${String(error.message ?? error)}). Open the Onboarding page to complete it — don't accept them again.`);
  }

  // 3. Recruitment API phase — best effort; the candidate is already hidden from Upcoming.
  let phaseMoved = true;
  try {
    await applicantsClient.moveApplicantPhase(applicantId, "completed");
  } catch (error) {
    phaseMoved = false;
    await pool.query(
      "UPDATE applicant_conversions SET response_message = ? WHERE applicant_id = ? AND status = 'success'",
      [`Recruitment phase not updated: ${String(error.message ?? error)}`.slice(0, 1000), applicantId],
    ).catch(() => {});
  }

  return {
    employee: await getRow("employees", employee.id),
    intern: { id: intern.id, refNumber: intern.ref_number ?? null, status: "Onboarding" },
    conversion: await getSuccessfulConversion(applicantId),
    phaseMoved,
  };
}
