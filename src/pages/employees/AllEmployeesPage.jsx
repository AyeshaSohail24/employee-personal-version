import React from 'react';
import DirectoryPageContainer from '../../components/employees/DirectoryPageContainer';

export default function AllEmployeesPage() {
  return (
    <DirectoryPageContainer
      title="All Employees"
      description="Complete Rizurf workforce directory across all lifecycle statuses"
      baseLifecycleScope="All"
    />
  );
}
