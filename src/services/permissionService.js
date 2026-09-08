import {
  ROLES,
  CANONICAL_ROLES,
  CAPABILITY_GROUPS,
  ROLE_CAPABILITIES,
  hasCapability,
} from '../domain/permissionDomain.js';

export const permissionService = {
  /**
   * Returns canonical role capability matrix and functional groups for UI rendering.
   * @returns {Object} Matrix payload
   */
  async getPermissionMatrix() {
    return {
      roles: CANONICAL_ROLES,
      groups: CAPABILITY_GROUPS,
      matrix: ROLE_CAPABILITIES,
    };
  },

  /**
   * Evaluates if a given role has a specific capability.
   * @param {string} role
   * @param {string} capabilityKey
   * @returns {boolean}
   */
  hasCapability(role, capabilityKey) {
    return hasCapability(role, capabilityKey);
  },
};
