import React from 'react';
import { UserCheck } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function LifecycleConfigPage() {
  return (
    <PlaceholderCard
      title="Lifecycle Configuration"
      subtitle="Onboarding/offboarding plan templates, departure reasons, and automation gates"
      category="System Configuration"
      icon={UserCheck}
    />
  );
}
