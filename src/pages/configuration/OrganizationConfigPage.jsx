import React from 'react';
import { Building2 } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OrganizationConfigPage() {
  return (
    <PlaceholderCard
      title="Organization Configuration"
      subtitle="Manage departments, job positions, work locations, and working schedules"
      category="System Configuration"
      icon={Building2}
    />
  );
}
