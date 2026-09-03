import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { resolveHydratedEmployee } from '../domain/employmentDomain.js';
import { filterEmployeesByStatus } from '../domain/lifecycleDomain.js';

/**
 * Service providing asynchronous data access and directory querying for Employee entities.
 */
export const employeeService = {
  /**
   * Retrieves all employees, hydrated with organizational data.
   * @param {Object} [options]
   * @param {boolean} [options.hydrate=true]
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
   * @param {string} status
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async getByStatus(status, options = {}) {
    const all = await this.getAll(options);
    return filterEmployeesByStatus(all, status);
  },

  /**
   * Queries employees with route scope, user filters, search, and sorting.
   *
   * @param {Object} options
   * @param {string} [options.baseLifecycleScope='All'] - 'All', 'Active', 'NewJoiners', 'Departing', 'Former'
   * @param {string} [options.statusFilter=''] - User-selected status filter (only active when baseLifecycleScope is 'All')
   * @param {string} [options.departmentId='']
   * @param {string} [options.employeeTypeId='']
   * @param {string} [options.locationId='']
   * @param {string} [options.search='']
   * @param {string} [options.sortBy='name-asc'] - 'name-asc', 'name-desc', 'date-desc', 'date-asc'
   * @returns {Promise<Object>} { employees, baseCount, totalFilteredCount }
   */
  async queryEmployees({
    baseLifecycleScope = 'All',
    statusFilter = '',
    departmentId = '',
    employeeTypeId = '',
    locationId = '',
    search = '',
    sortBy = 'name-asc',
  } = {}) {
    const allEmployees = await this.getAll({ hydrate: true });

    // 1. Enforce route base lifecycle scope
    let scoped = [];
    if (baseLifecycleScope === 'Active') {
      scoped = allEmployees.filter((e) => e.status === 'Active');
    } else if (baseLifecycleScope === 'NewJoiners') {
      scoped = allEmployees.filter((e) => e.status === 'Onboarding' || e.status === 'Upcoming');
    } else if (baseLifecycleScope === 'Departing') {
      scoped = allEmployees.filter((e) => e.status === 'Departing');
    } else if (baseLifecycleScope === 'Former') {
      scoped = allEmployees.filter((e) => e.status === 'Former');
    } else {
      scoped = [...allEmployees]; // 'All' route allows all 18 employees
    }

    const baseCount = scoped.length;
    let filtered = [...scoped];

    // 2. Interactive Status filter (only applied if route base scope is 'All')
    if (baseLifecycleScope === 'All' && statusFilter && statusFilter !== 'All') {
      filtered = filterEmployeesByStatus(filtered, statusFilter);
    }

    // 3. Interactive Department filter
    if (departmentId) {
      filtered = filtered.filter((e) => e.department && e.department.id === departmentId);
    }

    // 4. Interactive Employee Type filter
    if (employeeTypeId) {
      filtered = filtered.filter((e) => e.employeeTypeId === employeeTypeId);
    }

    // 5. Interactive Location filter
    if (locationId) {
      filtered = filtered.filter((e) => e.location && e.location.id === locationId);
    }

    // 6. Text Search (case-insensitive across name, ID, position, department, email)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((e) => {
        const nameMatch = e.fullName?.toLowerCase().includes(q);
        const codeMatch = e.employeeId?.toLowerCase().includes(q);
        const posMatch = e.position?.name?.toLowerCase().includes(q);
        const deptMatch = e.department?.name?.toLowerCase().includes(q);
        const emailMatch = e.workEmail?.toLowerCase().includes(q);
        return nameMatch || codeMatch || posMatch || deptMatch || emailMatch;
      });
    }

    // 7. Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'name-desc') {
        return (b.fullName || '').localeCompare(a.fullName || '');
      }
      if (sortBy === 'date-desc') {
        return (b.startDate || '').localeCompare(a.startDate || '');
      }
      if (sortBy === 'date-asc') {
        return (a.startDate || '').localeCompare(b.startDate || '');
      }
      // Default: 'name-asc'
      return (a.fullName || '').localeCompare(b.fullName || '');
    });

    return {
      employees: filtered,
      baseCount,
      totalFilteredCount: filtered.length,
    };
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
