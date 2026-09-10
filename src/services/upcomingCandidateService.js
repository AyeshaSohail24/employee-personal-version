import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import {
  filterCandidates,
  calculateCandidateSummary,
  countUnreadReplies,
  EMAIL_STATUS,
  RESPONSE_STATUS,
} from '../domain/candidateDomain.js';

/**
 * Service providing asynchronous data access and querying for Upcoming candidate records.
 *
 * Data flow (current PoC): mock/seedUpcomingCandidates -> storageEngine -> this service ->
 * Upcoming page. Future: an external interview/recruitment microapp populates the same
 * collection via syncCandidates() (a real backend fetch swapped in behind this same call
 * signature) instead of local seed data — the UI requires no change.
 */

function enrichCandidate(candidate, departments = []) {
  const dept = departments.find((d) => d.id === candidate.departmentId) || null;
  return { ...candidate, department: dept };
}

export const upcomingCandidateService = {
  /**
   * Retrieves all candidates, enriched with resolved Department reference data.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const departments = db.departments || [];
    return candidates.map((c) => enrichCandidate(c, departments));
  },

  /**
   * Retrieves a single candidate by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const all = await this.getAll();
    return all.find((c) => c.id === id) || null;
  },

  /**
   * Queries candidates by scope ('active' pipeline vs. 'rejected' archive), search, and the
   * same filter shape used by the Employees Directory (Department/Offer Type/Email
   * Status/Response), so the query/filter pattern stays consistent app-wide.
   *
   * @param {Object} options
   * @returns {Promise<Array<Object>>}
   */
  async queryCandidates(options = {}) {
    const all = await this.getAll();
    return filterCandidates(all, options);
  },

  /**
   * Computes data-driven pipeline summary counts (Shortlisted/Pending/Sent/Replies/
   * Accepted/Rejected) from the current candidate dataset.
   * @returns {Promise<Object>}
   */
  async getSummary() {
    const all = await this.getAll();
    return calculateCandidateSummary(all);
  },

  /**
   * Counts candidate replies that still require HR attention (drives the notification badge).
   * @returns {Promise<number>}
   */
  async getUnreadReplyCount() {
    const all = await this.getAll();
    return countUnreadReplies(all);
  },

  /**
   * Marks an offer email as sent for a candidate and appends an audit-friendly record to the
   * local candidateEmailLog. Called by candidateEmailService after successful render/validate
   * — never called directly by UI components.
   *
   * @param {string} candidateId
   * @param {{ to: string, cc: string, subject: string, body: string }} emailPayload
   * @returns {Promise<Object>} The updated, enriched candidate
   */
  async markEmailSent(candidateId, emailPayload) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    const nowIso = new Date().toISOString();
    candidates[index] = {
      ...candidates[index],
      emailStatus: EMAIL_STATUS.SENT,
      emailSentAt: nowIso,
      lastEmailSubject: emailPayload.subject,
    };

    const emailLog = db.candidateEmailLog || [];
    emailLog.push({
      id: `mail-${Date.now()}-${candidateId}`,
      candidateId,
      to: emailPayload.to,
      cc: emailPayload.cc || '',
      subject: emailPayload.subject,
      body: emailPayload.body,
      sentAt: nowIso,
    });

    db.upcomingCandidates = candidates;
    db.candidateEmailLog = emailLog;
    saveDatabase(db);

    return this.getById(candidateId);
  },

  /**
   * Records that a candidate replied to their offer email. In the current PoC this is a
   * manual HR action (there is no real inbox); later a backend inbox webhook would call the
   * equivalent of this same operation automatically.
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async recordReply(candidateId) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    candidates[index] = {
      ...candidates[index],
      emailStatus: EMAIL_STATUS.REPLIED,
      repliedAt: new Date().toISOString(),
      notificationRead: false,
    };

    db.upcomingCandidates = candidates;
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Marks a candidate's reply notification as reviewed (clears it from the unread badge
   * count without changing their Email Status/Response).
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async markNotificationRead(candidateId) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    candidates[index] = { ...candidates[index], notificationRead: true };
    db.upcomingCandidates = candidates;
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Accepts a candidate's offer response. Does NOT create an Employee record — acceptance
   * is a distinct, explicit next step reserved for a future dedicated conversion flow.
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async acceptCandidate(candidateId) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    candidates[index] = {
      ...candidates[index],
      responseStatus: RESPONSE_STATUS.ACCEPTED,
      acceptedAt: new Date().toISOString(),
      rejectedAt: null,
    };

    db.upcomingCandidates = candidates;
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Reverses an accidental Accept, letting HR correct the decision. Only the response
   * decision is touched — Email Status, emailSentAt, repliedAt, notes, and the candidate's
   * email log/history are all left exactly as they were.
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async undoAcceptCandidate(candidateId) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }
    if (candidates[index].responseStatus !== RESPONSE_STATUS.ACCEPTED) {
      throw new Error(`Candidate "${candidateId}" is not currently Accepted.`);
    }

    candidates[index] = {
      ...candidates[index],
      responseStatus: RESPONSE_STATUS.AWAITING,
      acceptedAt: null,
    };

    db.upcomingCandidates = candidates;
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Moves a candidate to Rejected. This is a soft move, never a hard delete: the record is
   * preserved (with rejectedAt set) and simply excluded from the active Candidates scope by
   * queryCandidates()/filterCandidates() — it remains visible and restorable in the Rejected tab.
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async rejectCandidate(candidateId) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    candidates[index] = {
      ...candidates[index],
      responseStatus: RESPONSE_STATUS.REJECTED,
      rejectedAt: new Date().toISOString(),
      acceptedAt: null,
    };

    db.upcomingCandidates = candidates;
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Restores a Rejected candidate back to the active pipeline (Awaiting Response).
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async restoreCandidate(candidateId) {
    const db = loadDatabase();
    const candidates = db.upcomingCandidates || [];
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    candidates[index] = {
      ...candidates[index],
      responseStatus: RESPONSE_STATUS.AWAITING,
      rejectedAt: null,
    };

    db.upcomingCandidates = candidates;
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Refreshes Upcoming candidate data from the current source of truth.
   *
   * CURRENT (PoC, no backend): re-reads the local storage-engine database, identically to
   * getAll(). FUTURE: swap the implementation to pull shortlisted candidates from the
   * external interview/recruitment microapp's shared backend/API — the call signature and
   * enriched-array return shape stay the same, so a "Sync Candidates" button requires no
   * change when that happens.
   * @returns {Promise<Array<Object>>}
   */
  async syncCandidates() {
    return this.getAll();
  },
};
