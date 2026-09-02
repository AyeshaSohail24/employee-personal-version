import React from 'react';
import { Clock } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function PresenceConfigPage() {
  return (
    <PlaceholderCard
      title="Presence Configuration"
      subtitle="Work mode policies, presence states, and override audit rules"
      category="System Configuration"
      icon={Clock}
    />
  );
}
