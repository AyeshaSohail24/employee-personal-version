import React from 'react';
import { Users } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function EmployeesConfigPage() {
  return (
    <PlaceholderCard
      title="Employees Configuration"
      subtitle="Configure employee types, tags, skill categories, and custom profile attributes"
      category="System Configuration"
      icon={Users}
    />
  );
}
