import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { apiClient } from './apiClient.js';
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
 * Data flow: the candidate roster itself (name, email, department, position) is real — GET
 * /candidates reads through to the Recruitment API for every applicant at the `confirmation`
 * phase (see server/db/upcomingCandidates.js). This app has no real email/WhatsApp sending or
 * a real inbox yet (see candidateMessagingService's own note), so the offer workflow state that
 * layers on top of a real candidate — offer type, email status, response, notification-read —
 * stays a local overlay keyed by the real candidate id (db.upcomingCandidateOverlay), created
 * lazily with sensible defaults the first time any of it is touched.
 */

const DEFAULT_OVERLAY = () => ({
  offerType: 'Paid',
  emailStatus: EMAIL_STATUS.PENDING,
  responseStatus: RESPONSE_STATUS.AWAITING,
  notificationRead: true,
  emailSentAt: null,
  lastEmailSubject: null,
  repliedAt: null,
  acceptedAt: null,
  rejectedAt: null,
});

function getOverlay(db, candidateId) {
  const overlays = db.upcomingCandidateOverlay || {};
  return { ...DEFAULT_OVERLAY(), ...overlays[candidateId] };
}

function setOverlay(db, candidateId, patch) {
  const overlays = db.upcomingCandidateOverlay || {};
  overlays[candidateId] = { ...getOverlay(db, candidateId), ...patch };
  db.upcomingCandidateOverlay = overlays;
  return overlays[candidateId];
}

export const upcomingCandidateService = {
  /**
   * Retrieves every real candidate at the confirmation phase, merged with this app's own local
   * offer-workflow overlay for each.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const { candidates } = await apiClient.get('/candidates');
    const db = loadDatabase();
    return candidates.map((c) => ({ ...c, ...getOverlay(db, c.id) }));
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
    const nowIso = new Date().toISOString();
    setOverlay(db, candidateId, {
      emailStatus: EMAIL_STATUS.SENT,
      emailSentAt: nowIso,
      lastEmailSubject: emailPayload.subject,
    });

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
    setOverlay(db, candidateId, {
      emailStatus: EMAIL_STATUS.REPLIED,
      repliedAt: new Date().toISOString(),
      notificationRead: false,
    });
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
    setOverlay(db, candidateId, { notificationRead: true });
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Accepts a candidate's offer response. Does NOT create an Employee record — acceptance
   * is a distinct, explicit next step reserved for a future dedicated conversion flow
   * (POST /applicants/{applicantId}/convert already exists server-side for that).
   * @param {string} candidateId
   * @returns {Promise<Object>}
   */
  async acceptCandidate(candidateId) {
    const db = loadDatabase();
    setOverlay(db, candidateId, {
      responseStatus: RESPONSE_STATUS.ACCEPTED,
      acceptedAt: new Date().toISOString(),
      rejectedAt: null,
    });
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
    if (getOverlay(db, candidateId).responseStatus !== RESPONSE_STATUS.ACCEPTED) {
      throw new Error(`Candidate "${candidateId}" is not currently Accepted.`);
    }
    setOverlay(db, candidateId, {
      responseStatus: RESPONSE_STATUS.AWAITING,
      acceptedAt: null,
    });
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
    setOverlay(db, candidateId, {
      responseStatus: RESPONSE_STATUS.REJECTED,
      rejectedAt: new Date().toISOString(),
      acceptedAt: null,
    });
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
    setOverlay(db, candidateId, {
      responseStatus: RESPONSE_STATUS.AWAITING,
      rejectedAt: null,
    });
    saveDatabase(db);
    return this.getById(candidateId);
  },

  /**
   * Refreshes Upcoming candidate data from the current source of truth (the real Recruitment
   * API, via getAll()).
   * @returns {Promise<Array<Object>>}
   */
  async syncCandidates() {
    return this.getAll();
  },
};
