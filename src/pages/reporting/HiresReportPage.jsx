import React from 'react';
import { UserPlus } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function HiresReportPage() {
  return (
    <PlaceholderCard
      title="Hires Analytics Report"
      subtitle="Historical hiring trends, time-to-fill analytics, and onboarding intake numbers"
      category="Reporting & Analytics"
      icon={UserPlus}
    />
  );
}
