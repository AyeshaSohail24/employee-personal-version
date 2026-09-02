import React from 'react';
import { FileText } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OffboardingPlansPage() {
  return (
    <PlaceholderCard
      title="Offboarding Plans"
      subtitle="Reusable clearance templates for resignation, termination, retirement, and contract expiry"
      category="Lifecycle Engine"
      icon={FileText}
    />
  );
}
