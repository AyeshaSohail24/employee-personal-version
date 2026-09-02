import React from 'react';
import { Building2 } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function DepartmentsPage() {
  return (
    <PlaceholderCard
      title="Departments"
      subtitle="Organizational units, managers, and employee counts"
      category="Organization Structure"
      icon={Building2}
    />
  );
}
