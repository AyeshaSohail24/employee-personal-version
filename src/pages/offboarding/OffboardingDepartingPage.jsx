import React from 'react';
import { Users } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OffboardingDepartingPage() {
  return (
    <PlaceholderCard
      title="Offboarding Departing Employees"
      subtitle="Departure details, last working day tracking, clearance checklists, and transition logs"
      category="Lifecycle Engine"
      icon={Users}
    />
  );
}
