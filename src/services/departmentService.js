import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
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
        active: dept.active !== false,
        currentHeadcount: headcount,
        employeeCount: headcount,
        managerName: manager ? manager.fullName : null,
      };
    });
  },

  /**
   * Retrieves active departments only (for creation dropdowns).
   * @returns {Promise<Array<Object>>}
   */
  async getActive(options = {}) {
    const all = await this.getAll(options);
    return all.filter((d) => d.active !== false);
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

  /**
   * Creates a new Department entity.
   * @param {Object} deptData
   * @returns {Promise<Object>}
   */
  async create(deptData) {
    const db = loadDatabase();
    const depts = db.departments || [];

    const newDept = {
      id: deptData.id,
      name: deptData.name.trim(),
      code: deptData.code.trim().toUpperCase(),
      parentDepartmentId: deptData.parentDepartmentId || null,
      managerEmployeeId: deptData.managerEmployeeId || null,
      color: deptData.color || '#3b82f6',
      active: deptData.active !== undefined ? deptData.active : true,
    };

    db.departments = [...depts, newDept];
    saveDatabase(db);
    return this.getById(newDept.id);
  },

  /**
   * Updates an existing Department entity.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async update(id, updateData) {
    const db = loadDatabase();
    const depts = db.departments || [];
    const index = depts.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new Error(`Department with ID "${id}" not found.`);
    }

    const existing = depts[index];
    const updated = {
      ...existing,
      ...updateData,
      name: updateData.name ? updateData.name.trim() : existing.name,
      code: updateData.code ? updateData.code.trim().toUpperCase() : existing.code,
      parentDepartmentId: updateData.parentDepartmentId !== undefined ? updateData.parentDepartmentId : existing.parentDepartmentId,
      managerEmployeeId: updateData.managerEmployeeId !== undefined ? updateData.managerEmployeeId : existing.managerEmployeeId,
      color: updateData.color || existing.color,
      active: updateData.active !== undefined ? updateData.active : existing.active,
    };

    depts[index] = updated;
    db.departments = depts;
    saveDatabase(db);
    return this.getById(id);
  },

  /**
   * Toggles active status of a Department entity.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async toggleActive(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Department with ID "${id}" not found.`);
    }
    return this.update(id, { active: !existing.active });
  },

  /**
   * Deletes an unreferenced Department entity.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const db = loadDatabase();
    const depts = db.departments || [];
    const filtered = depts.filter((d) => d.id !== id);

    if (filtered.length === depts.length) {
      throw new Error(`Department with ID "${id}" not found.`);
    }

    db.departments = filtered;
    saveDatabase(db);
    return true;
  },
};

