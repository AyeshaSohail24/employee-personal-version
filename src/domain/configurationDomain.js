/**
 * Pure domain logic and validation rules for Stage 11 Configuration & HR Master Data Management.
 */

export const SUPPORTED_LOCATION_TYPES = ['Office', 'Branch', 'Remote', 'Client Site'];
export const SUPPORTED_ACTIVITY_CATEGORIES = ['General', 'Compliance', 'HR', 'Onboarding', 'Offboarding'];
export const SUPPORTED_ACTIVITY_ICONS = ['CheckSquare', 'PhoneCall', 'Calendar', 'FileText', 'ClipboardCheck', 'Clock'];

/**
 * Validates if the user role has administrative mutation privileges.
 * HR Admin and HR are permitted; Manager and Employee are rejected.
 * @param {string} role
 * @returns {boolean}
 */
export function canUserMutate(role) {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  return normalized === 'hr admin' || normalized === 'hr_admin' || normalized === 'hr';
}

/**
 * Generates a collision-checked unique PoC ID against currently existing canonical records.
 * @param {string} prefix - Entity prefix (e.g. 'dept', 'pos', 'loc', 'act-type')
 * @param {Array<Object>} existingRecords - Current canonical collection
 * @returns {string}
 */
export function generateUniqueId(prefix, existingRecords = []) {
  const existingIds = new Set(existingRecords.map((r) => r.id));
  let candidate;
  do {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    candidate = `${prefix}-${timestamp}-${randomSuffix}`;
  } while (existingIds.has(candidate));

  return candidate;
}

/**
 * Detects if assigning targetParentId as the parent of deptId creates a hierarchy cycle (e.g. A -> B -> C -> A).
 * Uses Depth-First Search traversing up the parent chain.
 * @param {string|null} deptId - The department being modified (null for new creation)
 * @param {string|null} targetParentId - The proposed parent department ID
 * @param {Array<Object>} existingDepts - All current department records
 * @returns {boolean} True if a cycle would be formed, false otherwise.
 */
export function detectDepartmentCycle(deptId, targetParentId, existingDepts = []) {
  if (!deptId || !targetParentId) return false;
  if (deptId === targetParentId) return true; // Direct self-parenting

  const deptMap = new Map(existingDepts.map((d) => [d.id, d]));
  let currentId = targetParentId;
  const visited = new Set();

  while (currentId) {
    if (currentId === deptId) return true; // Reached target department -> Cycle detected!
    if (visited.has(currentId)) break; // Prevent infinite loop in pre-existing bad data
    visited.add(currentId);

    const parentDept = deptMap.get(currentId);
    currentId = parentDept ? parentDept.parentDepartmentId : null;
  }

  return false;
}

/**
 * Validates Department form data.
 */
export function validateDepartment(deptData, existingDepts = [], currentId = null) {
  const errors = {};

  const name = (deptData.name || '').trim();
  const code = (deptData.code || '').trim().toUpperCase();
  const parentDepartmentId = deptData.parentDepartmentId || null;

  if (!name) {
    errors.name = 'Department name is required.';
  } else {
    const dupName = existingDepts.find(
      (d) => d.id !== currentId && d.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupName) {
      errors.name = `A department named "${name}" already exists.`;
    }
  }

  if (!code) {
    errors.code = 'Department code is required.';
  } else {
    const dupCode = existingDepts.find(
      (d) => d.id !== currentId && d.code.trim().toUpperCase() === code
    );
    if (dupCode) {
      errors.code = `Department code "${code}" is already in use by ${dupCode.name}.`;
    }
  }

  if (currentId && parentDepartmentId === currentId) {
    errors.parentDepartmentId = 'A department cannot be its own parent.';
  } else if (currentId && parentDepartmentId && detectDepartmentCycle(currentId, parentDepartmentId, existingDepts)) {
    errors.parentDepartmentId = 'Selecting this parent creates a circular department hierarchy cycle.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      code,
      parentDepartmentId,
      managerEmployeeId: deptData.managerEmployeeId || null,
      color: deptData.color || '#3b82f6',
      active: deptData.active !== undefined ? deptData.active : true,
    },
  };
}

/**
 * Validates Job Position form data.
 */
export function validatePosition(posData, existingPositions = [], currentId = null) {
  const errors = {};

  const name = (posData.name || '').trim();
  const departmentId = posData.departmentId || null;

  if (!name) {
    errors.name = 'Job position title is required.';
  }

  if (!departmentId) {
    errors.departmentId = 'Department assignment is required.';
  }

  if (name && departmentId) {
    const dupTitle = existingPositions.find(
      (p) =>
        p.id !== currentId &&
        p.departmentId === departmentId &&
        p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupTitle) {
      errors.name = `A position titled "${name}" already exists in this department.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      departmentId,
      defaultManagerId: posData.defaultManagerId || null,
      defaultScheduleId: posData.defaultScheduleId || 'sched-1',
      defaultLocationId: posData.defaultLocationId || 'loc-1',
      active: posData.active !== undefined ? posData.active : true,
    },
  };
}

/**
 * Validates Work Location form data.
 */
export function validateLocation(locData, existingLocations = [], currentId = null) {
  const errors = {};

  const name = (locData.name || '').trim();
  const type = locData.type || 'Office';
  const address = (locData.address || '').trim();

  if (!name) {
    errors.name = 'Location name is required.';
  } else {
    const dupName = existingLocations.find(
      (l) => l.id !== currentId && l.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupName) {
      errors.name = `A location named "${name}" already exists.`;
    }
  }

  if (!SUPPORTED_LOCATION_TYPES.includes(type)) {
    errors.type = `Location type must be one of: ${SUPPORTED_LOCATION_TYPES.join(', ')}.`;
  }

  if (type !== 'Remote' && !address) {
    errors.address = 'Address is required for non-Remote physical locations.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      type,
      address: address || (type === 'Remote' ? 'Remote / Distributed' : 'Address Pending'),
      active: locData.active !== undefined ? locData.active : true,
    },
  };
}

/**
 * Validates Activity Type form data.
 */
export function validateActivityType(typeData, existingTypes = [], currentId = null) {
  const errors = {};

  const name = (typeData.name || '').trim();
  const category = typeData.category || 'General';
  const icon = typeData.icon || 'CheckSquare';

  if (!name) {
    errors.name = 'Activity type name is required.';
  } else {
    const dupName = existingTypes.find(
      (t) => t.id !== currentId && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupName) {
      errors.name = `An activity type named "${name}" already exists.`;
    }
  }

  if (!SUPPORTED_ACTIVITY_CATEGORIES.includes(category)) {
    errors.category = `Category must be one of: ${SUPPORTED_ACTIVITY_CATEGORIES.join(', ')}.`;
  }

  if (!SUPPORTED_ACTIVITY_ICONS.includes(icon)) {
    errors.icon = `Icon must be one of supported Lucide icons.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      category,
      icon,
      active: typeData.active !== undefined ? typeData.active : true,
    },
  };
}

/**
 * Calculates complete database references for a Department entity.
 * Checks all employmentRecords (historical & current), positions, child departments, onboarding/offboarding templates.
 */
export function calculateDepartmentReferences(deptId, db = {}) {
  if (!deptId) return { totalReferences: 0, details: [] };

  const records = db.employmentRecords || [];
  const positions = db.positions || [];
  const depts = db.departments || [];
  const onboardingPlanTasks = db.onboardingPlanTasks || [];
  const offboardingPlanTasks = db.offboardingPlanTasks || [];

  const empRecordRefs = records.filter((r) => r.departmentId === deptId).length;
  const positionRefs = positions.filter((p) => p.departmentId === deptId).length;
  const childDeptRefs = depts.filter((d) => d.parentDepartmentId === deptId).length;
  const onboardingTaskRefs = onboardingPlanTasks.filter((t) => t.departmentId === deptId).length;
  const offboardingTaskRefs = offboardingPlanTasks.filter((t) => t.departmentId === deptId).length;

  const totalReferences = empRecordRefs + positionRefs + childDeptRefs + onboardingTaskRefs + offboardingTaskRefs;
  const details = [];

  if (empRecordRefs > 0) details.push(`${empRecordRefs} employment history record(s)`);
  if (positionRefs > 0) details.push(`${positionRefs} job position(s)`);
  if (childDeptRefs > 0) details.push(`${childDeptRefs} child department(s)`);
  if (onboardingTaskRefs > 0) details.push(`${onboardingTaskRefs} onboarding template task(s)`);
  if (offboardingTaskRefs > 0) details.push(`${offboardingTaskRefs} offboarding template task(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}

/**
 * Calculates complete database references for a Job Position entity.
 * Checks all employmentRecords (historical, current, future) and onboarding/offboarding templates.
 */
export function calculatePositionReferences(posId, db = {}) {
  if (!posId) return { totalReferences: 0, details: [] };

  const records = db.employmentRecords || [];
  const onboardingPlanTasks = db.onboardingPlanTasks || [];
  const offboardingPlanTasks = db.offboardingPlanTasks || [];

  const empRecordRefs = records.filter((r) => r.positionId === posId).length;
  const onboardingTaskRefs = onboardingPlanTasks.filter((t) => t.positionId === posId).length;
  const offboardingTaskRefs = offboardingPlanTasks.filter((t) => t.positionId === posId).length;

  const totalReferences = empRecordRefs + onboardingTaskRefs + offboardingTaskRefs;
  const details = [];

  if (empRecordRefs > 0) details.push(`${empRecordRefs} employment history record(s)`);
  if (onboardingTaskRefs > 0) details.push(`${onboardingTaskRefs} onboarding template task(s)`);
  if (offboardingTaskRefs > 0) details.push(`${offboardingTaskRefs} offboarding template task(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}

/**
 * Calculates complete database references for a Work Location entity.
 * Checks all employmentRecords, position default locations, and presence log records.
 */
export function calculateLocationReferences(locId, db = {}) {
  if (!locId) return { totalReferences: 0, details: [] };

  const records = db.employmentRecords || [];
  const positions = db.positions || [];
  const presenceLogs = db.presence || [];

  const empRecordRefs = records.filter((r) => r.locationId === locId).length;
  const positionDefaultRefs = positions.filter((p) => p.defaultLocationId === locId).length;
  const presenceLogRefs = presenceLogs.filter((p) => p.locationId === locId).length;

  const totalReferences = empRecordRefs + positionDefaultRefs + presenceLogRefs;
  const details = [];

  if (empRecordRefs > 0) details.push(`${empRecordRefs} employment history record(s)`);
  if (positionDefaultRefs > 0) details.push(`${positionDefaultRefs} position default location assignment(s)`);
  if (presenceLogRefs > 0) details.push(`${presenceLogRefs} presence check-in log(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}

/**
 * Calculates complete database references for an Activity Type entity.
 * Checks all activities log records.
 */
export function calculateActivityTypeReferences(activityTypeId, db = {}) {
  if (!activityTypeId) return { totalReferences: 0, details: [] };

  const activities = db.activities || [];
  const actRefs = activities.filter((a) => a.activityTypeId === activityTypeId || a.typeId === activityTypeId).length;

  const totalReferences = actRefs;
  const details = [];

  if (actRefs > 0) details.push(`${actRefs} activity record(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}

export const SUPPORTED_TAG_CATEGORIES = ['Committee', 'Role/Skill', 'Operational', 'Status Tag', 'General'];

/**
 * Validates Employee Type form data.
 */
export function validateEmployeeType(typeData, existingTypes = [], currentId = null) {
  const errors = {};

  const name = (typeData.name || '').trim();
  const code = (typeData.code || '').trim().toUpperCase();
  const description = (typeData.description || '').trim();

  if (!name) {
    errors.name = 'Employment type name is required.';
  } else {
    const dupName = existingTypes.find(
      (t) => t.id !== currentId && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupName) {
      errors.name = `An employment type named "${name}" already exists.`;
    }
  }

  if (!code) {
    errors.code = 'Employment type code is required.';
  } else {
    const dupCode = existingTypes.find(
      (t) => t.id !== currentId && t.code.trim().toUpperCase() === code
    );
    if (dupCode) {
      errors.code = `Employment type code "${code}" is already in use by ${dupCode.name}.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      code,
      description,
      active: typeData.active !== undefined ? typeData.active : true,
    },
  };
}

/**
 * Validates Employee Tag form data.
 */
export function validateEmployeeTag(tagData, existingTags = [], currentId = null) {
  const errors = {};

  const name = (tagData.name || '').trim();
  const category = tagData.category || 'General';
  const color = tagData.color || '#129FA9';

  if (!name) {
    errors.name = 'Tag name is required.';
  } else {
    const dupName = existingTags.find(
      (t) => t.id !== currentId && t.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupName) {
      errors.name = `An employee tag named "${name}" already exists.`;
    }
  }

  if (!SUPPORTED_TAG_CATEGORIES.includes(category)) {
    errors.category = `Tag category must be one of: ${SUPPORTED_TAG_CATEGORIES.join(', ')}.`;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      category,
      color,
      active: tagData.active !== undefined ? tagData.active : true,
    },
  };
}

/**
 * Calculates complete database references for an Employee Type entity.
 * Checks ALL employee records across all lifecycle statuses (Active, Onboarding, Upcoming, Departing, Former).
 */
export function calculateEmployeeTypeReferences(typeId, db = {}) {
  if (!typeId) return { totalReferences: 0, details: [] };

  const employees = db.employees || [];
  const empRefs = employees.filter((e) => e.employeeTypeId === typeId).length;

  const totalReferences = empRefs;
  const details = [];

  if (empRefs > 0) details.push(`${empRefs} employee record(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}

/**
 * Calculates complete database references for an Employee Tag entity.
 * Checks ALL employee records across all lifecycle statuses (Active, Onboarding, Upcoming, Departing, Former).
 */
export function calculateEmployeeTagReferences(tagId, db = {}) {
  if (!tagId) return { totalReferences: 0, details: [] };

  const employees = db.employees || [];
  const tagRefs = employees.filter((e) => Array.isArray(e.tags) && e.tags.includes(tagId)).length;

  const totalReferences = tagRefs;
  const details = [];

  if (tagRefs > 0) details.push(`${tagRefs} employee record assignment(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}

export const SUPPORTED_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Validates Work Schedule form data.
 */
export function validateSchedule(scheduleData, existingSchedules = [], currentId = null) {
  const errors = {};

  const name = (scheduleData.name || '').trim();
  const workingDays = Array.isArray(scheduleData.workingDays)
    ? scheduleData.workingDays.filter((d) => SUPPORTED_DAYS.includes(d))
    : [];
  const startTime = (scheduleData.startTime || '').trim();
  const endTime = (scheduleData.endTime || '').trim();
  const weeklyHours = Number(scheduleData.weeklyHours);

  if (!name) {
    errors.name = 'Schedule name is required.';
  } else {
    const dupName = existingSchedules.find(
      (s) => s.id !== currentId && s.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (dupName) {
      errors.name = `A work schedule named "${name}" already exists.`;
    }
  }

  if (workingDays.length === 0) {
    errors.workingDays = 'At least one working day must be selected.';
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!startTime || !timeRegex.test(startTime)) {
    errors.startTime = 'Start time is required and must be in HH:mm format.';
  }

  if (!endTime || !timeRegex.test(endTime)) {
    errors.endTime = 'End time is required and must be in HH:mm format.';
  }

  if (isNaN(weeklyHours) || weeklyHours <= 0) {
    errors.weeklyHours = 'Weekly hours must be a positive number greater than 0.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanData: {
      name,
      workingDays,
      startTime,
      endTime,
      weeklyHours,
      active: scheduleData.active !== undefined ? scheduleData.active : true,
    },
  };
}

/**
 * Calculates complete database references for a Work Schedule entity.
 * Checks ALL employmentRecords across all employee lifecycle statuses (Active, Onboarding, Upcoming, Departing, Former).
 */
export function calculateScheduleReferences(scheduleId, db = {}) {
  if (!scheduleId) return { totalReferences: 0, details: [] };

  const records = db.employmentRecords || [];
  const recRefs = records.filter((r) => r.scheduleId === scheduleId).length;

  const totalReferences = recRefs;
  const details = [];

  if (recRefs > 0) details.push(`${recRefs} employment history record(s)`);

  return {
    totalReferences,
    details,
    summary: details.length > 0 ? details.join(', ') : 'No references found.',
  };
}


