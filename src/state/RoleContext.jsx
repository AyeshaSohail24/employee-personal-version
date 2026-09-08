import React, { createContext, useContext, useState } from 'react';
import { ROLES as DOMAIN_ROLES, CANONICAL_ROLES, hasCapability as checkCapability } from '../domain/permissionDomain';

const RoleContext = createContext();

export const ROLES = DOMAIN_ROLES;

export function RoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(ROLES.HR_ADMIN);

  const hasCapability = (capabilityKey) => checkCapability(currentRole, capabilityKey);

  const value = {
    currentRole,
    setCurrentRole,
    roles: CANONICAL_ROLES,
    isManager: currentRole === ROLES.MANAGER,
    isHR: currentRole === ROLES.HR,
    isHRAdmin: currentRole === ROLES.HR_ADMIN,
    hasCapability,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
