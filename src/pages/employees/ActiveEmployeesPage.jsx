import React from 'react';
import DirectoryPageContainer from '../../components/employees/DirectoryPageContainer';

export default function ActiveEmployeesPage() {
  return (
    <DirectoryPageContainer
      title="Active Employees"
      description="Currently employed active team members"
      baseLifecycleScope="Active"
    />
  );
}
