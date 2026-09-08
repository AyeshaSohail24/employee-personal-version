import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access and CRUD operations for EmployeeTag entities.
 */
export const employeeTagService = {
  async getAll() {
    const db = loadDatabase();
    return db.employeeTags || [];
  },

  async getActive() {
    const all = await this.getAll();
    return all.filter((t) => t.active !== false);
  },

  async getById(id) {
    const all = await this.getAll();
    return all.find((t) => t.id === id) || null;
  },

  async create(tagData) {
    const db = loadDatabase();
    const newRecord = {
      id: tagData.id,
      name: tagData.name,
      category: tagData.category || 'General',
      color: tagData.color || '#129FA9',
      active: tagData.active !== undefined ? tagData.active : true,
    };
    db.employeeTags = db.employeeTags || [];
    db.employeeTags.push(newRecord);
    saveDatabase(db);
    return newRecord;
  },

  async update(id, updateData) {
    const db = loadDatabase();
    const index = (db.employeeTags || []).findIndex((t) => t.id === id);
    if (index === -1) return null;

    const existing = db.employeeTags[index];
    const updated = {
      ...existing,
      ...updateData,
      id: existing.id, // Immutable ID
    };

    db.employeeTags[index] = updated;
    saveDatabase(db);
    return updated;
  },

  async toggleActive(id) {
    const db = loadDatabase();
    const target = (db.employeeTags || []).find((t) => t.id === id);
    if (!target) return null;

    target.active = !target.active;
    saveDatabase(db);
    return target;
  },

  async delete(id) {
    const db = loadDatabase();
    const initialLen = (db.employeeTags || []).length;
    db.employeeTags = (db.employeeTags || []).filter((t) => t.id !== id);

    if (db.employeeTags.length !== initialLen) {
      saveDatabase(db);
      return true;
    }
    return false;
  },
};
