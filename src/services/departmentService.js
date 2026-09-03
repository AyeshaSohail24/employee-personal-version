import { loadDatabase } from '../mock-data/storageEngine.js';
import { resolveCurrentRecord } from '../domain/employmentDomain.js';

/**
 * Service providing asynchronous data access for Department entities.
 */
export const departmentService = {
  /**
   * Retrieves all departments, optionally enriched with active employee counts.
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

    // Calculate active employee count per department
    const activeEmployees = employees.filter(
      (e) => e.status === 'Active' || e.status === 'Onboarding'
    );

    return depts.map((dept) => {
      const count = activeEmployees.filter((emp) => {
        const activeRec = resolveCurrentRecord(emp.id, records);
        return activeRec && activeRec.departmentId === dept.id;
      }).length;

      const manager = dept.managerEmployeeId
        ? employees.find((e) => e.id === dept.managerEmployeeId)
        : null;

      return {
        ...dept,
        employeeCount: count,
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
