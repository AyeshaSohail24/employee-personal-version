import React from 'react';
import { FileText } from 'lucide-react';
import PlaceholderCard from '../../components/common/PlaceholderCard';

export default function DocumentsConfigPage() {
  return (
    <PlaceholderCard
      title="Documents Configuration"
      subtitle="Document categories, required compliance tags, and retention schedules"
      category="System Configuration"
      icon={FileText}
    />
  );
}
