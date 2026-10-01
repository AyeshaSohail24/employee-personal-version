import { loadDatabase, saveDatabase } from '../mock-data/storageEngine.js';
import { employeeService } from './employeeService.js';
import { offboardingService } from './offboardingService.js';
import { notesService } from './notesService.js';
import { NOTE_SORT_OPTIONS } from '../domain/noteDomain.js';
import {
  isValidExitType,
  isValidCustomExitType,
  OTHER_EXIT_TYPE,
  formatTenure,
  buildLifecycleHistory,
  withDefaultExitInfo,
} from '../domain/formerDomain.js';
import { toLocalDateString } from '../utils/dateUtils.js';
import { saveDocumentFile, getDocumentFile, deleteDocumentFile } from '../utils/documentFileStore.js';

// A DATE column as the local (Malaysia) calendar date. They arrive as full timestamps whose UTC
// form depends on the server's time zone ("2026-09-29T00:00:00.000Z" from a UTC server,
// "2026-09-28T16:00:00.000Z" from a UTC+8 one) — both are the 29th in Malaysia, while slicing the
// text would give the 28th for the second.
const dateOnly = (value) => (value ? toLocalDateString(value) || null : null);

/**
 * This person's REAL offboarding plan (the same one Offboarding → Progress/History use — GET
 * /offboarding/instances?employee_id=), summarised for the Historical Record page. Completion
 * follows the Offboarding History rule: every required task done; the completion date is the plan's
 * recorded completed_at, or — for a plan completed before that was recorded — the date its last task
 * was ticked. null when they have no plan (or aren't a local record, e.g. "intern-…" ids).
 */
async function getRealOffboardingSummary(employeeId) {
  if (String(employeeId).startsWith('intern-')) return null;
  let plan;
  try {
    plan = await offboardingService.getRealInstanceForEmployee(employeeId);
  } catch {
    return null;
  }
  const instance = plan?.instance;
  if (!instance) return null;
  const tasks = plan.taskInstances || [];
  const required = tasks.filter((t) => t.required);
  const isComplete = required.length > 0 && required.every((t) => t.completed);
  const lastTicked = tasks.map((t) => toLocalDateString(t.completed_at)).filter(Boolean).sort().pop() || null;
  return {
    id: instance.id,
    startedAt: dateOnly(instance.started_at),
    anchorDate: dateOnly(instance.anchor_date), // the Final Working Date (Day 0)
    completedAt: isComplete ? (dateOnly(instance.completed_at) || lastTicked) : null,
    derivedStatus: isComplete ? 'Completed' : 'In Progress',
    progress: { completedTasksCount: tasks.filter((t) => t.completed).length, totalTasks: tasks.length },
  };
}

/**
 * Data-access boundary for the Former Personnel module. Deliberately thin: Former is a
 * lifecycle-filtered HISTORICAL VIEW over the exact same Personnel identity employeeService
 * already owns — this file never stores a duplicate personnel record. It composes
 * employeeService (the master directory), offboardingService (the existing offboarding system),
 * and notesService (the existing Notes module) with the two small, genuinely-new satellite
 * concerns this module needed that had no home anywhere else: Exit Information
 * (`formerExitRecords`, keyed by employeeId) and Document metadata (`employeeDocuments`, keyed
 * by employeeId — reusing the field name documentTypeDomain.js already reserved but never
 * populated). UI pages never touch storageEngine.js directly for either.
 */
export const formerService = {
  /**
   * Queries the Former Personnel directory. Reuses employeeService.queryEmployees() with
   * baseLifecycleScope: 'Former' for every filter it already supports (search, Employee/Intern
   * type, Department, Sort By — including the two new 'finalDate-desc'/'finalDate-asc' sort
   * options added to that one shared function), then layers in each person's Exit Information
   * and Offboarding completion state (for the directory's OFFBOARDING column — reusing the
   * existing offboardingService, never a duplicate offboarding record) and, only client-side
   * (since no equivalent field exists on the Employee record to filter on server-side/in that
   * shared function), the optional Exit Type filter.
   *
   * @returns {Promise<{ employees: Array, baseCount: number, totalFilteredCount: number }>}
   */
  async getFormerDirectory({ search = '', typeFilter = 'All', departmentId = '', exitType = '', sortBy = 'name-asc' } = {}) {
    const res = await employeeService.queryEmployees({
      baseLifecycleScope: 'Former',
      typeFilter,
      departmentId,
      search,
      sortBy,
    });

    const db = loadDatabase();
    const exitRecords = db.formerExitRecords || [];
    const exitByEmployeeId = new Map(exitRecords.map((r) => [String(r.employeeId), r]));

    const allInstances = await offboardingService.getAllInstances();
    const offboardingByEmployeeId = new Map();
    allInstances.forEach((inst) => {
      const existing = offboardingByEmployeeId.get(inst.employeeId);
      // Prefer a Completed instance over any other for this column's simple summary — a person
      // can only ever have had one offboarding lifecycle actually finish.
      if (!existing || inst.derivedStatus === 'Completed') {
        offboardingByEmployeeId.set(inst.employeeId, inst);
      }
    });

    // No recorded Exit Information -> the default (Contract Ended — see withDefaultExitInfo()), so
    // the Exit Type column and filter show it too.
    let employeesWithExit = res.employees.map((emp) => ({
      ...emp,
      exitInfo: withDefaultExitInfo(exitByEmployeeId.get(String(emp.id)) || null),
      offboardingInstance: offboardingByEmployeeId.get(emp.id) || null,
    }));

    if (exitType) {
      employeesWithExit = employeesWithExit.filter((emp) => emp.exitInfo?.exitType === exitType);
    }

    return {
      employees: employeesWithExit,
      baseCount: res.baseCount,
      totalFilteredCount: employeesWithExit.length,
    };
  },

  /**
   * Composes everything the Historical Record page needs for one person, in one call. Returns
   * null both when the id does not resolve to any employee AND when it resolves to a real
   * employee whose CURRENT lifecycle status is not 'Former' — the page's not-found state treats
   * both identically ("Former Record Not Found"), per explicit requirement: a non-Former person
   * must never render as a historical record just because the route was visited directly.
   */
  async getHistoricalRecord(employeeId) {
    const employee = await employeeService.getById(employeeId);
    if (!employee || employee.status !== 'Former') return null;

    // The real offboarding plan (not the old browser-stored mock plans, which never contain real
    // people — that's why Offboarding Started/Completed used to show "—").
    const [exitInfo, offboardingInstance] = await Promise.all([
      this.getExitInfo(employeeId),
      getRealOffboardingSummary(employee.id),
    ]);
    const tenure = formatTenure(employee.startDate, employee.contractEndDate);
    const lifecycleHistory = buildLifecycleHistory(employee, offboardingInstance);

    return { employee, exitInfo, offboardingInstance, tenure, lifecycleHistory };
  },

  // The recorded Exit Information, or the default (Contract Ended) when none has been recorded.
  // Ids are compared as text: the record page passes the id from the URL ("35") while saves use the
  // employee's own numeric id (35) — a strict === never matched them, so after a reload the page
  // showed the default and a save wiped stored remarks.
  async getExitInfo(employeeId) {
    const db = loadDatabase();
    return withDefaultExitInfo((db.formerExitRecords || []).find((r) => String(r.employeeId) === String(employeeId)) || null);
  },

  /**
   * Creates or updates the one Exit Information record for a person (Edit Exit Information —
   * the one small, explicitly-scoped edit action Former allows). Exit Type is validated against
   * the controlled EXIT_TYPES list; Exit Remarks is free text and optional.
   */
  async setExitInfo(employeeId, { exitType = null, customExitType = '', exitRemarks = '' } = {}) {
    if (!isValidExitType(exitType)) {
      throw new Error('Please choose a valid Exit Type.');
    }
    if (!isValidCustomExitType(exitType, customExitType)) {
      throw new Error('Please specify the exit type.');
    }

    // customExitType is only ever meaningful for exitType === 'Other' — clearing it whenever a
    // predefined type is saved prevents a stale custom value from lingering after HR switches
    // away from Other (see the module's own switching-away behavior requirement).
    const resolvedCustomExitType = exitType === OTHER_EXIT_TYPE ? (customExitType || '').trim() : null;

    const db = loadDatabase();
    const records = db.formerExitRecords || [];
    const index = records.findIndex((r) => String(r.employeeId) === String(employeeId));
    const nowIso = new Date().toISOString();

    if (index === -1) {
      const newRecord = {
        id: `exit-${employeeId}-${Date.now()}`,
        employeeId,
        exitType: exitType || null,
        customExitType: resolvedCustomExitType,
        exitRemarks: (exitRemarks || '').trim(),
        recordedAt: nowIso,
      };
      db.formerExitRecords = [...records, newRecord];
      saveDatabase(db);
      return newRecord;
    }

    const updated = {
      ...records[index],
      exitType: exitType || null,
      customExitType: resolvedCustomExitType,
      exitRemarks: (exitRemarks || '').trim(),
      recordedAt: nowIso,
    };
    records[index] = updated;
    db.formerExitRecords = records;
    saveDatabase(db);
    return updated;
  },

  /** Documents recorded against this Personnel ID, newest first. */
  async getDocuments(employeeId) {
    const db = loadDatabase();
    return (db.employeeDocuments || [])
      .filter((d) => String(d.employeeId) === String(employeeId)) // URL id is text, stored id numeric
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  /**
   * Records a document against this Personnel ID. This app has no backend file storage, so — like
   * the document's details (title, file name, size, description), which live in this browser's
   * storage — the file itself is kept in this browser too (IndexedDB, utils/documentFileStore.js,
   * keyed by the document id; `hasFile: true`) so it can be opened later. Documents added before
   * that have no stored file (`hasFile` absent). A backend integration would change only this
   * function, getDocumentFile() and deleteDocument().
   */
  async addDocument(employeeId, { title, documentType, fileName, fileSize = null, documentDate = null, description = '', file = null } = {}) {
    if (!title || !title.trim()) {
      throw new Error('Document Title is required.');
    }
    // Document Type and Document Date are optional (the Former page's in-place form only asks for
    // Title, File and Description); older records that have them still show them.
    if (!fileName) {
      throw new Error('Please select a file.');
    }

    const id = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // The file first: if the browser can't store it, nothing is recorded (no un-openable document).
    if (file) {
      try {
        await saveDocumentFile(id, file);
      } catch (err) {
        throw new Error(`The file couldn't be saved in this browser (${err?.message || 'storage unavailable'}).`);
      }
    }

    const db = loadDatabase();
    const docs = db.employeeDocuments || [];
    const newDoc = {
      id,
      employeeId,
      title: title.trim(),
      documentType: documentType || null,
      fileName,
      fileSize,
      fileType: file?.type || null,
      hasFile: Boolean(file),
      documentDate: documentDate || null,
      description: (description || '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.employeeDocuments = [newDoc, ...docs];
    saveDatabase(db);
    return newDoc;
  },

  /**
   * Edits one document: its title and description, and — only when a new `file` is given — replaces
   * its stored file (name, size and type follow). Leaving `file` out keeps the current file.
   */
  async updateDocument(employeeId, documentId, { title, description = '', file = null } = {}) {
    if (!title || !title.trim()) {
      throw new Error('Document Title is required.');
    }
    const db = loadDatabase();
    const docs = db.employeeDocuments || [];
    const index = docs.findIndex((d) => d.id === documentId && String(d.employeeId) === String(employeeId));
    if (index === -1) throw new Error('That document no longer exists.');

    if (file) {
      try {
        await saveDocumentFile(documentId, file);
      } catch (err) {
        throw new Error(`The new file couldn't be saved in this browser (${err?.message || 'storage unavailable'}).`);
      }
    }

    const updated = {
      ...docs[index],
      title: title.trim(),
      description: (description || '').trim(),
      ...(file ? { fileName: file.name, fileSize: file.size, fileType: file.type || null, hasFile: true } : {}),
      updatedAt: new Date().toISOString(),
    };
    // Re-read before writing: the file save above was asynchronous.
    const fresh = loadDatabase();
    fresh.employeeDocuments = (fresh.employeeDocuments || []).map((d) => (d.id === documentId ? updated : d));
    saveDatabase(fresh);
    return updated;
  },

  /** The stored file for a document (a File/Blob), or null if none was saved (older documents). */
  async getDocumentFile(documentId) {
    return getDocumentFile(documentId).catch(() => null);
  },

  /** Removes one document record from this Personnel ID (the same browser-stored metadata addDocument() writes). */
  async deleteDocument(employeeId, documentId) {
    const db = loadDatabase();
    const docs = db.employeeDocuments || [];
    const remaining = docs.filter((d) => !(d.id === documentId && String(d.employeeId) === String(employeeId)));
    if (remaining.length === docs.length) throw new Error('That document no longer exists.');
    db.employeeDocuments = remaining;
    saveDatabase(db);
    await deleteDocumentFile(documentId).catch(() => {}); // its stored file, if any
  },

  /**
   * Notes linked to this Personnel ID — reuses the existing Notes module's own getAll() with its
   * new (additive, optional) relatedEmployeeId filter, never a second notes store. Scoped to
   * 'my' (non-archived), matching what "HR Notes" on a Historical Record page should show.
   */
  async getNotesForPersonnel(employeeId) {
    return notesService.getAll({ scope: 'my', relatedEmployeeId: employeeId, sortBy: NOTE_SORT_OPTIONS.NEWEST });
  },

  /**
   * Creates a note through the EXISTING Notes module (notesService.create) with
   * relatedEmployeeId set — the note is a completely normal note in every other respect, so it
   * appears in the main Notes module exactly like any other note, satisfying "reuse, don't
   * duplicate" rather than building a second note-writing path.
   */
  async addNoteForPersonnel(employeeId, { title, content, category } = {}) {
    return notesService.create({ title, content, category, relatedEmployeeId: employeeId });
  },

  /** Edits an HR note's title and text — through the EXISTING Notes module (same note there). */
  async updateNoteForPersonnel(noteId, { title, content } = {}) {
    return notesService.update(noteId, { title, content });
  },

  /** Permanently deletes an HR note — through the EXISTING Notes module, so it's gone there too. */
  async deleteNoteForPersonnel(noteId) {
    return notesService.deletePermanently(noteId);
  },
};
