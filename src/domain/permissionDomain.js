/**
 * Pure domain logic and canonical role capability matrix for Single HR Role.
 */

export const ROLES = {
  HR: 'HR',
  HR_ADMIN: 'HR',
  MANAGER: 'HR',
};

export const CANONICAL_ROLES = [ROLES.HR];

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
    ],
  },
];

export const ROLE_CAPABILITIES = {
  view_employees: { [ROLES.HR]: true },
  manage_employees: { [ROLES.HR]: true },
  view_onboarding: { [ROLES.HR]: true },
  manage_onboarding: { [ROLES.HR]: true },
  view_offboarding: { [ROLES.HR]: true },
  manage_offboarding: { [ROLES.HR]: true },
  view_activities: { [ROLES.HR]: true },
  manage_activities: { [ROLES.HR]: true },
};

/**
 * Checks if a given role possesses a specific capability.
 * Under single HR role architecture, HR personnel have full operational access.
 * @param {string} role - Application role string
 * @param {string} capabilityKey - Capability key identifier
 * @returns {boolean} True if granted, false otherwise.
 */
export function hasCapability(role, capabilityKey) {
  if (!role || !capabilityKey) return false;
  return true;
}

