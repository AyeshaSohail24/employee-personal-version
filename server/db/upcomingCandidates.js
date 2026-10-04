// Upcoming's real candidate roster: applicants at the `confirmation` phase
// in the real Recruitment API (see clients/applicantsClient.js), cross-
// referenced with their job for a department/position display — the same
// read-through, never-cached pattern as internSync.js's intern roster.
// emailStatus/notificationRead are derived here from this app's own real
// candidate_messages table (see checkForReplies()'s doc comment) rather than
// tracked anywhere client-side — a real reply lands there via IMAP, not a
// local flag someone has to remember to set. offerType is likewise real now:
// the Recruitment API added its own `allowance` field (Paid/Unpaid) to an
// applicant record, so it's read straight through here instead of defaulting
// client-side — null for an applicant created before that field existed,
// never fabricated into a guessed Paid/Unpaid. Only the accept/reject
// response decision itself still has no backend equivalent and stays a
// local overlay (upcomingCandidateService.js).
import { pool } from "./pool.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { departmentsClient } from "../clients/departmentsClient.js";
import { checkForReplies } from "../messaging/imapReplyChecker.js";
import { loadDepartmentAliasMap, resolveDepartment } from "./departmentAliases.js";
import { loadRejections, applicantKey } from "./upcomingRejections.js";

// The Recruitment API reuses an applicant id once that applicant is deleted, so anything this app
// stored under an id (a conversion, messages) from before the current applicant's record was
// created belongs to someone else and must be ignored. Its created_at carries no timezone (read
// as UTC here), so a day's margin keeps the comparison safe.
const ID_REUSE_MARGIN_MS = 24 * 60 * 60 * 1000;

function parseApiTimestamp(value) {
  if (!value) return null;
  const text = String(value).trim().replace(" ", "T");
  const date = new Date(/(?:[zZ]|[+-]\d\d:?\d\d)$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function predatesApplicant(at, applicantCreatedAt) {
  if (!at || !applicantCreatedAt) return false;
  const time = new Date(at).getTime();
  return !Number.isNaN(time) && time < applicantCreatedAt.getTime() - ID_REUSE_MARGIN_MS;
}

// Who is in Upcoming: applicants at the `confirmation` phase who haven't already been accepted.
// Anyone already accepted (converted into an intern — applicantConversion.js) leaves Upcoming
// straight away, even if moving their Recruitment phase to `completed` failed. A conversion
// recorded before this applicant's record existed was for a deleted applicant whose id was reused.
// Shared by the Upcoming list and the reminders feed (listUnseenCandidateReplies()).
async function loadIsInUpcoming() {
  const [convertedRows] = await pool.query("SELECT applicant_id, created_at FROM applicant_conversions WHERE status = 'success'");
  const conversionsById = new Map();
  for (const row of convertedRows) {
    const key = String(row.applicant_id);
    if (!conversionsById.has(key)) conversionsById.set(key, []);
    conversionsById.get(key).push(row.created_at);
  }
  const isConverted = (a) => (conversionsById.get(String(a.id)) ?? [])
    .some((at) => !predatesApplicant(at, parseApiTimestamp(a.created_at)));
  return (a) => a.phase === "confirmation" && !isConverted(a);
}

export async function listConfirmationCandidates() {
  const [, applicants, jobs, departments, aliasMap, isInUpcoming] = await Promise.all([
    checkForReplies().catch(() => {}),
    applicantsClient.listApplicants({}),
    applicantsClient.listJobs(),
    departmentsClient.listDepartments().catch(() => []),
    loadDepartmentAliasMap(),
    loadIsInUpcoming(),
  ]);

  const jobsById = new Map(jobs.map((j) => [j.id, j]));
  // A job's `department` is a plain display string (e.g. "Engineering"), not an id — resolved
  // against the real Departments API: HR's mapping for that job's title first (for a job filed
  // under the wrong department in Recruitment), then a name match, then HR's mapping for the
  // department text (departmentAliases.js), all ignoring case and extra spaces. Anything still
  // unmatched falls back to a display-only { id: null, name } that the department filter can't
  // select, and `jobDepartment` keeps the original text so HR can map it.

  const keyById = new Map();
  const candidates = applicants
    .filter(isInUpcoming)
    .map((a) => {
      keyById.set(String(a.id), applicantKey(a));
      const job = jobsById.get(a.job_id) ?? null;
      const createdAt = parseApiTimestamp(a.created_at);
      const departmentName = job?.department ?? null;
      const matchedDepartment = resolveDepartment(departmentName, departments, aliasMap, job?.title ?? null);

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
        jobTitle: job?.title ?? null,
        offerType: a.allowance ?? null,
        resumeAvailable: Boolean(a.resume),
        // Exposed for email placeholders (src/domain/emailPlaceholders.js). Already on every
        // applicant record this request fetches, so no extra call.
        firstName: a.first_name ?? null,
        lastName: a.last_name ?? null,
        proposedStartDate: a.start_date ?? null,
        // "Shortlisted" = when they last entered Upcoming (the `confirmation` phase), straight from
        // the Recruitment API's own phase_changed_at. null ("Not recorded") until Recruitment
        // provides it — never replaced by when this app happened to see them, or by any other
        // timestamp. It's on the applicant's own record, so a reused id can't carry someone else's.
        shortlistedAt: parseApiTimestamp(a.phase_changed_at)?.toISOString() ?? null,
        // When this applicant's Recruitment record was created — the client uses it to leave out
        // messages stored under a reused id (see ID_REUSE_MARGIN_MS above).
        recordCreatedAt: createdAt ? createdAt.toISOString() : null,
      };
    });

  if (candidates.length === 0) return candidates;

  const placeholders = candidates.map(() => "?").join(",");
  const [[messageRows], rejections] = await Promise.all([
    pool.query(
      `SELECT applicant_id, direction, is_seen, sent_at FROM candidate_messages WHERE applicant_id IN (${placeholders})`,
      candidates.map((c) => c.id),
    ),
    loadRejections(candidates.map((c) => c.id)),
  ]);
  const createdAtById = new Map(candidates.map((c) => [c.id, parseApiTimestamp(c.recordCreatedAt)]));
  const messagesByApplicantId = new Map();
  for (const row of messageRows) {
    const key = String(row.applicant_id);
    if (predatesApplicant(row.sent_at, createdAtById.get(key))) continue; // a previous applicant's
    if (!messagesByApplicantId.has(key)) messagesByApplicantId.set(key, []);
    messagesByApplicantId.get(key).push(row);
  }

  return candidates.map((candidate) => {
    const messages = messagesByApplicantId.get(candidate.id) ?? [];
    const hasSent = messages.some((m) => m.direction === "sent");
    const hasReceived = messages.some((m) => m.direction === "received");
    const hasUnseenReply = messages.some((m) => m.direction === "received" && !m.is_seen);
    // Rejected (shared by every HR user — upcomingRejections.js), unless that rejection was for a
    // previous applicant who held this id.
    const rejection = rejections.get(candidate.id);
    const isRejected = Boolean(rejection) && rejection.applicantKey === keyById.get(candidate.id);
    return {
      ...candidate,
      rejected: isRejected,
      rejectedAt: isRejected ? rejection.rejectedAt : null,
      emailStatus: hasReceived ? "Replied" : hasSent ? "Sent" : "Pending",
      notificationRead: !hasUnseenReply,
    };
  });
}

// Unseen replies from candidates currently in Upcoming and not rejected — for the reminders feed
// (server/db/reminders.js). Read-only: it never marks anything seen and never checks the mailbox
// (opening Upcoming does that). Messages from before this applicant's record existed belonged to a
// previous applicant with the same (reused) id and are ignored, same as the Upcoming list.
export async function listUnseenCandidateReplies() {
  const [rows] = await pool.query(
    "SELECT id, applicant_id, sent_at FROM candidate_messages WHERE direction = 'received' AND is_seen = FALSE ORDER BY sent_at ASC",
  );
  if (rows.length === 0) return [];
  const [applicants, isInUpcoming] = await Promise.all([applicantsClient.listApplicants({}), loadIsInUpcoming()]);
  const inUpcoming = applicants.filter(isInUpcoming);
  const rejections = await loadRejections(inUpcoming.map((a) => String(a.id)));
  const byId = new Map(inUpcoming
    .filter((a) => rejections.get(String(a.id))?.applicantKey !== applicantKey(a))
    .map((a) => [String(a.id), a]));

  const replies = new Map();
  for (const row of rows) {
    const applicant = byId.get(String(row.applicant_id));
    if (!applicant || predatesApplicant(row.sent_at, parseApiTimestamp(applicant.created_at))) continue;
    const entry = replies.get(applicant.id) ?? {
      applicantId: String(applicant.id),
      fullName: applicant.fullName || `${applicant.first_name ?? ""} ${applicant.last_name ?? ""}`.trim(),
      count: 0,
    };
    entry.count += 1;
    entry.latestMessageId = row.id;
    entry.latestAt = new Date(row.sent_at).toISOString();
    replies.set(applicant.id, entry);
  }
  return [...replies.values()];
}
