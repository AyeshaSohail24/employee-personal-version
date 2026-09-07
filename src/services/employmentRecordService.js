import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { resolveCurrentRecord } from '../domain/employmentDomain.js';

/**
 * Service providing asynchronous access to append-only EmploymentRecord entities.
 */
export const employmentRecordService = {
  /**
   * Retrieves all employment records.
   * @returns {Promise<Array<Object>>}
   */
  async getAll() {
    const db = loadDatabase();
    return db.employmentRecords || [];
  },

  /**
   * Retrieves all employment records for a given employee ID.
   * @param {string} employeeId
   * @returns {Promise<Array<Object>>} Sorted by effectiveFrom descending
   */
  async getHistoryByEmployeeId(employeeId) {
    const db = loadDatabase();
    const records = (db.employmentRecords || []).filter((r) => r.employeeId === employeeId);
    records.sort((a, b) => (b.effectiveFrom || '').localeCompare(a.effectiveFrom || ''));
    return records;
  },

  /**
   * Resolves the active employment record for an employee on a given date.
   * @param {string} employeeId
   * @param {string|Date} [referenceDate]
   * @returns {Promise<Object|null>}
   */
  async getCurrentRecord(employeeId, referenceDate = new Date()) {
    const db = loadDatabase();
    const records = db.employmentRecords || [];
    return resolveCurrentRecord(employeeId, records, referenceDate);
  },

  /**
   * Appends a new employment record and closes the previous active record's effectiveTo date.
   * @param {Object} recordData - Must contain employeeId, departmentId, positionId, managerId, effectiveFrom
   * @returns {Promise<Object>} The created record
   */
  async addRecord(recordData) {
    const db = loadDatabase();
    const records = db.employmentRecords || [];
    const effectiveFrom = recordData.effectiveFrom || new Date().toISOString().slice(0, 10);

    // Close existing active record if effectiveTo is null
    const currentActive = resolveCurrentRecord(recordData.employeeId, records, effectiveFrom);
    if (currentActive && currentActive.effectiveTo === null) {
      const prevDate = new Date(effectiveFrom);
      prevDate.setDate(prevDate.getDate() - 1);
      currentActive.effectiveTo = prevDate.toISOString().slice(0, 10);
    }

    const newRecord = {
      id: `rec-${Date.now()}`,
      employeeId: recordData.employeeId,
      departmentId: recordData.departmentId || null,
      positionId: recordData.positionId || null,
      managerId: recordData.managerId || null,
      supervisorId: recordData.supervisorId || null,
      locationId: recordData.locationId || null,
      scheduleId: recordData.scheduleId || null,
      effectiveFrom,
      effectiveTo: recordData.effectiveTo || null,
      changeReason: recordData.changeReason || 'Organization Change',
    };

    records.push(newRecord);
    saveDatabase(db);
    return newRecord;
  },
};
