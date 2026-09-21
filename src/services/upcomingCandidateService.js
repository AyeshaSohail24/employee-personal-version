import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { apiClient } from './apiClient.js';
import { filterCandidates, calculateCandidateSummary, countUnreadReplies, RESPONSE_STATUS } from '../domain/candidateDomain.js';

/**
 * Service providing asynchronous data access and querying for Upcoming candidate records.
 *
 * Data flow: the candidate roster itself (name, email, department, position) is real — GET
 * /candidates reads through to the Recruitment API for every applicant at the `confirmation`
 * phase, and now also derives emailStatus/notificationRead from this app's own real
 * candidate_messages table — a real email send (candidateEmailService) and a real reply (IMAP,
 * see server/messaging/imapReplyChecker.js) both land there (server/db/upcomingCandidates.js).
 * Only the offer decision itself — offer type, accept/reject response — has no backend
 * equivalent to read from, so that stays a local overlay keyed by the real candidate id
 * (db.upcomingCandidateOverlay), created lazily with sensible defaults the first time it's
 * touched.
 */

const DEFAULT_OVERLAY = () => ({
  offerType: 'Paid',
  responseStatus: RESPONSE_STATUS.AWAITING,
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
    // Overlay first, real candidate fields last — emailStatus/notificationRead are real
    // (server-derived) and must never be clobbered by the local overlay's own defaults.
    return candidates.map((c) => ({ ...getOverlay(db, c.id), ...c }));
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
