import React, { createContext, useContext, useState } from 'react';

const RoleContext = createContext();

export const ROLES = {
  EMPLOYEE: 'Employee',
  MANAGER: 'Manager',
  HR: 'HR',
  HR_ADMIN: 'HR Admin',
  PAYROLL: 'Payroll',
};

export function RoleProvider({ children }) {
  const [currentRole, setCurrentRole] = useState(ROLES.HR_ADMIN);

  const value = {
    currentRole,
    setCurrentRole,
    roles: Object.values(ROLES),
    isEmployee: currentRole === ROLES.EMPLOYEE,
    isManager: currentRole === ROLES.MANAGER,
    isHR: currentRole === ROLES.HR,
    isHRAdmin: currentRole === ROLES.HR_ADMIN,
    isPayroll: currentRole === ROLES.PAYROLL,
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
