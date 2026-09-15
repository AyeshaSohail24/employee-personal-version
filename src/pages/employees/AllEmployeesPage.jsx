import React from 'react';
import DirectoryPageContainer from '../../components/employees/DirectoryPageContainer';

export default function AllEmployeesPage() {
  return (
    <DirectoryPageContainer
      title="All Personnel"
      description="Complete Rizurf personnel directory across all lifecycle statuses"
      baseLifecycleScope="All"
    />
  );
}
