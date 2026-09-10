import { upcomingCandidateService } from './upcomingCandidateService.js';
import { emailTemplateService } from './emailTemplateService.js';
import { renderEmailTemplate, buildCandidateEmailTokens } from '../domain/candidateDomain.js';

/**
 * Backend-ready email composition/send abstraction for the Upcoming candidate workflow.
 *
 * There is currently no real email backend/provider connected. This service never calls a
 * real API (no Gmail/Outlook/SMTP/SendGrid/Resend/Mailgun/fetch) and never claims an email
 * was actually delivered.
 *
 * CURRENT (PoC): renderPreview()/sendEmail() validate and render the email locally, then
 * persist "sent" metadata through upcomingCandidateService — a local send simulation.
 * FUTURE: swap sendEmail()'s body for a real backend email API call; renderPreview(), the
 * token/placeholder contract, and every caller stay exactly the same.
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
   * Validates and "sends" (PoC: records as sent) a single candidate's offer email.
   * Refuses to send if any required placeholder is unresolved.
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

    return upcomingCandidateService.markEmailSent(candidateId, {
      to: candidate.email,
      cc,
      subject,
      body,
    });
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
};
