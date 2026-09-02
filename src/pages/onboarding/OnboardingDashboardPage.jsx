import React from 'react';
import { UserCheck } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OnboardingDashboardPage() {
  return (
    <PlaceholderCard
      title="Onboarding Dashboard"
      subtitle="Overview of new hire onboarding progress, pending tasks, and plan launch metrics"
      category="Lifecycle Engine"
      icon={UserCheck}
    />
  );
}
