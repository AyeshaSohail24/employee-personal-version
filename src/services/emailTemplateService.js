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
   * Updates a draft's name/offer type/subject/body.
   * @param {string} id
   * @param {{ name?: string, offerType?: string, subject?: string, body?: string }} updateData
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
      name: updateData.name !== undefined ? updateData.name : templates[index].name,
      offerType: updateData.offerType !== undefined ? updateData.offerType : templates[index].offerType,
      subject: updateData.subject !== undefined ? updateData.subject : templates[index].subject,
      body: updateData.body !== undefined ? updateData.body : templates[index].body,
    };

    db.emailTemplates = templates;
    saveDatabase(db);
    return this.getById(id);
  },

  /**
   * Creates a new, blank offer email draft (a custom addition to the library alongside the two
   * seeded Paid/Unpaid defaults). Never wired automatically into candidateEmailService's send
   * flow — getByOfferType() keeps resolving to whichever draft for that Offer Type comes first,
   * so a new custom draft is purely a library entry HR can open and fill in until they decide
   * what (if anything) it replaces.
   * @param {{ name?: string, offerType?: string, subject?: string, body?: string }} [data]
   * @returns {Promise<Object>}
   */
  async create(data = {}) {
    const db = loadDatabase();
    const templates = db.emailTemplates || [];
    const newTemplate = {
      id: `tpl-email-${Date.now()}`,
      name: data.name || 'New Draft',
      offerType: data.offerType || 'Paid',
      subject: data.subject || '',
      body: data.body || '',
    };

    db.emailTemplates = [...templates, newTemplate];
    saveDatabase(db);
    return this.getById(newTemplate.id);
  },

  /**
   * Whether a draft has a seeded PoC default it can be reset back to (custom drafts created via
   * create() do not, since there's nothing to reset them to).
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async hasDefault(id) {
    return seedEmailTemplates.some((t) => t.id === id);
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
