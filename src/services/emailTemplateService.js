import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { seedEmailTemplates } from '../mock-data/seedEmailTemplates.js';

/**
 * Service providing asynchronous data access for the Upcoming workflow's offer email
 * drafts (Paid Position / Unpaid Position). These belong to the Upcoming candidate
 * workflow, not a Configuration module — edits persist through the existing storage
 * engine, exactly like every other PoC entity, and can later be swapped for a backend call.
 */
export const emailTemplateService = {
  /**
   * Retrieves all email drafts.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    return db.emailTemplates || [];
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
   * Retrieves the default draft for a given candidate Offer Type ('Paid' | 'Unpaid').
   * @param {string} offerType
   * @returns {Promise<Object|null>}
   */
  async getByOfferType(offerType) {
    const all = await this.getAll();
    return all.find((t) => t.offerType === offerType) || null;
  },

  /**
   * Updates a draft's subject/body.
   * @param {string} id
   * @param {{ subject?: string, body?: string }} updateData
   * @returns {Promise<Object>}
   */
  async update(id, updateData) {
    const db = loadDatabase();
    const templates = db.emailTemplates || [];
    const index = templates.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Email draft with ID "${id}" not found.`);
    }

    templates[index] = {
      ...templates[index],
      subject: updateData.subject !== undefined ? updateData.subject : templates[index].subject,
      body: updateData.body !== undefined ? updateData.body : templates[index].body,
    };

    db.emailTemplates = templates;
    saveDatabase(db);
    return this.getById(id);
  },

  /**
   * Resets a draft back to its original PoC default text.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async resetToDefault(id) {
    const original = seedEmailTemplates.find((t) => t.id === id);
    if (!original) {
      throw new Error(`No default exists for email draft "${id}".`);
    }
    return this.update(id, { subject: original.subject, body: original.body });
  },
};
