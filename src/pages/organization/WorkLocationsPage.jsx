import React from 'react';
import { MapPin } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function WorkLocationsPage() {
  return (
    <PlaceholderCard
      title="Work Locations"
      subtitle="Physical offices, client sites, branch locations, and remote work policies"
      category="Organization Setup"
      icon={MapPin}
    />
  );
}
