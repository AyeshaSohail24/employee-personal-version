import React from 'react';
import { UserX } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OffboardingDashboardPage() {
  return (
    <PlaceholderCard
      title="Offboarding Dashboard"
      subtitle="Overview of employee departures, clearance progress, and asset returns"
      category="Lifecycle Engine"
      icon={UserX}
    />
  );
}
