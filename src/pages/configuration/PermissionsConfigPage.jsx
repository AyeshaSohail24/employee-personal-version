import React from 'react';
import { Shield } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function PermissionsConfigPage() {
  return (
    <PlaceholderCard
      title="Permissions & Roles Configuration"
      subtitle="Role-based access matrix, field-level visibility controls, and administrative privileges"
      category="Security & Access"
      icon={Shield}
    />
  );
}
