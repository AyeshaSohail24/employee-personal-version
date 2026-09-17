import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { apiClient } from './apiClient.js';
import {
  resolveHydratedEmployee,
  validateEmployeeCreation,
  resolveEmployeeTypeIdForDirectoryType,
  generateNextEmployeeIdentifiers,
  compareEmployeeIdNumeric,
} from '../domain/employmentDomain.js';
import { filterEmployeesByStatus } from '../domain/lifecycleDomain.js';

// create()/createDirectoryEmployee() below still write to the mock
// localStorage db (not yet rewired to the real API) — this keeps their
// return value self-contained instead of routing through getById(), which
// now fetches the real backend and would never find a mock-generated id.
function hydrateFromMockDb(db, employeeId) {
  const emp = (db.employees || []).find((e) => e.id === employeeId);
  if (!emp) return null;
  return resolveHydratedEmployee(
    emp,
    db.employmentRecords,
    db.departments,
    db.positions,
    db.locations,
    db.schedules,
    db.employees,
    db.employeeTypes,
    db.employeeTags
  );
}

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
  async getAll() {
    // The API always returns pre-hydrated employees (server/db/employeeHydration.js
    // mirrors this same shape server-side) — `hydrate: false` isn't a real
    // option against the real backend, unlike the old localStorage version.
    const { employees } = await apiClient.get('/employees?limit=200');
    return employees;
  },

  /**
   * Retrieves a single employee by ID.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getById(id) {
    try {
      const { employee } = await apiClient.get(`/employees/${id}`);
      return employee;
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  },

  /**
   * Composes the combined "Profile" view for one person, keyed by their Personnel ID (employeeId,
   * e.g. RZ-1017) — NOT by lifecycle status, so the same profile stays associated with them across
   * Active/Departing/Former/etc. transitions. Currently composes entirely from the existing
   * hydrated employee record (getById()); there is no separate `profile` field anywhere in the
   * data model — every value here is read from the same structured fields the rest of the app
   * already uses (personal identity fields on the raw employee record, department/position/mode
   * from the hydrated record, etc.).
   *
   * education/application and links/documents are placeholders for data that will eventually be
   * merged in from a separate application/shortlisting microapp (not connected yet) — every one
   * of those fields is explicitly `null` here rather than a fabricated value, and the Profile UI
   * renders `null` as a neutral "—". When that integration exists, only this one function needs
   * to start merging in the additional source; the Profile UI and its section shape do not need
   * to change.
   *
   * @param {string} id - internal employee.id (not the display Personnel ID string)
   * @returns {Promise<Object|null>}
   */
  async getProfile(id) {
    const employee = await this.getById(id);
    if (!employee) return null;

    return {
      personnelId: employee.employeeId,
      fullName: employee.fullName,
      photo: employee.photo,
      status: employee.status,
      personal: {
        firstName: employee.firstName || null,
        lastName: employee.lastName || null,
        email: employee.workEmail || null,
        contactNumber: employee.workPhone || null,
        // Not yet collected anywhere in the current data model — reserved for future intake.
        nationality: null,
      },
      // Reserved for the future application/shortlisting microapp integration — none of this
      // data exists in the current PoC model for any person, so every field is null (never
      // fabricated), rendered as "—" by the Profile UI.
      educationApplication: {
        highestEducation: null,
        university: null,
        interestedPosition: null,
        acquisitionChannel: null,
        originalStartDate: null,
        originalEndDate: null,
        anythingElse: null,
      },
      // Reserved the same way — real values render as links when present, "—" otherwise.
      links: {
        linkedIn: null,
        github: null,
        resume: null,
        portfolio: null,
      },
      employment: {
        personnelId: employee.employeeId,
        type: employee.directoryType || null,
        position: employee.position ? employee.position.name : null,
        department: employee.department ? employee.department.name : null,
        workMode: employee.workMode || null,
        salaryStatus: employee.allowance || null,
        actualStartDate: employee.startDate || null,
        actualEndDate: employee.contractEndDate || null,
        status: employee.status || null,
      },
    };
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
  /**
   * Queries employees with route scope, user filters, search, and sorting.
   *
   * @param {Object} options
   * @param {string} [options.baseLifecycleScope='All'] - 'All', 'Active', 'NewJoiners', 'Departing', 'Former'
   * @param {string} [options.statusFilter=''] - User-selected status filter (only active when baseLifecycleScope is 'All')
   * @param {string} [options.departmentId='']
   * @param {string} [options.typeFilter=''] - 'All', 'Employee', 'Intern' (normalized directory classification)
   * @param {string} [options.modeFilter=''] - 'All', 'On-site', 'Remote', 'Hybrid'
   * @param {string} [options.allowanceFilter=''] - 'All', 'Paid', 'Unpaid' (surfaced in UI as "Salary")
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
    typeFilter = '',
    modeFilter = '',
    allowanceFilter = '',
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

    // 3b. Interactive Type filter (normalized directory classification: Employee | Intern)
    if (typeFilter && typeFilter !== 'All') {
      filtered = filtered.filter((e) => e.directoryType === typeFilter);
    }

    // 4. Interactive Mode filter
    if (modeFilter && modeFilter !== 'All') {
      filtered = filtered.filter((e) => e.workMode === modeFilter);
    }

    // 5. Interactive Allowance filter
    if (allowanceFilter && allowanceFilter !== 'All') {
      filtered = filtered.filter((e) => e.allowance === allowanceFilter);
    }

    // Legacy/fallback filters (employeeTypeId, locationId) if passed
    if (employeeTypeId) {
      filtered = filtered.filter((e) => e.employeeTypeId === employeeTypeId);
    }
    if (locationId) {
      filtered = filtered.filter((e) => e.location && e.location.id === locationId);
    }

    // 6. Text Search (case-insensitive across employee ID, name, email, department)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((e) => {
        const codeMatch = e.employeeId?.toLowerCase().includes(q);
        const nameMatch = e.fullName?.toLowerCase().includes(q);
        const emailMatch = e.workEmail?.toLowerCase().includes(q);
        const deptMatch = e.department?.name?.toLowerCase().includes(q);
        return codeMatch || nameMatch || emailMatch || deptMatch;
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
      // Final Working Date sort — added for the Former Personnel directory, which sorts by
      // contractEndDate (Final Working Date) rather than startDate. Purely additive: no existing
      // caller/sortBy value is affected.
      if (sortBy === 'finalDate-desc') {
        return (b.contractEndDate || '').localeCompare(a.contractEndDate || '');
      }
      if (sortBy === 'finalDate-asc') {
        return (a.contractEndDate || '').localeCompare(b.contractEndDate || '');
      }
      if (sortBy === 'id-asc') {
        return compareEmployeeIdNumeric(a.employeeId, b.employeeId);
      }
      if (sortBy === 'id-desc') {
        return compareEmployeeIdNumeric(b.employeeId, a.employeeId);
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

    const allTypes = db.employeeTypes || [];
    const activeTypes = allTypes.filter((t) => t.active !== false);

    let assignedTypeId = employeeData.employeeTypeId;
    if (!assignedTypeId) {
      const type1Active = activeTypes.some((t) => t.id === 'type-1');
      if (type1Active) {
        assignedTypeId = 'type-1';
      } else if (activeTypes.length > 0) {
        assignedTypeId = activeTypes[0].id;
      } else {
        throw new Error('Validation Error: Cannot create employee without an active Employment Type.');
      }
    } else {
      const typeExists = allTypes.some((t) => t.id === assignedTypeId);
      if (!typeExists) {
        throw new Error(`Validation Error: Employment Type "${assignedTypeId}" does not exist.`);
      }
    }

    const newEmp = {
      id: newId,
      employeeId: empCode,
      firstName: employeeData.firstName || '',
      lastName: employeeData.lastName || '',
      fullName: `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim(),
      workEmail: employeeData.workEmail || '',
      workPhone: employeeData.workPhone || '',
      photo: (employeeData.firstName?.[0] || '') + (employeeData.lastName?.[0] || ''),
      employeeTypeId: assignedTypeId,
      status: employeeData.status || 'Active',
      workMode: employeeData.workMode || 'On-site',
      allowance: employeeData.allowance || 'Paid',
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
    return hydrateFromMockDb(db, newId);
  },

  /**
   * Creates a new employee from the Employees Directory "Create Employee" modal.
   * Kept as a separate operation from create() (used by legacy verifyStage12 with a
   * looser payload) so this stricter, fully-validated directory creation flow cannot
   * regress that existing caller.
   *
   * Data flow: CreateEmployeeModal -> employeeService.createDirectoryEmployee()
   * -> validation/ID/type-mapping domain helpers -> storage engine -> hydration (getById).
   * The UI never touches localStorage or seed files directly.
   *
   * @param {Object} employeeData - firstName, lastName, workEmail, workPhone, icPassportNumber,
   *   homeAddress, directoryType ('Employee'|'Intern'), startDate, contractEndDate, allowance,
   *   workMode, status, notes
   * @param {Object} [initialRecordData] - departmentId (required), managerId (optional "Supervisor")
   * @returns {Promise<Object>} The newly created, hydrated employee
   */
  async createDirectoryEmployee(employeeData = {}, initialRecordData = {}) {
    const db = loadDatabase();
    const existingEmployees = db.employees || [];

    // departmentId is architecturally part of the initial EmploymentRecord, not the raw
    // Employee record, but it is a required field from the Create Employee form's point
    // of view — validate against the merged candidate payload.
    const { isValid, errors } = validateEmployeeCreation(
      { ...employeeData, departmentId: initialRecordData.departmentId },
      existingEmployees
    );
    if (!isValid) {
      throw new Error(Object.values(errors).join(', '));
    }

    const allTypes = db.employeeTypes || [];
    const employeeTypeId = resolveEmployeeTypeIdForDirectoryType(employeeData.directoryType, allTypes);
    if (!employeeTypeId) {
      throw new Error(`Validation Error: No active Employment Type is configured for "${employeeData.directoryType}".`);
    }

    const { id: newId, employeeId: empCode } = generateNextEmployeeIdentifiers(existingEmployees);
    const firstName = employeeData.firstName.trim();
    const lastName = employeeData.lastName.trim();

    const newEmp = {
      id: newId,
      employeeId: empCode,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      workEmail: employeeData.workEmail.trim().toLowerCase(),
      workPhone: (employeeData.workPhone || '').trim(),
      icPassportNumber: (employeeData.icPassportNumber || '').trim(),
      homeAddress: (employeeData.homeAddress || '').trim(),
      photo: `${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').toUpperCase()}`,
      employeeTypeId,
      status: employeeData.status,
      workMode: employeeData.workMode,
      allowance: employeeData.allowance,
      startDate: employeeData.startDate,
      contractEndDate: employeeData.contractEndDate || null,
      notes: (employeeData.notes || '').trim(),
      tags: [],
    };

    const newRec = {
      id: `rec-${newId.replace('emp-', '')}-1`,
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

    db.employees = [...existingEmployees, newEmp];
    db.employmentRecords = [...(db.employmentRecords || []), newRec];
    saveDatabase(db);

    return hydrateFromMockDb(db, newId);
  },

  /**
   * Refreshes Employees Directory data from the current source of truth.
   *
   * CURRENT (PoC, no backend): re-reads the local storage-engine database, identically
   * to getAll(). FUTURE: swap the implementation to fetch the latest employees from a
   * backend API/database — the call signature and hydrated-array return shape stay the
   * same, so callers (the Sync Employees button) require no changes when that happens.
   *
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async syncEmployees(options = {}) {
    return this.getAll({ hydrate: true, ...options });
  },
};

