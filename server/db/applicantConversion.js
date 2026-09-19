// The one place this app hands a person off from the external Applicants DB
// to the external Interns DB, per its own architecture note in
// db/schema_employees.sql: soft-referenced, never a cross-database FK, with
// every attempt recorded in applicant_conversions so a failed push is never
// a silent guess about what already happened.
import { insertRow, updateRow, getRow } from "./crud.js";
import { createEmployee, updateEmployee } from "./employees.js";
import { getEmployeeTypeByCode } from "./orgStructure.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { internsClient } from "../clients/internsClient.js";

// The Interns API requires several fields (ic_passport_number, department_id,
// role_id, mode, allowance, internship_end_date, home_address) that a real
// applicant record (see clients/applicantsClient.js) has no field for —
// confirmed via a live call, a real applicant never carries an IC/passport
// number, home address, or department. Those must be supplied by whoever
// calls this endpoint (HR, at accept time), not guessed from the applicant
// record.
export async function convertApplicant(applicantId, {
  employeeTypeId,
  startDate,
  icPassportNumber,
  internshipEndDate,
  departmentId,
  roleId,
  mode,
  allowance,
  photoUrl,
  homeAddress,
}) {
  const applicant = await applicantsClient.getApplicant(applicantId);
  // Confirmed via a live call (2026-09-18): a real applicant record has
  // first_name/last_name (and a redundant fullName) — its own /openapi.json
  // only documents a single `name` create-time input, which doesn't match
  // what GET actually returns.
  const firstName = applicant.first_name;
  const lastName = applicant.last_name;

  // Resolved by code, not a hardcoded id — employee_types.id depends on seed
  // insertion order, which is not something to assume stays fixed.
  const internType = await getEmployeeTypeByCode("INTERN");
  const resolvedEmployeeTypeId = employeeTypeId ?? internType.id;

  const employeeId = await createEmployee({
    employeeCode: `RZ-${Date.now()}`,
    firstName,
    lastName,
    workEmail: applicant.email,
    workPhone: applicant.phone,
    employeeTypeId: resolvedEmployeeTypeId,
    status: "Onboarding",
    startDate,
    contractEndDate: internshipEndDate ?? null,
    workMode: mode ?? "On-site",
    allowance: allowance ?? "Paid",
    sourceApplicantId: applicantId,
  });

  const conversionId = await insertRow("applicant_conversions", {
    applicant_id: applicantId,
    employee_id: employeeId,
    target_system: "interns_db",
    status: "pending",
  });

  if (resolvedEmployeeTypeId === internType.id) {
    try {
      const intern = await internsClient.createIntern({
        first_name: firstName,
        last_name: lastName,
        ic_passport_number: icPassportNumber,
        internship_start_date: startDate,
        internship_end_date: internshipEndDate,
        email_address: applicant.email,
        phone_number: applicant.phone,
        home_address: homeAddress ?? null,
        department_id: departmentId,
        role_id: roleId,
        mode: mode ?? "On-site",
        allowance: allowance ?? "Paid",
        photo_url: photoUrl ?? null,
      });
      // Also replaces the synthetic RZ-<timestamp> code assigned above (a real ref_number wasn't
      // available until the Interns DB actually created this record) with their real "INT-0017"-
      // style id — same reasoning as internSync.js's createLocalEmployeeFromIntern(). Left as the
      // synthetic code if this push fails (the catch block below), since claiming a ref_number
      // that was never actually assigned would be worse than an ugly placeholder.
      await updateEmployee(employeeId, { internExternalId: intern.id, internRefNumber: intern.ref_number, employeeCode: intern.ref_number });
      await updateRow("applicant_conversions", conversionId, {
        status: "success",
        external_id: intern.id,
        external_ref_number: intern.ref_number,
        pushed_at: new Date(),
      });
    } catch (error) {
      await updateRow("applicant_conversions", conversionId, {
        status: "failed",
        response_message: String(error.message ?? error),
      });
    }
  }

  await applicantsClient.moveApplicantPhase(applicantId, "completed").catch(() => {});

  return {
    employee: await getRow("employees", employeeId),
    conversion: await getRow("applicant_conversions", conversionId),
  };
}
