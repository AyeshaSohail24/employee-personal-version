import { loadDatabase } from '../mock-data/storageEngine.js';

/**
 * Service providing asynchronous data access for JobPosition entities.
 */
export const positionService = {
  /**
   * Retrieves all job positions with department name resolved.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    const positions = db.positions || [];
    const departments = db.departments || [];

    return positions.map((pos) => {
      const dept = departments.find((d) => d.id === pos.departmentId);
      return {
        ...pos,
        departmentName: dept ? dept.name : null,
      };
    });
  },

  /**
   * Retrieves a single job position by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const all = await this.getAll();
    return all.find((p) => p.id === id) || null;
  },

  /**
   * Retrieves job positions by department ID.
   * @param {string} departmentId
   * @returns {Promise<Array<Object>>}
   */
  async getByDepartmentId(departmentId) {
    const all = await this.getAll();
    return all.filter((p) => p.departmentId === departmentId);
  },
};
