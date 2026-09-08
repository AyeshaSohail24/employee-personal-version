import { loadDatabase } from '../mock-data/storageEngine.js';
import { departmentService } from './departmentService.js';
import { positionService } from './positionService.js';
import { locationService } from './locationService.js';
import { activityTypeService } from './activityTypeService.js';
import { employeeTypeService } from './employeeTypeService.js';
import { employeeTagService } from './employeeTagService.js';
import { scheduleService } from './scheduleService.js';
import {
  canUserMutate,
  generateUniqueId,
  validateDepartment,
  validatePosition,
  validateLocation,
  validateActivityType,
  validateEmployeeType,
  validateEmployeeTag,
  validateSchedule,
  calculateDepartmentReferences,
  calculatePositionReferences,
  calculateLocationReferences,
  calculateActivityTypeReferences,
  calculateEmployeeTypeReferences,
  calculateEmployeeTagReferences,
  calculateScheduleReferences,
} from '../domain/configurationDomain.js';

/**
 * Service acting as the Administration Orchestrator for Stage 11 & Stage 12 Configuration & Master Data.
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

  /**
   * Fetches full employees configuration state (employeeTypes, employeeTags) enriched with reference usage counts.
   * @returns {Promise<Object>}
   */
  async getEmployeesConfig() {
    const db = loadDatabase();
    const rawTypes = await employeeTypeService.getAll();
    const rawTags = await employeeTagService.getAll();

    const employeeTypes = rawTypes.map((type) => {
      const refCheck = calculateEmployeeTypeReferences(type.id, db);
      return {
        ...type,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });

    const employeeTags = rawTags.map((tag) => {
      const refCheck = calculateEmployeeTagReferences(tag.id, db);
      return {
        ...tag,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });

    return { employeeTypes, employeeTags };
  },

  /**
   * Fetches full presence configuration state (work schedules) enriched with reference usage counts.
   * @returns {Promise<Object>}
   */
  async getPresenceConfig() {
    const db = loadDatabase();
    const rawSchedules = await scheduleService.getAll();

    const schedules = rawSchedules.map((sched) => {
      const refCheck = calculateScheduleReferences(sched.id, db);
      return {
        ...sched,
        totalReferences: refCheck.totalReferences,
        referenceSummary: refCheck.summary,
        canDelete: refCheck.totalReferences === 0,
      };
    });

    return { schedules };
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

  // ==================== EMPLOYEE TYPE MUTATIONS ====================

  async createEmployeeType(typeData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingTypes = await employeeTypeService.getAll();
    const { isValid, errors, cleanData } = validateEmployeeType(typeData, existingTypes);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('type', existingTypes);
    return employeeTypeService.create({ ...cleanData, id: newId });
  },

  async updateEmployeeType(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingTypes = await employeeTypeService.getAll();
    const { isValid, errors, cleanData } = validateEmployeeType(updateData, existingTypes, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return employeeTypeService.update(id, cleanData);
  },

  async toggleEmployeeTypeActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return employeeTypeService.toggleActive(id);
  },

  async deleteEmployeeType(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculateEmployeeTypeReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete employee type: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return employeeTypeService.delete(id);
  },

  // ==================== EMPLOYEE TAG MUTATIONS ====================

  async createEmployeeTag(tagData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingTags = await employeeTagService.getAll();
    const { isValid, errors, cleanData } = validateEmployeeTag(tagData, existingTags);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('tag', existingTags);
    return employeeTagService.create({ ...cleanData, id: newId });
  },

  async updateEmployeeTag(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingTags = await employeeTagService.getAll();
    const { isValid, errors, cleanData } = validateEmployeeTag(updateData, existingTags, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return employeeTagService.update(id, cleanData);
  },

  async toggleEmployeeTagActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return employeeTagService.toggleActive(id);
  },

  async deleteEmployeeTag(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculateEmployeeTagReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete employee tag: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return employeeTagService.delete(id);
  },

  // ==================== WORK SCHEDULE MUTATIONS ====================

  async createSchedule(scheduleData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingSchedules = await scheduleService.getAll();
    const { isValid, errors, cleanData } = validateSchedule(scheduleData, existingSchedules);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    const newId = generateUniqueId('sched', existingSchedules);
    return scheduleService.create({ ...cleanData, id: newId });
  },

  async updateSchedule(id, updateData, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const existingSchedules = await scheduleService.getAll();
    const { isValid, errors, cleanData } = validateSchedule(updateData, existingSchedules, id);

    if (!isValid) {
      const firstErr = Object.values(errors)[0];
      throw new Error(firstErr);
    }

    return scheduleService.update(id, cleanData);
  },

  async toggleScheduleActive(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }
    return scheduleService.toggleActive(id);
  },

  async deleteSchedule(id, userRole = 'HR Admin') {
    if (!canUserMutate(userRole)) {
      throw new Error('Unauthorized: Master data configuration requires HR or HR Admin permissions.');
    }

    const db = loadDatabase();
    const refCheck = calculateScheduleReferences(id, db);
    if (refCheck.totalReferences > 0) {
      throw new Error(`Cannot delete work schedule: Record is referenced by ${refCheck.summary}. Deactivate it instead.`);
    }

    return scheduleService.delete(id);
  },
};

