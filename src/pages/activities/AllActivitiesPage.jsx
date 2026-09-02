import React from 'react';
import { ListTodo } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function AllActivitiesPage() {
  return (
    <PlaceholderCard
      title="All Activities"
      subtitle="Cross-company list of pending, in-progress, and completed HR activities"
      category="Activity System"
      icon={ListTodo}
    />
  );
}
