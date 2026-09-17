import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton-wrapper">
      {/* 5 Lifecycle Count Cards Skeleton — height is a fixed 106px (Fix Actual 3+2 Layout Bug
          task: matches the real card's measured height at its now-fluid width) since this empty
          div has no content of its own to size itself with. No WIDTH is set here (or needed):
          this div reuses the SAME .stat-cards-grid class the real cards use, and that grid's
          fluid column tracks (repeat(5, minmax(0, 1fr))) apply to every direct child, skeleton
          placeholders included, so the loading state automatically matches the real cards' width
          — and the same 3/2/1-column responsive fallback — too. */}
      <div className="stat-cards-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="stat-card skeleton-box" style={{ height: '106px' }} />
        ))}
      </div>

      {/* Ending Within 7 Days + Soonest Due Tasks Skeleton — side by side, matching the real
          2-widget row layout (each widget's default collapsed view shows only its latest/soonest 2
          rows). Height raised (150px -> 200px) (UPDATED — Small Controlled Enlargement task) to
          match the real 2-row collapsed widget height measured via Playwright (~198-213px) now
          that both the widget's own padding and its row padding grew slightly. */}
      <div className="dashboard-widgets-row" style={{ marginTop: '2.25rem' }}>
        <div className="dashboard-widget skeleton-box" style={{ height: '200px' }} />
        <div className="dashboard-widget skeleton-box" style={{ height: '200px' }} />
      </div>
    </div>
  );
}
