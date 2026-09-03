import { loadDatabase } from '../mock-data/storageEngine.js';
import { calculateDepartmentHeadcount } from '../domain/employmentDomain.js';

/**
 * Service providing asynchronous data access for Department entities.
 */
export const departmentService = {
  /**
   * Retrieves all departments, enriched with current headcount metrics.
   * @param {Object} [options]
   * @param {boolean} [options.withCount=true]
   * @returns {Promise<Array<Object>>}
   */
  async getAll({ withCount = true } = {}) {
    const db = loadDatabase();
    const depts = db.departments || [];
    const employees = db.employees || [];
    const records = db.employmentRecords || [];

    if (!withCount) return depts;

    return depts.map((dept) => {
      const headcount = calculateDepartmentHeadcount(dept.id, employees, records);
      const manager = dept.managerEmployeeId
        ? employees.find((e) => e.id === dept.managerEmployeeId)
        : null;

      return {
        ...dept,
        currentHeadcount: headcount,
        employeeCount: headcount,
        managerName: manager ? manager.fullName : null,
      };
    });
  },

  /**
   * Retrieves a single department by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const all = await this.getAll({ withCount: true });
    return all.find((d) => d.id === id) || null;
  },

  /**
   * Retrieves parent-child department tree hierarchy.
   * @returns {Promise<Array<Object>>}
   */
  async getHierarchy() {
    const all = await this.getAll({ withCount: true });
    const roots = all.filter((d) => !d.parentDepartmentId);

    const buildNode = (dept) => ({
      ...dept,
      children: all.filter((child) => child.parentDepartmentId === dept.id).map(buildNode),
    });

    return roots.map(buildNode);
  },
};
