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
import { loadDepartmentAliasMap, resolveDepartment } from "./departmentAliases.js";

export async function listConfirmationCandidates() {
  const [, applicants, jobs, departments, aliasMap] = await Promise.all([
    checkForReplies().catch(() => {}),
    applicantsClient.listApplicants({}),
    applicantsClient.listJobs(),
    departmentsClient.listDepartments().catch(() => []),
    loadDepartmentAliasMap(),
  ]);

  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  // A job's `department` is a plain display string (e.g. "Engineering"), not an id — resolved
  // against the real Departments API by name, or HR's mapping (departmentAliases.js), both
  // ignoring case and extra spaces. Anything still unmatched falls back to a display-only
  // { id: null, name } that the department filter can't select, and `jobDepartment` keeps the
  // original text so HR can map it.

  // Anyone already accepted (converted into an intern — applicantConversion.js) leaves Upcoming
  // straight away, even if moving their Recruitment phase to `completed` failed.
  const [convertedRows] = await pool.query("SELECT DISTINCT applicant_id FROM applicant_conversions WHERE status = 'success'");
  const convertedIds = new Set(convertedRows.map((r) => String(r.applicant_id)));

  const candidates = applicants
    .filter((a) => a.phase === "confirmation" && !convertedIds.has(String(a.id)))
    .map((a) => {
      const job = jobsById.get(a.job_id) ?? null;
      const departmentName = job?.department ?? null;
      const matchedDepartment = departmentName ? resolveDepartment(departmentName, departments, aliasMap) : null;

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
        jobDepartment: departmentName,
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
    `SELECT applicant_id, direction, is_seen, sent_at FROM candidate_messages WHERE applicant_id IN (${placeholders})`,
    candidates.map((c) => c.id),
  );
  const messagesByApplicantId = new Map();
  for (const row of messageRows) {
    const key = String(row.applicant_id);
    if (!messagesByApplicantId.has(key)) messagesByApplicantId.set(key, []);
    messagesByApplicantId.get(key).push(row);
  }

  const shortlistedAtById = await recordShortlistedDates(candidates, messagesByApplicantId);

  return candidates.map((candidate) => {
    const messages = messagesByApplicantId.get(candidate.id) ?? [];
    const hasSent = messages.some((m) => m.direction === "sent");
    const hasReceived = messages.some((m) => m.direction === "received");
    const hasUnseenReply = messages.some((m) => m.direction === "received" && !m.is_seen);
    return {
      ...candidate,
      shortlistedAt: shortlistedAtById.get(candidate.id) ?? null,
      emailStatus: hasReceived ? "Replied" : hasSent ? "Sent" : "Pending",
      notificationRead: !hasUnseenReply,
    };
  });
}

// "Shortlisted" = the date a candidate first appeared in Upcoming. The Recruitment API records no
// shortlisted or phase-change time, so this app notes it itself (upcoming_candidates_seen) the
// first time a candidate shows up in this list, and never changes it afterwards. For candidates
// already in Upcoming before this was recorded, their earliest message is used when older than
// today, since they must have been in Upcoming before HR emailed them.
export async function recordShortlistedDates(candidates, messagesByApplicantId) {
  const ids = candidates.map((c) => c.id);
  const placeholders = ids.map(() => "?").join(",");
  const [seenRows] = await pool.query(
    `SELECT applicant_id, first_seen_at FROM upcoming_candidates_seen WHERE applicant_id IN (${placeholders})`,
    ids,
  );
  const byId = new Map(seenRows.map((r) => [String(r.applicant_id), r.first_seen_at]));

  const now = new Date();
  const newRows = ids
    .filter((id) => !byId.has(id))
    .map((id) => {
      const earliestMessage = (messagesByApplicantId.get(id) ?? [])
        .map((m) => new Date(m.sent_at))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b)[0];
      return [id, earliestMessage && earliestMessage < now ? earliestMessage : now];
    });

  if (newRows.length > 0) {
    // INSERT IGNORE: if two requests race, the first recorded date wins.
    await pool.query("INSERT IGNORE INTO upcoming_candidates_seen (applicant_id, first_seen_at) VALUES ?", [newRows]);
    const [fresh] = await pool.query(
      `SELECT applicant_id, first_seen_at FROM upcoming_candidates_seen WHERE applicant_id IN (${newRows.map(() => "?").join(",")})`,
      newRows.map(([id]) => id),
    );
    for (const r of fresh) byId.set(String(r.applicant_id), r.first_seen_at);
  }

  return new Map([...byId].map(([id, at]) => [id, at instanceof Date ? at.toISOString() : at]));
}
