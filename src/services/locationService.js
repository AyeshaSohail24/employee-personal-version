import { loadDatabase } from '../mock-data/storageEngine.js';
import {
  calculateLocationWorkforce,
  getCurrentWorkforce,
  resolveCurrentRecord,
} from '../domain/employmentDomain.js';

/**
 * Service providing asynchronous data access for Work Location entities.
 */
export const locationService = {
  /**
   * Retrieves all work locations, enriched with assigned current workforce count and represented departments.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    const locations = db.locations || [];
    const depts = db.departments || [];
    const employees = db.employees || [];
    const records = db.employmentRecords || [];

    const currentWorkforce = getCurrentWorkforce(employees, records);

    return locations.map((loc) => {
      const currentWorkforceCount = calculateLocationWorkforce(loc.id, employees, records);

      // Find assigned employees
      const assignedEmployees = currentWorkforce.filter((emp) => {
        const rec = resolveCurrentRecord(emp.id, records);
        return rec && rec.locationId === loc.id;
      });

      // Find represented departments
      const deptIds = new Set();
      assignedEmployees.forEach((emp) => {
        const rec = resolveCurrentRecord(emp.id, records);
        if (rec && rec.departmentId) deptIds.add(rec.departmentId);
      });

      const representedDepartments = Array.from(deptIds)
        .map((id) => depts.find((d) => d.id === id))
        .filter(Boolean)
        .map((d) => ({ id: d.id, name: d.name, color: d.color }));

      return {
        ...loc,
        currentWorkforceCount,
        assignedEmployees: assignedEmployees.map((emp) => ({
          id: emp.id,
          fullName: emp.fullName,
          employeeId: emp.employeeId,
          photo: emp.photo,
        })),
        representedDepartments,
      };
    });
  },

  /**
   * Retrieves a work location by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const all = await this.getAll();
    return all.find((l) => l.id === id) || null;
  },
};
