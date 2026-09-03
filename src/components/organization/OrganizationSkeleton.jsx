import React from 'react';

export default function OrganizationSkeleton() {
  return (
    <div className="org-skeleton-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="department-card skeleton-box" style={{ height: '180px' }} />
      ))}
    </div>
  );
}
