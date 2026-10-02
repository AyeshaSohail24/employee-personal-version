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

// The Recruitment API reuses an applicant id once that applicant is deleted, so anything this app
// stored under an id (a conversion, messages, a Shortlisted date) from before the current
// applicant's record was created belongs to someone else and must be ignored. Its created_at
// carries no timezone (read as UTC here), so a day's margin keeps the comparison safe.
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
  // straight away, even if moving their Recruitment phase to `completed` failed. A conversion
  // recorded before this applicant's record existed was for a deleted applicant whose id was reused.
  const [convertedRows] = await pool.query("SELECT applicant_id, created_at FROM applicant_conversions WHERE status = 'success'");
  const conversionsById = new Map();
  for (const row of convertedRows) {
    const key = String(row.applicant_id);
    if (!conversionsById.has(key)) conversionsById.set(key, []);
    conversionsById.get(key).push(row.created_at);
  }
  const isConverted = (a) => (conversionsById.get(String(a.id)) ?? [])
    .some((at) => !predatesApplicant(at, parseApiTimestamp(a.created_at)));

  // Someone moved back out of `confirmation` has left Upcoming: forget their Shortlisted date so
  // that, if they come back, it's the date they came back.
  await forgetShortlistedDates(applicants.filter((a) => a.phase !== "confirmation").map((a) => String(a.id)));

  const candidates = applicants
    .filter((a) => a.phase === "confirmation" && !isConverted(a))
    .map((a) => {
      const job = jobsById.get(a.job_id) ?? null;
      const createdAt = parseApiTimestamp(a.created_at);
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
        offerType: a.allowance ?? null,
        resumeAvailable: Boolean(a.resume),
        // Exposed for email placeholders (src/domain/emailPlaceholders.js). Already on every
        // applicant record this request fetches, so no extra call.
        firstName: a.first_name ?? null,
        lastName: a.last_name ?? null,
        proposedStartDate: a.start_date ?? null,
        // When this applicant's Recruitment record was created — the client uses it to leave out
        // messages stored under a reused id (see ID_REUSE_MARGIN_MS above).
        recordCreatedAt: createdAt ? createdAt.toISOString() : null,
      };
    });

  if (candidates.length === 0) return candidates;

  const placeholders = candidates.map(() => "?").join(",");
  const [messageRows] = await pool.query(
    `SELECT applicant_id, direction, is_seen, sent_at FROM candidate_messages WHERE applicant_id IN (${placeholders})`,
    candidates.map((c) => c.id),
  );
  const createdAtById = new Map(candidates.map((c) => [c.id, parseApiTimestamp(c.recordCreatedAt)]));
  const messagesByApplicantId = new Map();
  for (const row of messageRows) {
    const key = String(row.applicant_id);
    if (predatesApplicant(row.sent_at, createdAtById.get(key))) continue; // a previous applicant's
    if (!messagesByApplicantId.has(key)) messagesByApplicantId.set(key, []);
    messagesByApplicantId.get(key).push(row);
  }

  const shortlistedAtById = await recordShortlistedDates(candidates);

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

// "Shortlisted" = the date a candidate came into Upcoming. The Recruitment API records no
// shortlisted or phase-change time, so this app notes it itself (upcoming_candidates_seen) the
// first time a candidate shows up in this list, and keeps it while they stay in Upcoming. It's
// forgotten when they're seen back out of `confirmation` (forgetShortlistedDates()), and a date
// from before their Recruitment record was created belonged to a deleted applicant whose id was
// reused — both start afresh from now.
export async function recordShortlistedDates(candidates) {
  const ids = candidates.map((c) => c.id);
  const placeholders = ids.map(() => "?").join(",");
  const [seenRows] = await pool.query(
    `SELECT applicant_id, first_seen_at FROM upcoming_candidates_seen WHERE applicant_id IN (${placeholders})`,
    ids,
  );
  const byId = new Map(seenRows.map((r) => [String(r.applicant_id), r.first_seen_at]));

  const staleIds = candidates
    .filter((c) => byId.has(c.id) && predatesApplicant(byId.get(c.id), parseApiTimestamp(c.recordCreatedAt)))
    .map((c) => c.id);
  if (staleIds.length > 0) {
    await forgetShortlistedDates(staleIds);
    for (const id of staleIds) byId.delete(id);
  }

  const now = new Date();
  const newRows = ids.filter((id) => !byId.has(id)).map((id) => [id, now]);

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

// Drops the recorded Shortlisted date for applicants no longer in Upcoming (see above).
export async function forgetShortlistedDates(applicantIds) {
  if (applicantIds.length === 0) return;
  await pool.query(
    `DELETE FROM upcoming_candidates_seen WHERE applicant_id IN (${applicantIds.map(() => "?").join(",")})`,
    applicantIds,
  );
}
