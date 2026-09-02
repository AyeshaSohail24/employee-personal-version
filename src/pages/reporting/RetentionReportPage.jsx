import React from 'react';
import { TrendingUp } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function RetentionReportPage() {
  return (
    <PlaceholderCard
      title="Retention Rate Report"
      subtitle="Employee retention percentages and cohort survival rates across departments"
      category="Reporting & Analytics"
      icon={TrendingUp}
    />
  );
}
