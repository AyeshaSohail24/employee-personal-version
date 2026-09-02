import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function DashboardPage() {
  return (
    <PlaceholderCard
      title="HR Dashboard"
      subtitle="Overview of active workforce, presence, onboarding, and pending activities"
      category="Executive Summary"
      icon={LayoutDashboard}
    />
  );
}
