import React from 'react';

const STATUS_COLORS = {
  Active: { bg: '#059669', tint: '#ECFDF5', text: '#059669' },
  Onboarding: { bg: '#129FA9', tint: '#E6F7F8', text: '#0E848D' },
  Upcoming: { bg: '#2563EB', tint: '#EFF6FF', text: '#2563EB' },
  Departing: { bg: '#D97706', tint: '#FFFBEB', text: '#D97706' },
  Former: { bg: '#64748B', tint: '#F1F5F9', text: '#475569' },
};

export default function LifecycleDistribution({ distribution = [] }) {
  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div>
          <h3 className="widget-title">Workforce Lifecycle Distribution</h3>
          <p className="widget-subtitle">Distribution across all 5 workforce lifecycle states</p>
        </div>
      </div>

      {/* Multi-segment Stacked Progress Bar */}
      <div className="stacked-progress-bar" style={{ height: '12px', borderRadius: '6px', overflow: 'hidden', display: 'flex', backgroundColor: '#E2E8F0', margin: '1rem 0' }}>
        {distribution.map((item) => {
          if (item.count === 0) return null;
          const color = STATUS_COLORS[item.status]?.bg || '#94A3B8';
          return (
            <div
              key={item.status}
              title={`${item.status}: ${item.count} (${item.percentage}%)`}
              style={{
                width: `${item.percentage}%`,
                backgroundColor: color,
                transition: 'width 0.4s ease',
              }}
            />
          );
        })}
      </div>

      {/* Legend & Badges Grid */}
      <div className="lifecycle-legend-grid">
        {distribution.map((item) => {
          const config = STATUS_COLORS[item.status] || { bg: '#94A3B8', tint: '#F1F5F9', text: '#475569' };
          return (
            <div key={item.status} className="legend-item-card" style={{ backgroundColor: config.tint }}>
              <div className="legend-dot" style={{ backgroundColor: config.bg }} />
              <div className="legend-info">
                <span className="legend-label" style={{ color: config.text }}>{item.status}</span>
                <span className="legend-count">{item.count} employees ({item.percentage}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
