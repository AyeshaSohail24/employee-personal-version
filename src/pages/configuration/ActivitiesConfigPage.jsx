import React from 'react';
import { CheckSquare } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function ActivitiesConfigPage() {
  return (
    <PlaceholderCard
      title="Activities Configuration"
      subtitle="Activity types, task categories, SLA parameters, and assignment rules"
      category="System Configuration"
      icon={CheckSquare}
    />
  );
}
