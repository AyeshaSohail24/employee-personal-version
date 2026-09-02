import React from 'react';
import { UserCheck } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function ActiveEmployeesPage() {
  return (
    <PlaceholderCard
      title="Active Employees"
      subtitle="Currently employed team members across all locations"
      category="Employee Directory"
      icon={UserCheck}
    />
  );
}
