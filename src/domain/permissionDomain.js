/**
 * Pure domain logic and canonical role capability matrix for Stage 17.
 * Option A — Fixed Canonical Role-Capability Matrix.
 */

export const ROLES = {
  HR_ADMIN: 'HR Admin',
  HR: 'HR',
  MANAGER: 'Manager',
};

export const CANONICAL_ROLES = [ROLES.HR_ADMIN, ROLES.HR, ROLES.MANAGER];

export const CAPABILITY_GROUPS = [
  {
    category: 'Core HR & Employees',
    capabilities: [
      { key: 'view_employees', label: 'View Employee Directory & Profiles', description: 'Access to search directory, active, new joiners, former lists and employee detail views' },
      { key: 'manage_employees', label: 'Create & Edit Employee Records', description: 'Ability to add new employees, update profile fields, and edit employment details' },
    ],
  },
  {
    category: 'Workforce Operations',
    capabilities: [
      { key: 'view_onboarding', label: 'View Onboarding Dashboard & Plans', description: 'Access to onboarding metrics, employee tracker, and template plans' },
      { key: 'manage_onboarding', label: 'Launch & Manage Onboarding Plans', description: 'Assign onboarding plans to candidates, edit tasks, and mark steps complete' },
      { key: 'view_offboarding', label: 'View Offboarding Dashboard & Plans', description: 'Access to departing employee tracker and offboarding plans' },
      { key: 'manage_offboarding', label: 'Launch & Manage Offboarding Plans', description: 'Initiate departure workflows, assign offboarding tasks, and track compliance' },
      { key: 'view_activities', label: 'View Activities & Calendar', description: 'Access to My Activities, All Activities, and Overdue Activity feeds' },
      { key: 'manage_activities', label: 'Create & Complete Activities', description: 'Create task assignments, edit activity notes, and mark activities complete' },
      { key: 'view_presence', label: 'View Work Status / Presence Grid', description: 'View real-time workplace status, remote requests, and leave schedules' },
      { key: 'manage_presence', label: 'Set HR Manual Presence Overrides', description: 'Apply explicit HR manual overrides for employee presence states' },
      { key: 'view_reporting', label: 'View Workforce Reporting & Analytics', description: 'Access to Headcount, Hires, Departures, Retention, and Overview reports' },
    ],
  },
  {
    category: 'Configuration Master Data',
    capabilities: [
      { key: 'view_config_org', label: 'View Organization Configuration', description: 'View master lists for Departments, Positions, and Work Locations' },
      { key: 'manage_config_org', label: 'Manage Organization Master Data', description: 'Create, edit, toggle, and delete Departments, Positions, and Locations' },
      { key: 'view_config_emp', label: 'View Employee Configuration', description: 'View Employment Types and Employee Tags configuration' },
      { key: 'manage_config_emp', label: 'Manage Employee Types & Tags', description: 'Create, edit, toggle, and delete Employment Types and Employee Tags' },
      { key: 'view_config_act', label: 'View Activity Configuration', description: 'View Activity Type master definitions' },
      { key: 'manage_config_act', label: 'Manage Activity Master Data', description: 'Create, edit, toggle, and delete Activity Types' },
      { key: 'view_config_pres', label: 'View Presence Configuration', description: 'View canonical Work Schedule presets' },
      { key: 'manage_config_pres', label: 'Manage Work Schedules', description: 'Create, edit, toggle, and delete Work Schedules' },
      { key: 'view_config_docs', label: 'View Document Configuration', description: 'View master Document Type classifications and expiry rules' },
      { key: 'manage_config_docs', label: 'Manage Document Types', description: 'Create, edit, toggle, and delete Document Types' },
    ],
  },
  {
    category: 'Security & Access Control',
    capabilities: [
      { key: 'view_permissions', label: 'View Permissions & Role Matrix', description: 'View canonical 3-role capability matrix and authorization model' },
      { key: 'manage_permissions', label: 'Administer Security Policy & Roles', description: 'Administrative security invariant reserved exclusively for HR Admin' },
    ],
  },
];

/**
 * Fixed Canonical Role-Capability Mapping.
 * Defines true runtime authorization capabilities across the 3 application roles.
 */
export const ROLE_CAPABILITIES = {
  // Core HR & Employees
  view_employees: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_employees: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },

  // Workforce Operations
  view_onboarding: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_onboarding: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_offboarding: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_offboarding: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_activities: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_activities: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  view_presence: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_presence: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_reporting: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },

  // Configuration Master Data
  view_config_org: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_config_org: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_config_emp: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_config_emp: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_config_act: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_config_act: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_config_pres: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_config_pres: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },
  view_config_docs: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_config_docs: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: false },

  // Security & Access Control
  view_permissions: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: true, [ROLES.MANAGER]: true },
  manage_permissions: { [ROLES.HR_ADMIN]: true, [ROLES.HR]: false, [ROLES.MANAGER]: false },
};

/**
 * Checks if a given role possesses a specific capability.
 * @param {string} role - Application role string
 * @param {string} capabilityKey - Capability key identifier
 * @returns {boolean} True if granted, false otherwise.
 */
export function hasCapability(role, capabilityKey) {
  if (!role || !capabilityKey) return false;
  const normalizedRole = role.trim();

  // Standardize role string matching
  let canonicalRole = normalizedRole;
  if (normalizedRole.toLowerCase() === 'hr admin' || normalizedRole.toLowerCase() === 'hr_admin') {
    canonicalRole = ROLES.HR_ADMIN;
  } else if (normalizedRole.toLowerCase() === 'hr') {
    canonicalRole = ROLES.HR;
  } else if (normalizedRole.toLowerCase() === 'manager') {
    canonicalRole = ROLES.MANAGER;
  } else {
    // Obsolete roles (Employee, Payroll, etc.) are granted no mutation/admin capabilities
    return false;
  }

  const capMap = ROLE_CAPABILITIES[capabilityKey];
  if (!capMap) return false;

  return Boolean(capMap[canonicalRole]);
}
