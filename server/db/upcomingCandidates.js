// Upcoming's real candidate roster: applicants at the `confirmation` phase
// in the real Recruitment API (see clients/applicantsClient.js), cross-
// referenced with their job for a department/position display — the same
// read-through, never-cached pattern as internSync.js's intern roster.
// emailStatus/notificationRead are derived here from this app's own real
// candidate_messages table (see checkForReplies()'s doc comment) rather than
// tracked anywhere client-side — a real reply lands there via IMAP, not a
// local flag someone has to remember to set. Purely additive fields with no
// real-world equivalent (offerType, accept/reject response state) still
// live client-side; there's nothing in the Recruitment API or a mailbox to
// derive those from.
import { pool } from "./pool.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { departmentsClient } from "../clients/departmentsClient.js";
import { checkForReplies } from "../messaging/imapReplyChecker.js";

export async function listConfirmationCandidates() {
  const [, applicants, jobs, departments] = await Promise.all([
    checkForReplies().catch(() => {}),
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

  const candidates = applicants
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
        // Exposed for email placeholders (src/domain/emailPlaceholders.js). Already on every
        // applicant record this request fetches, so no extra call.
        firstName: a.first_name ?? null,
        lastName: a.last_name ?? null,
        proposedStartDate: a.start_date ?? null,
      };
    });

  if (candidates.length === 0) return candidates;

  const placeholders = candidates.map(() => "?").join(",");
  const [messageRows] = await pool.query(
    `SELECT applicant_id, direction, is_seen FROM candidate_messages WHERE applicant_id IN (${placeholders})`,
    candidates.map((c) => c.id),
  );
  const messagesByApplicantId = new Map();
  for (const row of messageRows) {
    const key = String(row.applicant_id);
    if (!messagesByApplicantId.has(key)) messagesByApplicantId.set(key, []);
    messagesByApplicantId.get(key).push(row);
  }

  return candidates.map((candidate) => {
    const messages = messagesByApplicantId.get(candidate.id) ?? [];
    const hasSent = messages.some((m) => m.direction === "sent");
    const hasReceived = messages.some((m) => m.direction === "received");
    const hasUnseenReply = messages.some((m) => m.direction === "received" && !m.is_seen);
    return {
      ...candidate,
      emailStatus: hasReceived ? "Replied" : hasSent ? "Sent" : "Pending",
      notificationRead: !hasUnseenReply,
    };
  });
}
