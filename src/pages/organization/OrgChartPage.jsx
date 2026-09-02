import React from 'react';
import { Network } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function OrgChartPage() {
  return (
    <PlaceholderCard
      title="Organization Chart"
      subtitle="Visual hierarchy showing parent/child department relationships and reporting lines"
      category="Organization Structure"
      icon={Network}
    />
  );
}
