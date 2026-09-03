import { seedEmployeeTypes } from './seedEmployeeTypes.js';
import { seedDepartments } from './seedDepartments.js';
import { seedPositions } from './seedPositions.js';
import { seedLocations } from './seedLocations.js';
import { seedSchedules } from './seedSchedules.js';
import { seedEmployees } from './seedEmployees.js';
import { seedEmploymentRecords } from './seedEmploymentRecords.js';
import { seedUserAccounts } from './seedUserAccounts.js';
import { seedLeaves } from './seedLeaves.js';
import { seedAttendance } from './seedAttendance.js';
import { seedPresenceOverrides } from './seedPresenceOverrides.js';

const STORAGE_KEY = 'rizurf_hr_poc_v1';

function getInitialState() {
  return {
    employeeTypes: seedEmployeeTypes,
    departments: seedDepartments,
    positions: seedPositions,
    locations: seedLocations,
    schedules: seedSchedules,
    employees: seedEmployees,
    employmentRecords: seedEmploymentRecords,
    userAccounts: seedUserAccounts,
    leaves: seedLeaves,
    attendance: seedAttendance,
    presenceOverrides: seedPresenceOverrides,
  };
}

export function loadDatabase() {
  try {
    if (typeof localStorage === 'undefined') {
      return getInitialState();
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialState();
      saveDatabase(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    return getInitialState();
  }
}

export function saveDatabase(db) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  } catch (err) {
    console.error('StorageEngine: failed to save to localStorage.', err);
  }
}

export function resetDatabase() {
  const initial = getInitialState();
  saveDatabase(initial);
  return initial;
}
