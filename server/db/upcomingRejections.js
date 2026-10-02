// Upcoming's Rejected tab, shared by every HR user: Reject records the candidate here
// (upcoming_candidate_rejections) and Restore removes them, instead of each browser keeping its
// own list. It never changes the candidate in the Recruitment system — that's only read, to know
// who the applicant is.
//
// The Recruitment API reuses a deleted applicant's id, so each rejection also stores which
// applicant it was for (applicantKey(): their Recruitment created_at, else their email — only ever
// compared, never shown). A rejection whose key doesn't match the applicant now holding that id
// belonged to someone else and is ignored.
import { pool } from "./pool.js";
import { applicantsClient } from "../clients/applicantsClient.js";
import { ConfigurationError } from "../http/errors.js";

export class UpcomingRejectionError extends Error {}
export class UpcomingApplicantNotFoundError extends Error {}

export function applicantKey(applicant) {
  return applicant.created_at
    ? `created:${String(applicant.created_at).trim()}`
    : `email:${String(applicant.email ?? "").trim().toLowerCase()}`;
}

const TABLE_MISSING_MESSAGE = "Shared Reject/Restore isn't set up on this database yet (run npm run create-upcoming-candidate-rejections-table).";

/**
 * Rejections for the given applicants, keyed by id: { applicantKey, rejectedAt, rejectedBy }.
 * Until the table has been created, there are simply none — Upcoming still loads.
 */
export async function loadRejections(applicantIds) {
  if (applicantIds.length === 0) return new Map();
  try {
    const [rows] = await pool.query(
      `SELECT applicant_id, applicant_key, rejected_at, rejected_by FROM upcoming_candidate_rejections WHERE applicant_id IN (${applicantIds.map(() => "?").join(",")})`,
      applicantIds,
    );
    return new Map(rows.map((r) => [String(r.applicant_id), {
      applicantKey: r.applicant_key,
      rejectedAt: new Date(r.rejected_at).toISOString(),
      rejectedBy: r.rejected_by,
    }]));
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return new Map();
    throw error;
  }
}

async function write(sql, params) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") throw new ConfigurationError(TABLE_MISSING_MESSAGE);
    throw error;
  }
}

/** Moves a candidate to Rejected for every HR user. Rejecting again just refreshes it. */
export async function rejectApplicant(applicantId, rejectedBy) {
  let applicant;
  try {
    applicant = await applicantsClient.getApplicant(applicantId);
  } catch (error) {
    if (/ failed: 404\b/.test(String(error?.message))) throw new UpcomingApplicantNotFoundError(`Applicant ${applicantId} doesn't exist in the Recruitment system.`);
    throw error;
  }
  if (!applicant || String(applicant.id) !== String(applicantId)) {
    throw new UpcomingApplicantNotFoundError(`Applicant ${applicantId} doesn't exist in the Recruitment system.`);
  }
  if (applicant.phase !== "confirmation") {
    throw new UpcomingRejectionError("Only a candidate in Upcoming (the Recruitment confirmation phase) can be rejected here.");
  }
  await write(
    `INSERT INTO upcoming_candidate_rejections (applicant_id, applicant_key, rejected_at, rejected_by) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE applicant_key = VALUES(applicant_key), rejected_at = VALUES(rejected_at), rejected_by = VALUES(rejected_by)`,
    [String(applicantId), applicantKey(applicant), new Date(), rejectedBy ?? null],
  );
}

/** Restores a candidate to the active list for every HR user. Nothing to restore is fine. */
export async function restoreApplicant(applicantId) {
  await write("DELETE FROM upcoming_candidate_rejections WHERE applicant_id = ?", [String(applicantId)]);
}
