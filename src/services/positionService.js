import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
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
        active: pos.active !== false,
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
   * Retrieves active job positions only (for creation dropdowns).
   * @returns {Promise<Array<Object>>}
   */
  async getActive() {
    const all = await this.getAll();
    return all.filter((p) => p.active !== false);
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

  /**
   * Creates a new Job Position entity.
   * @param {Object} posData
   * @returns {Promise<Object>}
   */
  async create(posData) {
    const db = loadDatabase();
    const positions = db.positions || [];

    const newPos = {
      id: posData.id,
      name: posData.name.trim(),
      departmentId: posData.departmentId,
      defaultManagerId: posData.defaultManagerId || null,
      defaultScheduleId: posData.defaultScheduleId || 'sched-1',
      defaultLocationId: posData.defaultLocationId || 'loc-1',
      active: posData.active !== undefined ? posData.active : true,
    };

    db.positions = [...positions, newPos];
    saveDatabase(db);
    return this.getById(newPos.id);
  },

  /**
   * Updates an existing Job Position entity.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async update(id, updateData) {
    const db = loadDatabase();
    const positions = db.positions || [];
    const index = positions.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Job Position with ID "${id}" not found.`);
    }

    const existing = positions[index];
    const updated = {
      ...existing,
      ...updateData,
      name: updateData.name ? updateData.name.trim() : existing.name,
      departmentId: updateData.departmentId || existing.departmentId,
      defaultManagerId: updateData.defaultManagerId !== undefined ? updateData.defaultManagerId : existing.defaultManagerId,
      defaultScheduleId: updateData.defaultScheduleId || existing.defaultScheduleId,
      defaultLocationId: updateData.defaultLocationId || existing.defaultLocationId,
      active: updateData.active !== undefined ? updateData.active : existing.active,
    };

    positions[index] = updated;
    db.positions = positions;
    saveDatabase(db);
    return this.getById(id);
  },

  /**
   * Toggles active status of a Job Position entity.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async toggleActive(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Job Position with ID "${id}" not found.`);
    }
    return this.update(id, { active: !existing.active });
  },

  /**
   * Deletes an unreferenced Job Position entity.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const db = loadDatabase();
    const positions = db.positions || [];
    const filtered = positions.filter((p) => p.id !== id);

    if (filtered.length === positions.length) {
      throw new Error(`Job Position with ID "${id}" not found.`);
    }

    db.positions = filtered;
    saveDatabase(db);
    return true;
  },
};

