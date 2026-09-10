/**
 * Domain logic for the Upcoming candidate / offer workflow (pre-onboarding).
 *
 * Upcoming candidates are shortlisted candidates who have NOT yet become Employee
 * Directory records. They live in a separate collection (db.upcomingCandidates) and are
 * only ever converted to an Employee by a later, explicit HR action — never automatically.
 */

export const EMAIL_STATUS = {
  PENDING: 'Pending',
  SENT: 'Sent',
  REPLIED: 'Replied',
};

export const RESPONSE_STATUS = {
  AWAITING: 'Awaiting Response',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
};

export const OFFER_TYPES = ['Paid', 'Unpaid'];

const PLACEHOLDER_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Centralized placeholder interpolation for candidate offer emails. Single source of truth
 * so no component performs scattered .replace() calls. Never silently drops an unresolved
 * placeholder — callers get back the exact list of token names that could not be resolved so
 * Send can be blocked with a clear reason.
 *
 * @param {string} templateText - Raw subject or body containing {{Token}} placeholders
 * @param {Object} tokens - e.g. { ApplicantName, PositionName, HiringEmployeeName }
 * @returns {{ rendered: string, unresolved: string[] }}
 */
export function renderEmailTemplate(templateText, tokens = {}) {
  const unresolved = new Set();

  const rendered = (templateText || '').replace(PLACEHOLDER_PATTERN, (match, tokenName) => {
    const value = tokens[tokenName];
    if (value === undefined || value === null || String(value).trim() === '') {
      unresolved.add(tokenName);
      return match;
    }
    return String(value);
  });

  return { rendered, unresolved: Array.from(unresolved) };
}

/**
 * Builds the token map for a single candidate's offer email. HiringEmployeeName is always
 * supplied by the HR user composing the email (never inferred), so it is passed in rather
 * than derived here.
 *
 * @param {Object} candidate
 * @param {string} hiringEmployeeName
 * @returns {{ ApplicantName: string, PositionName: string, HiringEmployeeName: string }}
 */
export function buildCandidateEmailTokens(candidate, hiringEmployeeName) {
  return {
    ApplicantName: candidate?.fullName || '',
    PositionName: candidate?.positionName || '',
    HiringEmployeeName: hiringEmployeeName || '',
  };
}

const EMAIL_FORMAT_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates an optional CC field that may contain one or more comma/semicolon separated
 * email addresses. Centralized here so the Send Email modal doesn't hand-roll its own regex.
 *
 * @param {string} ccString
 * @returns {{ isValid: boolean, invalidEntries: string[] }}
 */
export function validateCcList(ccString = '') {
  const entries = ccString.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const invalidEntries = entries.filter((entry) => !EMAIL_FORMAT_PATTERN.test(entry));
  return { isValid: invalidEntries.length === 0, invalidEntries };
}

/**
 * Filters the Upcoming candidate list by scope (active pipeline vs. rejected archive),
 * search text, and the same filter shape as the Employees Directory (Department/Offer
 * Type/Email Status/Response), so the UI pattern stays consistent across the app.
 *
 * @param {Array<Object>} candidates
 * @param {Object} options
 * @returns {Array<Object>}
 */
export function filterCandidates(candidates = [], options = {}) {
  const {
    scope = 'active', // 'active' | 'rejected'
    search = '',
    departmentId = '',
    offerType = '',
    emailStatus = '',
    responseStatus = '',
  } = options;

  let filtered = candidates.filter((c) => {
    if (scope === 'rejected') return c.responseStatus === RESPONSE_STATUS.REJECTED;
    return c.responseStatus !== RESPONSE_STATUS.REJECTED;
  });

  if (departmentId) {
    filtered = filtered.filter((c) => c.departmentId === departmentId);
  }
  if (offerType && offerType !== 'All') {
    filtered = filtered.filter((c) => c.offerType === offerType);
  }
  if (emailStatus && emailStatus !== 'All') {
    filtered = filtered.filter((c) => c.emailStatus === emailStatus);
  }
  if (responseStatus && responseStatus !== 'All' && scope === 'active') {
    filtered = filtered.filter((c) => c.responseStatus === responseStatus);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((c) => {
      const nameMatch = (c.fullName || '').toLowerCase().includes(q);
      const emailMatch = (c.email || '').toLowerCase().includes(q);
      const positionMatch = (c.positionName || '').toLowerCase().includes(q);
      return nameMatch || emailMatch || positionMatch;
    });
  }

  return filtered;
}

/**
 * Computes data-driven pipeline summary counts for the Upcoming candidate dataset. Never
 * hardcoded — always derived from the actual current candidate records.
 *
 * @param {Array<Object>} candidates
 * @returns {{ shortlisted: number, pendingEmail: number, emailSent: number, replies: number, accepted: number, rejected: number }}
 */
export function calculateCandidateSummary(candidates = []) {
  const active = candidates.filter((c) => c.responseStatus !== RESPONSE_STATUS.REJECTED);

  return {
    shortlisted: active.length,
    pendingEmail: active.filter((c) => c.emailStatus === EMAIL_STATUS.PENDING).length,
    emailSent: active.filter((c) => c.emailStatus === EMAIL_STATUS.SENT || c.emailStatus === EMAIL_STATUS.REPLIED).length,
    replies: active.filter((c) => c.emailStatus === EMAIL_STATUS.REPLIED).length,
    accepted: active.filter((c) => c.responseStatus === RESPONSE_STATUS.ACCEPTED).length,
    rejected: candidates.filter((c) => c.responseStatus === RESPONSE_STATUS.REJECTED).length,
  };
}

/**
 * Counts candidate replies that still require HR attention (Replied but not yet reviewed).
 * Drives the Upcoming page's notification bell badge.
 *
 * @param {Array<Object>} candidates
 * @returns {number}
 */
export function countUnreadReplies(candidates = []) {
  return candidates.filter((c) => c.emailStatus === EMAIL_STATUS.REPLIED && !c.notificationRead).length;
}
