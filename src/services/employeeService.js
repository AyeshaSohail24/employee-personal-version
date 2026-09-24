import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { apiClient } from './apiClient.js';
import { resolveHydratedEmployee, compareEmployeeIdNumeric } from '../domain/employmentDomain.js';
import { filterEmployeesByStatus } from '../domain/lifecycleDomain.js';

// create() below still writes to the mock
// localStorage db (not yet rewired to the real API) — this keeps its
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
      // Live-read from the Interns DB for an intern-linked employee (see icPassportNumber's
      // identical note below) — null for a non-intern employee.
      photoUrl: employee.photoUrl || null,
      status: employee.status,
      personal: {
        firstName: employee.firstName || null,
        lastName: employee.lastName || null,
        email: employee.workEmail || null,
        contactNumber: employee.workPhone || null,
        // Live-read from the Interns DB for an intern-linked employee (server's GET /employees/{id}
        // — see internSync.js's getInternPersonalDetails()); null for a non-intern employee, since
        // there's no Interns DB record to read from at all.
        icPassportNumber: employee.icPassportNumber || null,
        homeAddress: employee.homeAddress || null,
        // Confirmed NOT tracked anywhere in the Interns DB's own schema either (checked its
        // published OpenAPI Intern properties directly) — genuinely no source to read this from,
        // not just "not yet collected".
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
        // This app's own local positions table, keyed by employment_records.position_id — never
        // populated for an intern-synced employee (checked: the Interns DB's role_id is an
        // access-control concept for ITS OWN admin UI — Admin/Employee/Intern/Manager/Supervisor —
        // not a job title; every intern would resolve to the same "Intern" value, just duplicating
        // the Type field above, so it's intentionally not wired to that instead).
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
   * @param {Array<Object>} [options.sourceEmployees] - Pre-fetched hydrated employees to filter/sort
   *   instead of re-reading GET /employees — used by the Sync Personnel refresh (see syncEmployees())
   *   so its live-overlaid, unpersisted result is what's actually displayed, not discarded in favor
   *   of a fresh read of the (unchanged) local database.
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
    sourceEmployees = null,
  } = {}) {
    const allEmployees = sourceEmployees || (await this.getAll({ hydrate: true }));

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
   * Refreshes Personnel from the actual source of truth: GETs /employees/sync (server/routes/
   * employees.js's listEmployeesLive(), the same read-only path GET /employees itself already
   * uses — see internSync.js's overlayInternFields()). Every intern-linked employee's Personnel
   * ID/Status/Mode/Allowance/Start Date/Contract End Date is read live from the Interns DB, in
   * memory only — nothing is written to either the local database or the Interns DB, and nothing
   * here needs write permission. Because GET /employees already applies this same overlay, a
   * plain page load or full browser refresh shows the same fresh data this explicit action does;
   * this exists as its own call purely so the Sync Personnel button has something distinct to
   * trigger on demand.
   * @returns {Promise<Array<Object>>}
   */
  async syncEmployees() {
    // An explicit refresh must never be answered from apiClient's short-lived GET cache, and
    // everything else read before it (other tabs' rosters, filter options) is cleared too, so the
    // whole app reflects the Interns DB as of this click — not just this one list.
    apiClient.invalidate();
    const { employees } = await apiClient.get('/employees/sync', { fresh: true });
    return employees;
  },
};

