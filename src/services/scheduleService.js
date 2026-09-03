import { loadDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access for WorkingSchedule entities.
 */
export const scheduleService = {
  async getAll() {
    const db = loadDatabase();
    return db.schedules || [];
  },

  async getById(id) {
    const db = loadDatabase();
    return (db.schedules || []).find((s) => s.id === id) || null;
  },
};
