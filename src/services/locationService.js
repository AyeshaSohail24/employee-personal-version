import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
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
        active: loc.active !== false,
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
   * Retrieves active work locations only (for creation dropdowns).
   * @returns {Promise<Array<Object>>}
   */
  async getActive() {
    const all = await this.getAll();
    return all.filter((l) => l.active !== false);
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

  /**
   * Creates a new Work Location entity.
   * @param {Object} locData
   * @returns {Promise<Object>}
   */
  async create(locData) {
    const db = loadDatabase();
    const locations = db.locations || [];

    const newLoc = {
      id: locData.id,
      name: locData.name.trim(),
      type: locData.type || 'Office',
      address: locData.address ? locData.address.trim() : (locData.type === 'Remote' ? 'Remote / Distributed' : 'Address Pending'),
      active: locData.active !== undefined ? locData.active : true,
    };

    db.locations = [...locations, newLoc];
    saveDatabase(db);
    return this.getById(newLoc.id);
  },

  /**
   * Updates an existing Work Location entity.
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<Object>}
   */
  async update(id, updateData) {
    const db = loadDatabase();
    const locations = db.locations || [];
    const index = locations.findIndex((l) => l.id === id);

    if (index === -1) {
      throw new Error(`Work Location with ID "${id}" not found.`);
    }

    const existing = locations[index];
    const updated = {
      ...existing,
      ...updateData,
      name: updateData.name ? updateData.name.trim() : existing.name,
      type: updateData.type || existing.type,
      address: updateData.address !== undefined ? updateData.address.trim() : existing.address,
      active: updateData.active !== undefined ? updateData.active : existing.active,
    };

    locations[index] = updated;
    db.locations = locations;
    saveDatabase(db);
    return this.getById(id);
  },

  /**
   * Toggles active status of a Work Location entity.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async toggleActive(id) {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Work Location with ID "${id}" not found.`);
    }
    return this.update(id, { active: !existing.active });
  },

  /**
   * Deletes an unreferenced Work Location entity.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    const db = loadDatabase();
    const locations = db.locations || [];
    const filtered = locations.filter((l) => l.id !== id);

    if (filtered.length === locations.length) {
      throw new Error(`Work Location with ID "${id}" not found.`);
    }

    db.locations = filtered;
    saveDatabase(db);
    return true;
  },
};

