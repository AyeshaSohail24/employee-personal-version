import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-wrapper">
      {/* KPI Cards Skeleton */}
      <div className="stat-cards-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card skeleton-box" style={{ height: '120px' }} />
        ))}
      </div>

      {/* Distribution Skeleton */}
      <div className="dashboard-widget skeleton-box" style={{ height: '160px', marginTop: '1.5rem' }} />

      {/* Main Widgets Grid Skeleton */}
      <div className="dashboard-content-grid" style={{ marginTop: '1.5rem' }}>
        <div className="dashboard-widget skeleton-box" style={{ height: '320px' }} />
        <div className="dashboard-widget skeleton-box" style={{ height: '320px' }} />
      </div>
    </div>
  );
}
