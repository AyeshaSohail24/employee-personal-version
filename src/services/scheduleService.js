import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access and CRUD operations for WorkSchedule entities.
 */
export const scheduleService = {
  async getAll() {
    const db = loadDatabase();
    return db.schedules || [];
  },

  async getActive() {
    const all = await this.getAll();
    return all.filter((s) => s.active !== false);
  },

  async getById(id) {
    const all = await this.getAll();
    return all.find((s) => s.id === id) || null;
  },

  async create(scheduleData) {
    const db = loadDatabase();
    const newRecord = {
      id: scheduleData.id,
      name: scheduleData.name,
      workingDays: scheduleData.workingDays || [],
      startTime: scheduleData.startTime || '09:00',
      endTime: scheduleData.endTime || '18:00',
      weeklyHours: Number(scheduleData.weeklyHours) || 40,
      active: scheduleData.active !== undefined ? scheduleData.active : true,
    };
    db.schedules = db.schedules || [];
    db.schedules.push(newRecord);
    saveDatabase(db);
    return newRecord;
  },

  async update(id, updateData) {
    const db = loadDatabase();
    const index = (db.schedules || []).findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = db.schedules[index];
    const updated = {
      ...existing,
      ...updateData,
      id: existing.id, // Immutable ID
    };

    db.schedules[index] = updated;
    saveDatabase(db);
    return updated;
  },

  async toggleActive(id) {
    const db = loadDatabase();
    const target = (db.schedules || []).find((s) => s.id === id);
    if (!target) return null;

    target.active = !target.active;
    saveDatabase(db);
    return target;
  },

  async delete(id) {
    const db = loadDatabase();
    const initialLen = (db.schedules || []).length;
    db.schedules = (db.schedules || []).filter((s) => s.id !== id);

    if (db.schedules.length !== initialLen) {
      saveDatabase(db);
      return true;
    }
    return false;
  },
};
