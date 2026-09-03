import React from 'react';
import DirectoryPageContainer from '../../components/employees/DirectoryPageContainer';

export default function DepartingEmployeesPage() {
  return (
    <DirectoryPageContainer
      title="Departing Employees"
      description="Team members currently undergoing offboarding transition"
      baseLifecycleScope="Departing"
    />
  );
}
