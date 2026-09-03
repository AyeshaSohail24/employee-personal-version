import React from 'react';
import DirectoryPageContainer from '../../components/employees/DirectoryPageContainer';

export default function FormerEmployeesPage() {
  return (
    <DirectoryPageContainer
      title="Former Employees"
      description="Archived alumni records and closed employment histories"
      baseLifecycleScope="Former"
    />
  );
}
