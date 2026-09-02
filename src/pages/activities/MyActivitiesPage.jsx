import React from 'react';
import { CheckSquare } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function MyActivitiesPage() {
  return (
    <PlaceholderCard
      title="My Activities"
      subtitle="HR and management action items assigned directly to you"
      category="Activity System"
      icon={CheckSquare}
    />
  );
}
