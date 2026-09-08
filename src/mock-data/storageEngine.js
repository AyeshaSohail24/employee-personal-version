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
  };
  const migrated = migrateEmployeeTagsIfNeeded(base);
  return cleanupAttendanceIfNeeded(migrated);
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

    const migrated = migrateEmployeeTagsIfNeeded(parsed);
    const cleaned = cleanupAttendanceIfNeeded(migrated);
    return cleaned;
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

