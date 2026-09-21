import { apiClient } from './apiClient.js';
import { upcomingCandidateService } from './upcomingCandidateService.js';
import { emailTemplateService } from './emailTemplateService.js';
import { renderEmailTemplate, buildCandidateEmailTokens } from '../domain/candidateDomain.js';

function normalizedIncludes(haystack, needle) {
  return (haystack || '').toLowerCase().includes(needle);
}

/**
 * Email composition/send abstraction for the Upcoming candidate workflow — every send and the
 * full thread (sent AND received) are real now, backed by this app's own candidate_messages
 * table (POST/GET /candidates/{applicantId}/messages): sendEmail() really delivers via SMTP
 * (server/messaging/emailProvider.js), and incoming replies land there too via IMAP polling
 * (server/messaging/imapReplyChecker.js) — no local reconstruction or bookkeeping left here.
 */
export const candidateEmailService = {
  /**
   * Renders a personalized preview (To/CC/Subject/Body) for one candidate, using the
   * default draft for their Offer Type unless an override draft is supplied (e.g. HR edited
   * the subject/body in the compose modal before sending).
   *
   * @param {Object} candidate - Enriched candidate record
   * @param {{ hiringEmployeeName: string, cc?: string, subjectOverride?: string, bodyOverride?: string }} options
   * @returns {Promise<{ to: string, cc: string, subject: string, body: string, unresolvedPlaceholders: string[], offerType: string }>}
   */
  async renderPreview(candidate, options = {}) {
    const { hiringEmployeeName = '', cc = '', subjectOverride, bodyOverride } = options;

    const template = await emailTemplateService.getByOfferType(candidate.offerType);
    if (!template) {
      throw new Error(`No email draft is configured for Offer Type "${candidate.offerType}".`);
    }

    const tokens = buildCandidateEmailTokens(candidate, hiringEmployeeName);

    const subjectSource = subjectOverride !== undefined ? subjectOverride : template.subject;
    const bodySource = bodyOverride !== undefined ? bodyOverride : template.body;

    const subjectResult = renderEmailTemplate(subjectSource, tokens);
    const bodyResult = renderEmailTemplate(bodySource, tokens);

    const unresolvedPlaceholders = Array.from(new Set([...subjectResult.unresolved, ...bodyResult.unresolved]));

    return {
      to: candidate.email,
      cc,
      subject: subjectResult.rendered,
      body: bodyResult.rendered,
      unresolvedPlaceholders,
      offerType: candidate.offerType,
    };
  },

  /**
   * Renders one specific draft (by id, not by Offer Type) for one candidate — used by the
   * Candidate Thread page's "Insert Draft" action so HR can pull in ANY saved draft (not just
   * the one tied to this candidate's Offer Type) as a starting point for a reply.
   *
   * @param {string} templateId
   * @param {Object} candidate - Enriched candidate record
   * @param {string} [hiringEmployeeName]
   * @returns {Promise<{ subject: string, body: string, unresolvedPlaceholders: string[] }>}
   */
  async renderTemplateForCandidate(templateId, candidate, hiringEmployeeName = '') {
    const template = await emailTemplateService.getById(templateId);
    if (!template) {
      throw new Error(`Email draft with ID "${templateId}" not found.`);
    }

    const tokens = buildCandidateEmailTokens(candidate, hiringEmployeeName);
    const subjectResult = renderEmailTemplate(template.subject, tokens);
    const bodyResult = renderEmailTemplate(template.body, tokens);

    return {
      subject: subjectResult.rendered,
      body: bodyResult.rendered,
      unresolvedPlaceholders: Array.from(new Set([...subjectResult.unresolved, ...bodyResult.unresolved])),
    };
  },

  /**
   * Validates, actually delivers (real SMTP via POST /candidates/{applicantId}/messages),
   * and records a single candidate's offer email as sent. Refuses to send if any required
   * placeholder is unresolved.
   *
   * @param {string} candidateId
   * @param {{ subject: string, body: string, cc?: string }} composedEmail - Final, HR-reviewed email content
   * @returns {Promise<Object>} The updated candidate
   */
  async sendEmail(candidateId, composedEmail) {
    const candidate = await upcomingCandidateService.getById(candidateId);
    if (!candidate) {
      throw new Error(`Candidate with ID "${candidateId}" not found.`);
    }

    const { subject, body, cc = '' } = composedEmail;
    const unresolved = Array.from(new Set([
      ...renderEmailTemplate(subject, {}).unresolved,
      ...renderEmailTemplate(body, {}).unresolved,
    ]));
    if (unresolved.length > 0) {
      throw new Error(`Cannot send: unresolved placeholder(s) ${unresolved.map((t) => `{{${t}}}`).join(', ')} remain in the email.`);
    }

    // Actually deliver it — a real SMTP failure (e.g. MAIL_* not configured) throws here and
    // the caller sees it, rather than the old behavior of silently recording "Sent" for an
    // email nobody ever received. The send itself is the record (candidate_messages); nothing
    // local needs updating afterward — re-fetching just reflects the new real message.
    await apiClient.post(`/candidates/${candidate.id}/messages`, {
      channel: 'email',
      toEmail: candidate.email,
      ccEmail: cc || undefined,
      subject,
      body,
    });

    return upcomingCandidateService.getById(candidateId);
  },

  /**
   * Sends individually personalized offer emails to multiple candidates in one HR action.
   * Each candidate ALWAYS gets their own render (own To/ApplicantName/PositionName/template
   * by their own Offer Type) and their own sendEmail() call — recipients are never merged
   * into a single shared email.
   *
   * @param {Array<string>} candidateIds
   * @param {{ hiringEmployeeName: string, cc?: string }} options
   * @returns {Promise<Array<{ candidateId: string, success: boolean, error?: string }>>}
   */
  async sendBulkEmails(candidateIds = [], options = {}) {
    const results = [];

    for (const candidateId of candidateIds) {
      try {
        const candidate = await upcomingCandidateService.getById(candidateId);
        if (!candidate) throw new Error('Candidate not found.');

        const preview = await this.renderPreview(candidate, options);
        if (preview.unresolvedPlaceholders.length > 0) {
          throw new Error(`Unresolved placeholder(s): ${preview.unresolvedPlaceholders.join(', ')}`);
        }

        await this.sendEmail(candidateId, { subject: preview.subject, body: preview.body, cc: preview.cc });
        results.push({ candidateId, success: true });
      } catch (err) {
        results.push({ candidateId, success: false, error: err.message });
      }
    }

    return results;
  },

  /**
   * The full email correspondence thread for one candidate, oldest first, for the Upcoming
   * page's Candidate Thread view — GET /candidates/{applicantId}/messages, this app's own real
   * candidate_messages table. Both directions are real: "sent" rows come from sendEmail()'s own
   * POST to the same endpoint, "received" rows come from a real reply matched by IMAP (see
   * server/messaging/imapReplyChecker.js). Fetching this also marks any unseen reply seen
   * server-side (db/candidateMessaging.js's markRepliesSeen()) — opening the thread is what
   * clears the notification badge, nothing here does that separately.
   *
   * @param {string} candidateId
   * @returns {Promise<Array<{ id: string, direction: 'sent'|'received', subject: string, body: string, at: string }>>}
   */
  async getThread(candidateId) {
    const { messages } = await apiClient.get(`/candidates/${candidateId}/messages`);
    return messages
      .map((m) => ({
        id: String(m.id),
        direction: m.direction,
        subject: m.subject,
        body: m.body,
        at: m.sent_at,
      }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  },

  /**
   * Searches the active Upcoming pipeline by candidate name, email, AND full message content
   * (every sent/received message in their thread — subject and body), Gmail-style: one result
   * row per matching candidate, carrying whichever message actually matched the query so the
   * caller can render a highlighted snippet from it. When a candidate only matched by name/email
   * (no message text hit), the most recent message is still returned as the preview — the same
   * way Gmail shows a thread's latest message even when the match was on the sender.
   *
   * @param {string} query
   * @returns {Promise<Array<{ candidate: Object, message: Object|null, matchedIn: 'name'|'email'|'message' }>>}
   */
  async searchCandidates(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const candidates = await upcomingCandidateService.queryCandidates({ scope: 'active' });
    const results = [];

    for (const candidate of candidates) {
      const nameMatch = normalizedIncludes(candidate.fullName, q);
      const emailMatch = normalizedIncludes(candidate.email, q);

      const messages = await this.getThread(candidate.id);
      const messageMatch = messages.find((m) => normalizedIncludes(m.subject, q) || normalizedIncludes(m.body, q));

      if (!nameMatch && !emailMatch && !messageMatch) continue;

      results.push({
        candidate,
        message: messageMatch || messages[messages.length - 1] || null,
        matchedIn: messageMatch ? 'message' : nameMatch ? 'name' : 'email',
      });
    }

    results.sort((a, b) => {
      const at = a.message ? new Date(a.message.at).getTime() : 0;
      const bt = b.message ? new Date(b.message.at).getTime() : 0;
      return bt - at;
    });

    return results;
  },
};
