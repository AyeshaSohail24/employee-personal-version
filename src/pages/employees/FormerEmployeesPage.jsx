import React from 'react';
import { UserX } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function FormerEmployeesPage() {
  return (
    <PlaceholderCard
      title="Former Employees"
      subtitle="Archived employee history and historical departure records"
      category="Employee Archives"
      icon={UserX}
    />
  );
}
