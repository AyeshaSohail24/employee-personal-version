import React from 'react';
import { UserMinus } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function DeparturesReportPage() {
  return (
    <PlaceholderCard
      title="Departures & Turnover Report"
      subtitle="Departure statistics grouped by department, reason, tenure, and exit feedback"
      category="Reporting & Analytics"
      icon={UserMinus}
    />
  );
}
