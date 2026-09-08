import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { getCurrentWorkforce, resolveCurrentRecord } from '../domain/employmentDomain.js';
import { resolvePresenceState, PRESENCE_STATES } from '../domain/presenceDomain.js';

/**
 * Service providing asynchronous operational presence data and override management.
 */
export const presenceService = {
  /**
   * Retrieves current workforce presence overview, summary metrics, and filtered employee list.
   * @param {Object} params { search, presenceStateFilter, departmentId, workModeFilter, referenceDate }
   * @returns {Promise<Object>}
   */
  async getPresenceOverview(params = {}) {
    const {
      search = '',
      presenceStateFilter = 'All',
      departmentId = '',
      workModeFilter = 'All',
      referenceDate = '2026-09-03',
    } = params;

    const db = loadDatabase();
    const employees = db.employees || [];
    const records = db.employmentRecords || [];
    const depts = db.departments || [];
    const positions = db.positions || [];
    const locations = db.locations || [];
    const schedules = db.schedules || [];
    const leaves = db.leaves || [];
    const presenceOverrides = db.presenceOverrides || [];

    // 1. Get 15 current workforce employees (Active, Onboarding, Departing)
    const currentWorkforce = getCurrentWorkforce(employees, records, referenceDate);

    // 2. Hydrate each employee with department, position, location, work mode, and resolved presence
    const hydratedList = currentWorkforce.map((emp) => {
      const rec = resolveCurrentRecord(emp.id, records, referenceDate);
      const dept = rec ? depts.find((d) => d.id === rec.departmentId) : null;
      const pos = rec ? positions.find((p) => p.id === rec.positionId) : null;
      const loc = rec ? locations.find((l) => l.id === rec.locationId) : null;
      const sched = rec ? schedules.find((s) => s.id === rec.scheduleId) : null;

      // Determine Work Mode (On-site / Remote / Hybrid)
      let workMode = 'On-site';
      if (loc && loc.type === 'Remote') workMode = 'Remote';
      else if (sched && sched.name.toLowerCase().includes('hybrid')) workMode = 'Hybrid';

      // Resolve Presence State
      const presence = resolvePresenceState(
        emp.id,
        employees,
        records,
        leaves,
        presenceOverrides,
        schedules,
        [],
        referenceDate
      );

      return {
        ...emp,
        department: dept ? { id: dept.id, name: dept.name, color: dept.color } : null,
        position: pos ? { id: pos.id, name: pos.name } : null,
        location: loc ? { id: loc.id, name: loc.name, type: loc.type } : null,
        workMode,
        presenceState: presence.state,
        presenceSource: presence.source,
        presenceDetails: presence.details,
      };
    });

    // 3. Compute Summary KPI Counts across entire current workforce
    const summary = {
      totalWorkforce: currentWorkforce.length,
      [PRESENCE_STATES.PRESENT]: 0,
      [PRESENCE_STATES.REMOTE]: 0,
      [PRESENCE_STATES.ON_LEAVE]: 0,
      [PRESENCE_STATES.ABSENT]: 0,
      [PRESENCE_STATES.NOT_SCHEDULED]: 0,
      [PRESENCE_STATES.UNKNOWN]: 0,
    };

    hydratedList.forEach((item) => {
      if (summary[item.presenceState] !== undefined) {
        summary[item.presenceState] += 1;
      }
    });

    // 4. Apply Interactive Filters
    let filtered = hydratedList;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          (e.position && e.position.name.toLowerCase().includes(q))
      );
    }

    if (presenceStateFilter && presenceStateFilter !== 'All') {
      filtered = filtered.filter((e) => e.presenceState === presenceStateFilter);
    }

    if (departmentId) {
      filtered = filtered.filter((e) => e.department && e.department.id === departmentId);
    }

    if (workModeFilter && workModeFilter !== 'All') {
      filtered = filtered.filter((e) => e.workMode === workModeFilter);
    }

    return {
      summary,
      employees: filtered,
      totalCount: currentWorkforce.length,
      filteredCount: filtered.length,
    };
  },

  /**
   * Resolves presence state for a single employee.
   * @param {string} employeeId
   * @param {string} referenceDate
   * @returns {Promise<Object>}
   */
  async getEmployeePresence(employeeId, referenceDate = '2026-09-03') {
    const db = loadDatabase();
    return resolvePresenceState(
      employeeId,
      db.employees,
      db.employmentRecords,
      db.leaves,
      db.presenceOverrides,
      db.schedules,
      [],
      referenceDate
    );
  },

  /**
   * Creates a new manual presence override (appends audit record).
   * @param {Object} overrideData { employeeId, overrideState, reason, createdBy }
   * @returns {Promise<Object>}
   */
  async createPresenceOverride({ employeeId, overrideState, reason, createdBy = 'Ayesha Z. (HR Admin)' }) {
    const db = loadDatabase();
    const overrides = db.presenceOverrides || [];

    // End any existing active override for this employee
    overrides.forEach((ovr) => {
      if (ovr.employeeId === employeeId && ovr.active === true) {
        ovr.active = false;
        ovr.endedAt = new Date().toISOString();
        ovr.endedBy = createdBy;
        ovr.reasonEnded = 'Superseded by new override';
      }
    });

    // Create new override
    const newRecord = {
      id: `ovr-${Date.now()}`,
      employeeId,
      overrideState,
      reason,
      createdAt: new Date().toISOString(),
      createdBy,
      active: true,
      endedAt: null,
      endedBy: null,
      reasonEnded: null,
    };

    overrides.push(newRecord);
    db.presenceOverrides = overrides;
    saveDatabase(db);

    return newRecord;
  },

  /**
   * Clears an active manual override while preserving audit history.
   * @param {string} employeeId
   * @param {string} endedBy
   * @returns {Promise<boolean>}
   */
  async clearPresenceOverride(employeeId, endedBy = 'Ayesha Z. (HR Admin)') {
    const db = loadDatabase();
    const overrides = db.presenceOverrides || [];

    let updated = false;
    overrides.forEach((ovr) => {
      if (ovr.employeeId === employeeId && ovr.active === true) {
        ovr.active = false;
        ovr.endedAt = new Date().toISOString();
        ovr.endedBy = endedBy;
        ovr.reasonEnded = 'Manual override cleared by HR';
        updated = true;
      }
    });

    if (updated) {
      db.presenceOverrides = overrides;
      saveDatabase(db);
    }

    return updated;
  },

  /**
   * Retrieves the full audit history of overrides for an employee.
   * @param {string} employeeId
   * @returns {Promise<Array<Object>>}
   */
  async getPresenceOverrideHistory(employeeId) {
    const db = loadDatabase();
    const overrides = db.presenceOverrides || [];

    return overrides
      .filter((o) => o.employeeId === employeeId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
};
