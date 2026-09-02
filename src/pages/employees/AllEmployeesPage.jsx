import React from 'react';
import { Users } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function AllEmployeesPage() {
  return (
    <PlaceholderCard
      title="All Employees"
      subtitle="Complete company directory across all departments and employment statuses"
      category="Employee Management"
      icon={Users}
    />
  );
}
