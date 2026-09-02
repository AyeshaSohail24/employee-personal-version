import React from 'react';
import { UserPlus } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function NewJoinersPage() {
  return (
    <PlaceholderCard
      title="New Joiners"
      subtitle="Recently onboarded team members and upcoming start dates"
      category="Employee Directory"
      icon={UserPlus}
    />
  );
}
