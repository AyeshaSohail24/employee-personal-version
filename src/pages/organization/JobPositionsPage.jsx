import React from 'react';
import { Briefcase } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function JobPositionsPage() {
  return (
    <PlaceholderCard
      title="Job Positions"
      subtitle="Configured positions, default departments, managers, and work locations"
      category="Organization Setup"
      icon={Briefcase}
    />
  );
}
