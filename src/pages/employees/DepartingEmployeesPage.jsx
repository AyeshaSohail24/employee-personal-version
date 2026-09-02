import React from 'react';
import { UserMinus } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function DepartingEmployeesPage() {
  return (
    <PlaceholderCard
      title="Departing Employees"
      subtitle="Team members currently undergoing offboarding clearance"
      category="Employee Directory"
      icon={UserMinus}
    />
  );
}
