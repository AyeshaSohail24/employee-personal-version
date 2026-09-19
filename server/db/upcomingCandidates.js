// Upcoming's real candidate roster: applicants at the `confirmation` phase
// in the real Recruitment API (see clients/applicantsClient.js), cross-
// referenced with their job for a department/position display — the same
// read-through, never-cached pattern as internSync.js's intern roster.
// Purely additive fields this app tracks itself (offer type, email/response
// workflow state) live in this app's own DB, keyed by the real applicant id
// — see server/db/candidateMessaging.js, which already has real tables for
// messages/documents keyed the same way.
import { applicantsClient } from "../clients/applicantsClient.js";
import { departmentsClient } from "../clients/departmentsClient.js";

export async function listConfirmationCandidates() {
  const [applicants, jobs, departments] = await Promise.all([
    applicantsClient.listApplicants({}),
    applicantsClient.listJobs(),
    departmentsClient.listDepartments().catch(() => []),
  ]);

  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  // A job's `department` is a plain display string (e.g. "Engineering"),
  // not an id — matched by name, case-insensitively, against this app's
  // real Departments API so the department filter can still work when the
  // names line up; unmatched departments fall back to a display-only
  // { id: null, name } the filter simply won't select.
  const departmentsByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

  return applicants
    .filter((a) => a.phase === "confirmation")
    .map((a) => {
      const job = jobsById.get(a.job_id) ?? null;
      const departmentName = job?.department ?? null;
      const matchedDepartment = departmentName ? departmentsByName.get(departmentName.toLowerCase()) : null;

      return {
        id: String(a.id),
        fullName: a.fullName || `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
        email: a.email,
        phone: a.phone,
        positionName: a.position || job?.title || null,
        department: matchedDepartment
          ? { id: matchedDepartment.id, name: matchedDepartment.name }
          : departmentName
            ? { id: null, name: departmentName }
            : null,
        // The Recruitment API exposes no created/shortlisted timestamp on an
        // applicant — their own proposed start date is the closest real
        // signal available for ordering "most recent" first.
        shortlistedAt: a.start_date ?? null,
        resumeAvailable: Boolean(a.resume),
      };
    });
}
