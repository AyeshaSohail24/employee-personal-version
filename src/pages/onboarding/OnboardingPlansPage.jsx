import React from 'react';
import { FileText } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OnboardingPlansPage() {
  return (
    <PlaceholderCard
      title="Onboarding Plans"
      subtitle="Reusable general and department-specific onboarding plan templates and task rules"
      category="Lifecycle Engine"
      icon={FileText}
    />
  );
}
