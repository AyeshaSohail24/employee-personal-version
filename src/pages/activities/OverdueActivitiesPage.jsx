import React from 'react';
import { AlertCircle } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OverdueActivitiesPage() {
  return (
    <PlaceholderCard
      title="Overdue Activities"
      subtitle="Activities past their target due date requiring immediate HR follow-up"
      category="Activity System"
      icon={AlertCircle}
    />
  );
}
