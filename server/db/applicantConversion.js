// The one place this app hands a person off from the external Applicants DB
// to the external Interns DB, per its own architecture note in
// db/schema_employees.sql: soft-referenced, never a cross-database FK, with
// every attempt recorded in applicant_conversions so a failed push is never
// a silent guess about what already happened.
import { insertRow, updateRow, getRow } from "./crud.js";
import { createEmployee, updateEmployee } from "./employees.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { internsClient } from "../clients/internsClient.js";

const INTERN_EMPLOYEE_TYPE_ID = 3; // seeded as 'INTERN' in db/schema_employees.sql

// The Interns API requires several fields (ic_passport_number, department_id,
// role_id, mode, allowance, internship_end_date) that the Applicants DB's own
// schema (schema_applicants.sql) has no column for — an applicant is never
// asked for an IC/passport number or assigned a department during hiring.
// Those must be supplied by whoever calls this endpoint (HR, at accept time),
// not guessed from the applicant record.
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
}) {
  const applicant = await applicantsClient.getApplicant(applicantId);

  const employeeId = await createEmployee({
    employeeCode: `RZ-${Date.now()}`,
    firstName: applicant.first_name,
    lastName: applicant.last_name,
    workEmail: applicant.email,
    workPhone: applicant.phone,
    employeeTypeId: employeeTypeId ?? INTERN_EMPLOYEE_TYPE_ID,
    status: "Onboarding",
    startDate,
    sourceApplicantId: applicantId,
  });

  const conversionId = await insertRow("applicant_conversions", {
    applicant_id: applicantId,
    employee_id: employeeId,
    target_system: "interns_db",
    status: "pending",
  });

  if ((employeeTypeId ?? INTERN_EMPLOYEE_TYPE_ID) === INTERN_EMPLOYEE_TYPE_ID) {
    try {
      const intern = await internsClient.createIntern({
        first_name: applicant.first_name,
        last_name: applicant.last_name,
        ic_passport_number: icPassportNumber,
        internship_start_date: startDate,
        internship_end_date: internshipEndDate,
        email_address: applicant.email,
        phone_number: applicant.phone,
        home_address: applicant.home_address ?? null,
        department_id: departmentId,
        role_id: roleId,
        mode: mode ?? "On-site",
        allowance: allowance ?? "Paid",
        photo_url: photoUrl ?? null,
      });
      await updateEmployee(employeeId, { internExternalId: intern.id, internRefNumber: intern.ref_number });
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

  await applicantsClient.markApplicantHired(applicantId).catch(() => {});

  return {
    employee: await getRow("employees", employeeId),
    conversion: await getRow("applicant_conversions", conversionId),
  };
}
