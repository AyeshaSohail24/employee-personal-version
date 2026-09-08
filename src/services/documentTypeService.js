import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access and CRUD operations for DocumentType entities.
 */
export const documentTypeService = {
  async getAll() {
    const db = loadDatabase();
    return db.documentTypes || [];
  },

  async getActive() {
    const all = await this.getAll();
    return all.filter((d) => d.active !== false);
  },

  async getById(id) {
    const all = await this.getAll();
    return all.find((d) => d.id === id) || null;
  },

  async create(documentTypeData) {
    const db = loadDatabase();
    if (!db.documentTypes) db.documentTypes = [];

    const newRecord = {
      id: documentTypeData.id,
      name: documentTypeData.name,
      code: documentTypeData.code,
      category: documentTypeData.category,
      requiresExpiry: Boolean(documentTypeData.requiresExpiry),
      description: documentTypeData.description || '',
      active: documentTypeData.active !== undefined ? Boolean(documentTypeData.active) : true,
    };

    db.documentTypes.push(newRecord);
    saveDatabase(db);
    return newRecord;
  },

  async update(id, updateData) {
    const db = loadDatabase();
    if (!db.documentTypes) return null;

    const index = db.documentTypes.findIndex((d) => d.id === id);
    if (index === -1) return null;

    const current = db.documentTypes[index];
    const updated = {
      ...current,
      name: updateData.name !== undefined ? updateData.name : current.name,
      code: updateData.code !== undefined ? updateData.code : current.code,
      category: updateData.category !== undefined ? updateData.category : current.category,
      requiresExpiry: updateData.requiresExpiry !== undefined ? Boolean(updateData.requiresExpiry) : current.requiresExpiry,
      description: updateData.description !== undefined ? updateData.description : current.description,
      active: updateData.active !== undefined ? Boolean(updateData.active) : current.active,
    };

    db.documentTypes[index] = updated;
    saveDatabase(db);
    return updated;
  },

  async toggleActive(id) {
    const current = await this.getById(id);
    if (!current) return null;
    return this.update(id, { active: !current.active });
  },

  async delete(id) {
    const db = loadDatabase();
    if (!db.documentTypes) return false;

    const index = db.documentTypes.findIndex((d) => d.id === id);
    if (index === -1) return false;

    db.documentTypes.splice(index, 1);
    saveDatabase(db);
    return true;
  },
};
