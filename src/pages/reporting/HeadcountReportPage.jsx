import React from 'react';
import { Users } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function HeadcountReportPage() {
  return (
    <PlaceholderCard
      title="Headcount Report"
      subtitle="Detailed breakdowns by department, job position, work location, and employee type"
      category="Reporting & Analytics"
      icon={Users}
    />
  );
}
