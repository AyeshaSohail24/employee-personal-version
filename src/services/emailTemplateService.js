import { apiClient } from './apiClient.js';

/**
 * Offer email drafts for the Upcoming workflow (Paid Position / Unpaid Position plus any custom
 * drafts). The local MySQL `email_templates` table is the single source of truth, read and written
 * through this app's own API (GET/POST /email-templates, PATCH/DELETE /email-templates/{id} —
 * server/routes/candidateMessaging.js), so every browser and user sees the same drafts. Nothing
 * here touches localStorage.
 */
export const emailTemplateService = {
  /**
   * Retrieves all email drafts, oldest first.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const { templates } = await apiClient.get('/email-templates');
    return templates;
  },

  /**
   * Retrieves a single draft by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const all = await this.getAll();
    return all.find((t) => t.id === id) || null;
  },

  /**
   * Retrieves the draft used for a candidate Offer Type ('Paid' | 'Unpaid') — the original
   * default for that type (tpl-email-paid / tpl-email-unpaid) while it exists, otherwise the
   * oldest remaining draft of that type. The server guarantees at least one always exists.
   * @param {string} offerType
   * @returns {Promise<Object|null>}
   */
  async getByOfferType(offerType) {
    const sameType = (await this.getAll()).filter((t) => t.offerType === offerType);
    const defaultId = `tpl-email-${String(offerType).toLowerCase()}`;
    return sameType.find((t) => t.id === defaultId) || sameType[0] || null;
  },

  /**
   * Updates a draft's name/offer type/subject/body.
   * @param {string} id
   * @param {{ name?: string, offerType?: string, subject?: string, body?: string }} updateData
   * @returns {Promise<Object>}
   */
  async update(id, updateData) {
    const { template } = await apiClient.patch(`/email-templates/${encodeURIComponent(id)}`, updateData);
    return template;
  },

  /**
   * Creates a new offer email draft.
   * @param {{ name?: string, offerType?: string, subject?: string, body?: string }} [data]
   * @returns {Promise<Object>}
   */
  async create(data = {}) {
    const { template } = await apiClient.post('/email-templates', {
      name: data.name || 'New Draft',
      offerType: data.offerType || 'Paid',
      subject: data.subject || '',
      body: data.body || '',
    });
    return template;
  },

  /**
   * Permanently deletes a draft. The server refuses (422, with an explanatory message) to delete
   * the last remaining draft of a required offer type.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async remove(id) {
    await apiClient.delete(`/email-templates/${encodeURIComponent(id)}`);
  },
};
