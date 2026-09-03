import { loadDatabase } from '../mock-data/storageEngine.js';
import { buildOrgChartTree, getCurrentWorkforce } from '../domain/employmentDomain.js';

/**
 * Service providing reporting hierarchy data for the Employee Org Chart.
 */
export const orgChartService = {
  /**
   * Retrieves the current employee reporting hierarchy tree collection.
   * @returns {Promise<Object>} { roots: Array<Node>, totalAssignedCount: number }
   */
  async getOrgChart() {
    const db = loadDatabase();
    const employees = db.employees || [];
    const records = db.employmentRecords || [];
    const depts = db.departments || [];
    const positions = db.positions || [];
    const locations = db.locations || [];
    const schedules = db.schedules || [];

    const currentWorkforce = getCurrentWorkforce(employees, records);
    const roots = buildOrgChartTree(employees, records, depts, positions, locations, schedules);

    return {
      roots,
      totalAssignedCount: currentWorkforce.length,
    };
  },
};
