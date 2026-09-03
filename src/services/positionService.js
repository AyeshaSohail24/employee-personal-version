import { loadDatabase } from '../mock-data/storageEngine.js';
import {
  calculatePositionOccupants,
  calculateUpcomingPositionHires,
  getCurrentWorkforce,
  resolveCurrentRecord,
} from '../domain/employmentDomain.js';

/**
 * Service providing asynchronous data access for Job Position entities.
 */
export const positionService = {
  /**
   * Retrieves all job positions, enriched with current occupant counts and scheduled upcoming hires.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    const positions = db.positions || [];
    const depts = db.departments || [];
    const employees = db.employees || [];
    const records = db.employmentRecords || [];
    const schedules = db.schedules || [];
    const locations = db.locations || [];

    const currentWorkforce = getCurrentWorkforce(employees, records);

    return positions.map((pos) => {
      const currentOccupantsCount = calculatePositionOccupants(pos.id, employees, records);
      const upcomingCount = calculateUpcomingPositionHires(pos.id, employees, records);

      const dept = depts.find((d) => d.id === pos.departmentId);
      const sched = schedules.find((s) => s.id === pos.defaultScheduleId);
      const loc = locations.find((l) => l.id === pos.defaultLocationId);

      // Find current occupant employee summaries
      const occupants = currentWorkforce
        .filter((emp) => {
          const rec = resolveCurrentRecord(emp.id, records);
          return rec && rec.positionId === pos.id;
        })
        .map((emp) => ({
          id: emp.id,
          fullName: emp.fullName,
          employeeId: emp.employeeId,
          photo: emp.photo,
        }));

      return {
        ...pos,
        currentOccupantsCount,
        upcomingCount,
        departmentName: dept ? dept.name : 'Unassigned',
        departmentColor: dept ? dept.color : 'var(--color-primary)',
        scheduleName: sched ? sched.name : 'Standard Workweek',
        locationName: loc ? loc.name : 'Rizurf HQ',
        occupants,
      };
    });
  },

  /**
   * Retrieves a position by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    const all = await this.getAll();
    return all.find((p) => p.id === id) || null;
  },
};
