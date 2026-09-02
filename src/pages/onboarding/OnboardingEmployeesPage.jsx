import React from 'react';
import { Users } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OnboardingEmployeesPage() {
  return (
    <PlaceholderCard
      title="Onboarding Employees"
      subtitle="Active employee onboarding instances, completion progress, and task checklists"
      category="Lifecycle Engine"
      icon={Users}
    />
  );
}
