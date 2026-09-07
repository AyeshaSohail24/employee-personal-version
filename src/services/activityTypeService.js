import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access and CRUD operations for Activity Type entities.
 */
export const activityTypeService = {
  /**
   * Retrieves all Activity Types (active and inactive).
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    return db.activityTypes || [];
  },

  /**
   * Retrieves active Activity Types only (for creation dropdowns).
   * @returns {Promise<Array<Object>>}
   */
  async getActive() {
    const all = await this.getAll();
    return all.filter((t) => t.active !== false);
  },

  /**
   * Retrieves a single Activity Type by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    if (!id) return null;
    const all = await this.getAll();
    return all.find((t) => t.id === id) || null;
  },

  /**
   * Creates a new Activity Type entity.
   * @param {Object} typeData
   * @returns {Promise<Object>}
   */
  async create(typeData) {
    const db = loadDatabase();
    const types = db.activityTypes || [];

    const newType = {
      id: typeData.id,
      name: typeData.name.trim(),
      category: typeData.category || 'General',
      icon: typeData.icon || 'CheckSquare',
      active: typeData.active !== undefined ? typeData.active : true,
    };

    db.activityTypes = [...types, newType];
    saveDatabase(db);
    return newType;
  },

  /**
   * Updates an existing Activity Type entity.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async update(id, updateData) {
    const db = loadDatabase();
    const types = db.activityTypes || [];
    const index = types.findIndex((t) => t.id === id);

    if (index === -1) {
      throw new Error(`Activity Type with ID "${id}" not found.`);
    }

    const existing = types[index];
    const updated = {
      ...existing,
      ...updateData,
      name: updateData.name ? updateData.name.trim() : existing.name,
      category: updateData.category || existing.category,
      icon: updateData.icon || existing.icon,
      active: updateData.active !== undefined ? updateData.active : existing.active,
    };

    types[index] = updated;
    db.activityTypes = types;
    saveDatabase(db);
    return updated;
  },

  /**
   * Toggles the active status of an Activity Type entity.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async toggleActive(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Activity Type with ID "${id}" not found.`);
    }
    return this.update(id, { active: !existing.active });
  },

  /**
   * Deletes an unreferenced Activity Type entity.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const db = loadDatabase();
    const types = db.activityTypes || [];
    const filtered = types.filter((t) => t.id !== id);

    if (filtered.length === types.length) {
      throw new Error(`Activity Type with ID "${id}" not found.`);
    }

    db.activityTypes = filtered;
    saveDatabase(db);
    return true;
  },
};
