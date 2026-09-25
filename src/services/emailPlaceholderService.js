import { apiClient } from './apiClient.js';

/**
 * User-created email placeholders, shared by every HR/Admin user — stored in MySQL
 * (email_placeholders) and read/written through GET/POST /email-placeholders and
 * PATCH/DELETE /email-placeholders/{id} (server/routes/candidateMessaging.js). The built-in
 * placeholders and the value-source catalog live in src/domain/emailPlaceholders.js.
 */
export const emailPlaceholderService = {
  /** @returns {Promise<Array<Object>>} */
  async getAll() {
    const { placeholders } = await apiClient.get('/email-placeholders');
    return placeholders;
  },

  /**
   * @param {{ label: string, token: string, description?: string, source: string, fixedValue?: string }} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const { placeholder } = await apiClient.post('/email-placeholders', data);
    return placeholder;
  },

  /** Refused by the server (422) if the token is renamed while a draft uses it. */
  async update(id, data) {
    const { placeholder } = await apiClient.patch(`/email-placeholders/${encodeURIComponent(id)}`, data);
    return placeholder;
  },

  /** Refused by the server (422) while any draft still uses the placeholder. */
  async remove(id) {
    await apiClient.delete(`/email-placeholders/${encodeURIComponent(id)}`);
  },
};
