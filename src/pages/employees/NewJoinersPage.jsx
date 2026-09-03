import React from 'react';
import DirectoryPageContainer from '../../components/employees/DirectoryPageContainer';

export default function NewJoinersPage() {
  return (
    <DirectoryPageContainer
      title="New Joiners & Upcoming Hires"
      description="Team members currently onboarding or scheduled to join"
      baseLifecycleScope="NewJoiners"
    />
  );
}
