import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-wrapper">
      {/* 5 Lifecycle Count Cards Skeleton — UPDATED (Fix KPI Card Proportions task): .stat-card no
          longer has a fixed height at all — the REAL card's height now comes from its padding plus
          its 3 lines of actual content (icon/title row, count, description). This empty skeleton
          div has no such content to size itself with, so it still needs an explicit height here to
          approximate that real rendered height and avoid collapsing to just its padding. */}
      <div className="stat-cards-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="stat-card skeleton-box" style={{ height: '113px' }} />
        ))}
      </div>

      {/* Ending Within 7 Days + Soonest Due Tasks Skeleton — UPDATED: side by side, matching the
          real 2-widget row layout (each widget's default collapsed view now shows only its latest/
          soonest 2 rows, per direct user request, so the skeleton height reflects that smaller
          2-row default rather than a taller scrollable list). */}
      <div className="dashboard-widgets-row" style={{ marginTop: '2.25rem' }}>
        <div className="dashboard-widget skeleton-box" style={{ height: '150px' }} />
        <div className="dashboard-widget skeleton-box" style={{ height: '150px' }} />
      </div>
    </div>
  );
}
