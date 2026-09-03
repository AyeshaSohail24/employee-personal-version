import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { resolveHydratedEmployee } from '../domain/employmentDomain.js';
import { filterEmployeesByStatus } from '../domain/lifecycleDomain.js';

/**
 * Service providing asynchronous data access for Employee entities.
 */
export const employeeService = {
  /**
   * Retrieves all employees, optionally hydrated with current employment data.
   * @param {Object} [options]
   * @param {boolean} [options.hydrate=true] - Whether to include resolved department, position, manager details.
   * @returns {Promise<Array<Object>>}
   */
  async getAll({ hydrate = true } = {}) {
    const db = loadDatabase();
    const employees = db.employees || [];

    if (!hydrate) {
      return employees;
    }

    return employees.map((emp) =>
      resolveHydratedEmployee(
        emp,
        db.employmentRecords,
        db.departments,
        db.positions,
        db.locations,
        db.schedules,
        db.employees
      )
    );
  },

  /**
   * Retrieves a single employee by ID.
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.hydrate=true]
   * @returns {Promise<Object|null>}
   */
  async getById(id, { hydrate = true } = {}) {
    const db = loadDatabase();
    const emp = (db.employees || []).find((e) => e.id === id);
    if (!emp) return null;

    if (!hydrate) return emp;

    return resolveHydratedEmployee(
      emp,
      db.employmentRecords,
      db.departments,
      db.positions,
      db.locations,
      db.schedules,
      db.employees
    );
  },

  /**
   * Retrieves employees filtered by lifecycle status.
   * @param {string} status - e.g. 'Active', 'Onboarding', 'Departing', 'Former', 'Upcoming'
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async getByStatus(status, options = {}) {
    const all = await this.getAll(options);
    return filterEmployeesByStatus(all, status);
  },

  /**
   * Adds a new employee to the database along with an initial employment record.
   * @param {Object} employeeData
   * @param {Object} [initialRecordData]
   * @returns {Promise<Object>}
   */
  async create(employeeData, initialRecordData = {}) {
    const db = loadDatabase();
    const newId = `emp-${Date.now()}`;
    const empCode = employeeData.employeeId || `RZ-${Math.floor(1000 + Math.random() * 9000)}`;

    const newEmp = {
      id: newId,
      employeeId: empCode,
      firstName: employeeData.firstName || '',
      lastName: employeeData.lastName || '',
      fullName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim(),
      workEmail: employeeData.workEmail || '',
      workPhone: employeeData.workPhone || '',
      photo: (employeeData.firstName?.[0] || '') + (employeeData.lastName?.[0] || ''),
      employeeTypeId: employeeData.employeeTypeId || 'type-1',
      status: employeeData.status || 'Active',
      startDate: employeeData.startDate || new Date().toISOString().slice(0, 10),
      contractEndDate: employeeData.contractEndDate || null,
      tags: employeeData.tags || [],
    };

    db.employees.push(newEmp);

    if (initialRecordData.departmentId || initialRecordData.positionId) {
      const newRec = {
        id: `rec-${Date.now()}`,
        employeeId: newId,
        departmentId: initialRecordData.departmentId || null,
        positionId: initialRecordData.positionId || null,
        managerId: initialRecordData.managerId || null,
        supervisorId: initialRecordData.supervisorId || null,
        locationId: initialRecordData.locationId || null,
        scheduleId: initialRecordData.scheduleId || null,
        effectiveFrom: newEmp.startDate,
        effectiveTo: null,
        changeReason: 'Initial Hire',
      };
      db.employmentRecords.push(newRec);
    }

    saveDatabase(db);
    return this.getById(newId);
  },
};
