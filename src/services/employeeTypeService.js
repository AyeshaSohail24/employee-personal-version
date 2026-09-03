import { loadDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access for EmployeeType entities.
 */
export const employeeTypeService = {
  async getAll() {
    const db = loadDatabase();
    return db.employeeTypes || [];
  },

  async getById(id) {
    const db = loadDatabase();
    return (db.employeeTypes || []).find((t) => t.id === id) || null;
  },
};
