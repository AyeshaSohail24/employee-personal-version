import React from 'react';
import { BarChart3 } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function WorkforceOverviewPage() {
  return (
    <PlaceholderCard
      title="Workforce Overview"
      subtitle="Key metrics on total headcount, hiring velocity, net growth, and retention rate"
      category="Reporting & Analytics"
      icon={BarChart3}
    />
  );
}
