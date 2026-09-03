import { loadDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access for WorkLocation entities.
 */
export const locationService = {
  async getAll() {
    const db = loadDatabase();
    return db.locations || [];
  },

  async getById(id) {
    const db = loadDatabase();
    return (db.locations || []).find((l) => l.id === id) || null;
  },
};
