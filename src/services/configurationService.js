import { loadDatabase } from '../mock-data/storageEngine.js';
import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { activityTypeService } from './activityTypeService.js';
import {
  canUserMutate,
  generateUniqueId,
  validateDepartment,
  validatePosition,
  validateLocation,
  validateActivityType,
  calculateDepartmentReferences,
  calculatePositionReferences,
  calculateLocationReferences,
  calculateActivityTypeReferences,
} from '../domain/configurationDomain.js';

/**
 * Service acting as the Administration Orchestrator for Stage 11 Configuration & Master Data.
 * Enforces role authorization, referential-integrity checking, input validation, and service delegation.
 */
export const configurationService = {
  /**
   * Fetches full organization configuration state (departments, positions, locations) enriched with usage counts.
   * @returns {Promise<Object>}
   */
  async getOrganizationConfig() {
    const db = loadDatabase();
    const rawDepts = await departmentService.getAll({ withCount: true });
    const rawPositions = await positionService.getAll();
    const rawLocations = await locationService.getAll();

    // Enrich with database reference counts
    const departments = rawDepts.map((dept) => {
      const refCheck = calculateDepartmentReferences(dept.id, db);
      return {
        ...dept,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });

    const positions = rawPositions.map((pos) => {
      const refCheck = calculatePositionReferences(pos.id, db);
      return {
        ...pos,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });

    const locations = rawLocations.map((loc) => {
      const refCheck = calculateLocationReferences(loc.id, db);
      return {
        ...loc,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });

    return { departments, positions, locations };
  },

  /**
   * Fetches full activities configuration state (activityTypes) enriched with reference usage counts.
   * @returns {Promise<Array<Object>>}
   */
  async getActivitiesConfig() {
    const db = loadDatabase();
    const rawTypes = await activityTypeService.getAll();

    return rawTypes.map((type) => {
      const refCheck = calculateActivityTypeReferences(type.id, db);
      return {
        ...type,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });
  },

  // ==================== DEPARTMENT MUTATIONS ====================

  async createDepartment(deptData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingDepts = await departmentService.getAll({ withCount: false });
    const { isValid, errors, cleanData } = validateDepartment(deptData, existingDepts);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('dept', existingDepts);
    return departmentService.create({ ...cleanData, id: newId });
  },

  async updateDepartment(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingDepts = await departmentService.getAll({ withCount: false });
    const { isValid, errors, cleanData } = validateDepartment(updateData, existingDepts, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return departmentService.update(id, cleanData);
  },

  async toggleDepartmentActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return departmentService.toggleActive(id);
  },

  async deleteDepartment(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculateDepartmentReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete department: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return departmentService.delete(id);
  },

  // ==================== POSITION MUTATIONS ====================

  async createPosition(posData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingPositions = await positionService.getAll();
    const { isValid, errors, cleanData } = validatePosition(posData, existingPositions);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('pos', existingPositions);
    return positionService.create({ ...cleanData, id: newId });
  },

  async updatePosition(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingPositions = await positionService.getAll();
    const { isValid, errors, cleanData } = validatePosition(updateData, existingPositions, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return positionService.update(id, cleanData);
  },

  async togglePositionActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return positionService.toggleActive(id);
  },

  async deletePosition(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculatePositionReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete job position: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return positionService.delete(id);
  },

  // ==================== LOCATION MUTATIONS ====================

  async createLocation(locData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingLocations = await locationService.getAll();
    const { isValid, errors, cleanData } = validateLocation(locData, existingLocations);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('loc', existingLocations);
    return locationService.create({ ...cleanData, id: newId });
  },

  async updateLocation(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingLocations = await locationService.getAll();
    const { isValid, errors, cleanData } = validateLocation(updateData, existingLocations, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return locationService.update(id, cleanData);
  },

  async toggleLocationActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return locationService.toggleActive(id);
  },

  async deleteLocation(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculateLocationReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete location: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return locationService.delete(id);
  },

  // ==================== ACTIVITY TYPE MUTATIONS ====================

  async createActivityType(typeData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingTypes = await activityTypeService.getAll();
    const { isValid, errors, cleanData } = validateActivityType(typeData, existingTypes);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('act-type', existingTypes);
    return activityTypeService.create({ ...cleanData, id: newId });
  },

  async updateActivityType(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingTypes = await activityTypeService.getAll();
    const { isValid, errors, cleanData } = validateActivityType(updateData, existingTypes, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return activityTypeService.update(id, cleanData);
  },

  async toggleActivityTypeActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return activityTypeService.toggleActive(id);
  },

  async deleteActivityType(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculateActivityTypeReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete activity type: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return activityTypeService.delete(id);
  },
};
