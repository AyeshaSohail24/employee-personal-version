import { seedEmployeeTypes } from './seedEmployeeTypes.js';
import { seedEmployeeTags } from './seedEmployeeTags.js';
import { seedDepartments } from './seedDepartments.js';
import { seedPositions } from './seedPositions.js';
import { seedLocations } from './seedLocations.js';
import { seedSchedules } from './seedSchedules.js';
import { seedEmployees } from './seedEmployees.js';
import { seedEmploymentRecords } from './seedEmploymentRecords.js';
import { seedUserAccounts } from './seedUserAccounts.js';
import { seedLeaves } from './seedLeaves.js';
import { seedPresenceOverrides } from './seedPresenceOverrides.js';
import { seedActivityTypes } from './seedActivityTypes.js';
import { seedActivities } from './seedActivities.js';
import { seedOnboardingPlanTemplates, seedOnboardingPlanTasks } from './seedOnboardingTemplates.js';
import { seedOnboardingPlanInstances, seedOnboardingTaskInstances } from './seedOnboardingInstances.js';
import { seedOffboardingPlanTemplates, seedOffboardingPlanTasks } from './seedOffboardingTemplates.js';
import { seedOffboardingPlanInstances, seedOffboardingTaskInstances } from './seedOffboardingInstances.js';
import { seedDocumentTypes } from './seedDocumentTypes.js';
import { seedUpcomingCandidates } from './seedUpcomingCandidates.js';
import { seedEmailTemplates } from './seedEmailTemplates.js';
import { seedNotes } from './seedNotes.js';

const STORAGE_KEY = 'rizurf_hr_poc_v1';
let inMemoryDb = null;

function generateStorageTagId(existingTags = []) {
  const existingIds = new Set(existingTags.map((t) => t.id));
  let candidate;
  do {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `tag-${timestamp}-${randomSuffix}`;
  } while (existingIds.has(candidate));
  return candidate;
}

export function migrateEmployeeTagsIfNeeded(db) {
  if (!db) return db;

  let mutated = false;

  if (!db.employeeTags || db.employeeTags.length === 0) {
    db.employeeTags = [...seedEmployeeTags];
    mutated = true;
  }

  const tagMap = new Map();
  db.employeeTags.forEach((t) => {
    if (t && t.name) {
      tagMap.set(t.name.trim().toLowerCase(), t.id);
    }
  });

  const knownTagIds = new Set(db.employeeTags.map((t) => t.id));

  db.employees = (db.employees || []).map((emp) => {
    if (!Array.isArray(emp.tags)) return { ...emp, tags: [] };

    const canonicalIds = new Set();
    let empTagsChanged = false;

    emp.tags.forEach((rawTag) => {
      if (typeof rawTag !== 'string') return;
      const trimmed = rawTag.trim();
      if (!trimmed) return;

      // 1. Already a valid tag ID
      if (knownTagIds.has(trimmed)) {
        canonicalIds.add(trimmed);
        return;
      }

      empTagsChanged = true;

      // 2. Case and whitespace normalization match
      const normalized = trimmed.toLowerCase();
      if (tagMap.has(normalized)) {
        canonicalIds.add(tagMap.get(normalized));
        return;
      }

      // 3. Unknown tag -> Create canonical EmployeeTag record
      const newTagId = generateStorageTagId(db.employeeTags);
      const newTagRecord = {
        id: newTagId,
        name: trimmed,
        category: 'General',
        color: '#64748B',
        active: true,
      };
      db.employeeTags.push(newTagRecord);
      tagMap.set(normalized, newTagId);
      knownTagIds.add(newTagId);
      canonicalIds.add(newTagId);
    });

    const newTagArray = Array.from(canonicalIds);
    if (empTagsChanged || newTagArray.length !== emp.tags.length) {
      mutated = true;
    }

    return { ...emp, tags: newTagArray };
  });

  if (mutated) {
    inMemoryDb = db;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (err) {
        console.error('StorageEngine: failed to save tag migration to localStorage.', err);
      }
    }
  }

  return db;
}

/**
 * Migrates legacy onboardingPlanTasks (tied only to a full PlanTemplate via planTemplateId)
 * into the composable scope model by additively tagging scopeType/scopeDepartmentId.
 * Non-destructive: existing fields (planTemplateId, assignmentRule, specificAssigneeId, etc.)
 * are preserved untouched for historical/legacy display — only new fields are added.
 * Mapping is derived from the task's own template metadata, never from guessing at task
 * titles/content: a template with a real departmentId becomes that Department's scope; a
 * template with no department is Employee scope unless its NAME is clearly an
 * internship/apprenticeship template, in which case it becomes Intern scope. Nothing is ever
 * classified as Universal here — Universal starts empty and is populated later by HR via the UI.
 */
export function migrateOnboardingScopesIfNeeded(db) {
  if (!db || !Array.isArray(db.onboardingPlanTasks)) return db;

  const needsMigration = db.onboardingPlanTasks.some((t) => t && !t.scopeType);
  if (!needsMigration) return db;

  const templates = db.onboardingPlanTemplates || [];
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  db.onboardingPlanTasks = db.onboardingPlanTasks.map((t) => {
    if (!t || t.scopeType) return t;

    const tpl = templateMap.get(t.planTemplateId) || null;
    let scopeType = 'employee';
    let scopeDepartmentId = null;

    if (tpl) {
      if (tpl.departmentId) {
        scopeType = 'department';
        scopeDepartmentId = tpl.departmentId;
      } else {
        const nameLower = (tpl.name || '').toLowerCase();
        scopeType = /intern|apprentice/.test(nameLower) ? 'intern' : 'employee';
      }
    }

    return { ...t, scopeType, scopeDepartmentId };
  });

  inMemoryDb = db;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (err) {
      console.error('StorageEngine: failed to save onboarding scope migration to localStorage.', err);
    }
  }

  return db;
}

/**
 * Migrates the (now legacy) 4-bucket onboarding scope model — Universal / Employee / Intern /
 * Department — into a person-type-aware 2-axis model: every task now carries an explicit
 * `personType` ('employee' | 'intern') alongside a `scopeType` that is only ever 'universal' or
 * 'department' (the old 'employee'/'intern' scopeType values are retired as a SCOPE concept —
 * that distinction now lives entirely in `personType`). Additive and non-destructive: runs once
 * (whenever any task is missing `personType`), and NEVER drops a task.
 *
 * Mapping decisions (each one derived directly from the OLD scope this task already carried by
 * the prior migration above — never guessed from task titles/content):
 *
 *  - old scopeType 'employee'   -> new scopeType 'universal', personType 'employee'
 *    (this bucket was already 100% employee-only; it becomes "Employee Universal".)
 *  - old scopeType 'intern'     -> new scopeType 'universal', personType 'intern'
 *    (likewise, becomes "Intern Universal".)
 *  - old scopeType 'universal'  -> DUPLICATED into personType 'employee' AND 'intern' (two
 *    records, same content, new unique ids). Reason: the old Universal bucket, by definition,
 *    applied to every employee AND every intern with no type filtering at all — collapsing it
 *    into just one person type would silently remove it from the other type's onboarding for
 *    all FUTURE launches. Duplicating is the only additive choice that preserves this bucket's
 *    original "applies to everyone" intent for both types now that Universal itself must be
 *    type-scoped.
 *  - old scopeType 'department' -> DUPLICATED into personType 'employee' AND 'intern' (two
 *    records per original task, same scopeDepartmentId, new unique ids). Reason: department
 *    scope was previously type-agnostic too — composeOnboardingTasks() applied a department's
 *    tasks to any employee OR intern in that department. This is the exact "Software
 *    Engineering legacy department scope" case called out in the task brief: since the source
 *    data gives no way to unambiguously say these 4 tasks were "for employees only" vs "for
 *    interns only", duplicating (not guessing) is the safe, documented, additive choice —
 *    preserving the identical applicability every existing person in that department already
 *    had, for both types going forward.
 *
 * A brand-new task created directly with `personType` already set (not possible pre-migration,
 * but defensive) is left completely untouched.
 */
export function migrateOnboardingPersonTypeIfNeeded(db) {
  if (!db || !Array.isArray(db.onboardingPlanTasks)) return db;

  const needsMigration = db.onboardingPlanTasks.some((t) => t && t.scopeType && !t.personType);
  if (!needsMigration) return db;

  const migrated = [];
  let dupSuffix = 0;

  db.onboardingPlanTasks.forEach((t) => {
    if (!t || !t.scopeType || t.personType) {
      migrated.push(t);
      return;
    }

    if (t.scopeType === 'employee') {
      migrated.push({ ...t, scopeType: 'universal', personType: 'employee' });
    } else if (t.scopeType === 'intern') {
      migrated.push({ ...t, scopeType: 'universal', personType: 'intern' });
    } else if (t.scopeType === 'universal' || t.scopeType === 'department') {
      dupSuffix += 1;
      migrated.push({ ...t, personType: 'employee' });
      migrated.push({ ...t, id: `${t.id}-intern-dup-${dupSuffix}`, personType: 'intern' });
    } else {
      // Unrecognized legacy scopeType — preserved as-is rather than silently dropped.
      migrated.push(t);
    }
  });

  db.onboardingPlanTasks = migrated;

  inMemoryDb = db;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (err) {
      console.error('StorageEngine: failed to save onboarding person-type migration to localStorage.', err);
    }
  }

  return db;
}

export function cleanupAttendanceIfNeeded(db) {
  if (!db) return db;
  if ('attendance' in db) {
    delete db.attendance;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (err) {
        console.error('StorageEngine: failed to save attendance cleanup to localStorage.', err);
      }
    }
  }
  return db;
}

export function cleanupParentDepartmentIfNeeded(db) {
  if (!db || !Array.isArray(db.departments)) return db;

  let mutated = false;
  db.departments = db.departments.map((dept) => {
    if ('parentDepartmentId' in dept || 'parentDept' in dept) {
      mutated = true;
      const { parentDepartmentId, parentDept, ...rest } = dept;
      return rest;
    }
    return dept;
  });

  if (mutated) {
    inMemoryDb = db;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (err) {
        console.error('StorageEngine: failed to save parent department cleanup to localStorage.', err);
      }
    }
  }
  return db;
}

export function cleanupPenangLocationIfNeeded(db) {
  if (!db) return db;

  let mutated = false;
  const PENANG_ID = 'loc-2';
  const HQ_ID = 'loc-1';

  // 1. Remove Penang location from db.locations if present
  if (Array.isArray(db.locations)) {
    const penangIndex = db.locations.findIndex(
      (l) => l.id === PENANG_ID || (l.name && l.name.includes('Penang'))
    );
    if (penangIndex !== -1) {
      db.locations.splice(penangIndex, 1);
      mutated = true;
    }
  }

  // 2. Reassign employmentRecords referencing PENANG_ID to HQ_ID
  if (Array.isArray(db.employmentRecords)) {
    db.employmentRecords = db.employmentRecords.map((rec) => {
      if (rec.locationId === PENANG_ID) {
        mutated = true;
        return { ...rec, locationId: HQ_ID };
      }
      return rec;
    });
  }

  // 3. Reassign positions referencing PENANG_ID as defaultLocationId to HQ_ID
  if (Array.isArray(db.positions)) {
    db.positions = db.positions.map((pos) => {
      if (pos.defaultLocationId === PENANG_ID) {
        mutated = true;
        return { ...pos, defaultLocationId: HQ_ID };
      }
      return pos;
    });
  }

  if (mutated) {
    inMemoryDb = db;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (err) {
        console.error('StorageEngine: failed to save Penang location cleanup to localStorage.', err);
      }
    }
  }
  return db;
}

export function cleanupTechnologyDepartmentIfNeeded(db) {
  if (!db) return db;

  let mutated = false;
  const TECH_ID = 'dept-2';
  const EXEC_ID = 'dept-1';

  // 1. Remove Technology department from db.departments if present
  if (Array.isArray(db.departments)) {
    const techIndex = db.departments.findIndex(
      (d) => d.id === TECH_ID || (d.name && d.name.trim().toLowerCase() === 'technology')
    );
    if (techIndex !== -1) {
      db.departments.splice(techIndex, 1);
      mutated = true;
    }
  }

  // 2. Reassign employmentRecords referencing TECH_ID to EXEC_ID
  if (Array.isArray(db.employmentRecords)) {
    db.employmentRecords = db.employmentRecords.map((rec) => {
      if (rec.departmentId === TECH_ID) {
        mutated = true;
        return { ...rec, departmentId: EXEC_ID };
      }
      return rec;
    });
  }

  // 3. Reassign positions referencing TECH_ID to EXEC_ID
  if (Array.isArray(db.positions)) {
    db.positions = db.positions.map((pos) => {
      if (pos.departmentId === TECH_ID) {
        mutated = true;
        return { ...pos, departmentId: EXEC_ID };
      }
      return pos;
    });
  }

  if (mutated) {
    inMemoryDb = db;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (err) {
        console.error('StorageEngine: failed to save Technology department cleanup to localStorage.', err);
      }
    }
  }
  return db;
}

function getInitialState() {
  const base = {
    employeeTypes: seedEmployeeTypes,
    employeeTags: seedEmployeeTags,
    departments: seedDepartments,
    positions: seedPositions,
    locations: seedLocations,
    schedules: seedSchedules,
    employees: seedEmployees,
    employmentRecords: seedEmploymentRecords,
    userAccounts: seedUserAccounts,
    leaves: seedLeaves,
    presenceOverrides: seedPresenceOverrides,
    activityTypes: seedActivityTypes,
    activities: seedActivities,
    onboardingPlanTemplates: seedOnboardingPlanTemplates,
    onboardingPlanTasks: seedOnboardingPlanTasks,
    onboardingPlanInstances: seedOnboardingPlanInstances,
    onboardingTaskInstances: seedOnboardingTaskInstances,
    offboardingPlanTemplates: seedOffboardingPlanTemplates,
    offboardingPlanTasks: seedOffboardingPlanTasks,
    offboardingPlanInstances: seedOffboardingPlanInstances,
    offboardingTaskInstances: seedOffboardingTaskInstances,
    documentTypes: seedDocumentTypes,
    upcomingCandidates: seedUpcomingCandidates,
    emailTemplates: seedEmailTemplates,
    candidateEmailLog: [],
    // Shallow-copied (not aliased) — notesService.update()/archive()/etc. replace an array
    // INDEX in place (`notes[index] = updatedNote; db.notes = notes;`); aliasing this straight
    // to the imported seedNotes array would let that in-place write permanently corrupt the
    // shared seed module singleton for the rest of the process, so a later resetDatabase()
    // could never actually restore the original seed note again.
    notes: [...seedNotes],
    // In-app notification records (currently only 'note_reminder' type). Starts empty — the
    // app opens with real current persisted data only, never fake/demo notifications.
    notifications: [],
  };
  const migrated = migrateEmployeeTagsIfNeeded(base);
  const cleanedAtt = cleanupAttendanceIfNeeded(migrated);
  const cleanedDept = cleanupParentDepartmentIfNeeded(cleanedAtt);
  const cleanedLoc = cleanupPenangLocationIfNeeded(cleanedDept);
  const cleanedTech = cleanupTechnologyDepartmentIfNeeded(cleanedLoc);
  const scopedOnboarding = migrateOnboardingScopesIfNeeded(cleanedTech);
  return migrateOnboardingPersonTypeIfNeeded(scopedOnboarding);
}

export function loadDatabase() {
  try {
    if (typeof localStorage === 'undefined') {
      if (!inMemoryDb) {
        inMemoryDb = getInitialState();
      }
      return inMemoryDb;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialState();
      saveDatabase(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed.employeeTypes) parsed.employeeTypes = seedEmployeeTypes;
    if (!parsed.employeeTags) parsed.employeeTags = seedEmployeeTags;
    if (!parsed.schedules) parsed.schedules = seedSchedules;
    if (!parsed.activityTypes) parsed.activityTypes = seedActivityTypes;
    if (!parsed.activities) parsed.activities = seedActivities;
    if (!parsed.onboardingPlanTemplates) parsed.onboardingPlanTemplates = seedOnboardingPlanTemplates;
    if (!parsed.onboardingPlanTasks) parsed.onboardingPlanTasks = seedOnboardingPlanTasks;
    if (!parsed.onboardingPlanInstances) parsed.onboardingPlanInstances = seedOnboardingPlanInstances;
    if (!parsed.onboardingTaskInstances) parsed.onboardingTaskInstances = seedOnboardingTaskInstances;
    if (!parsed.offboardingPlanTemplates) parsed.offboardingPlanTemplates = seedOffboardingPlanTemplates;
    if (!parsed.offboardingPlanTasks) parsed.offboardingPlanTasks = seedOffboardingPlanTasks;
    if (!parsed.offboardingPlanInstances) parsed.offboardingPlanInstances = seedOffboardingPlanInstances;
    if (!parsed.offboardingTaskInstances) parsed.offboardingTaskInstances = seedOffboardingTaskInstances;
    if (!parsed.documentTypes) parsed.documentTypes = seedDocumentTypes;
    if (!parsed.upcomingCandidates) parsed.upcomingCandidates = seedUpcomingCandidates;
    if (!parsed.emailTemplates) parsed.emailTemplates = seedEmailTemplates;
    if (!parsed.candidateEmailLog) parsed.candidateEmailLog = [];
    if (!parsed.notes) parsed.notes = [...seedNotes];
    if (!parsed.notifications) parsed.notifications = [];

    const migrated = migrateEmployeeTagsIfNeeded(parsed);
    const cleanedAtt = cleanupAttendanceIfNeeded(migrated);
    const cleanedDept = cleanupParentDepartmentIfNeeded(cleanedAtt);
    const cleanedLoc = cleanupPenangLocationIfNeeded(cleanedDept);
    const cleanedTech = cleanupTechnologyDepartmentIfNeeded(cleanedLoc);
    const scopedOnboarding = migrateOnboardingScopesIfNeeded(cleanedTech);
    return migrateOnboardingPersonTypeIfNeeded(scopedOnboarding);
  } catch (err) {
    if (!inMemoryDb) {
      inMemoryDb = getInitialState();
    }
    return inMemoryDb;
  }
}

export function saveDatabase(db) {
  try {
    inMemoryDb = db;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  } catch (err) {
    inMemoryDb = db;
    console.error('StorageEngine: failed to save to localStorage.', err);
  }
}

export function resetDatabase() {
  const initial = getInitialState();
  inMemoryDb = initial;
  if (typeof localStorage !== 'undefined') {
    saveDatabase(initial);
  }
  return initial;
}

