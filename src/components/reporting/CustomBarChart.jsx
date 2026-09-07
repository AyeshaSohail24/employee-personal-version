import React from 'react';

/**
 * Pure React & CSS Horizontal Bar Chart
 * Renders categories with percentage fills, exact counts, and labels.
 */
export function HorizontalBarChart({ items = [], title = '', maxCount = 0, accentColor = 'var(--color-primary)' }) {
  const highest = maxCount || Math.max(...items.map((i) => i.count || 0), 1);

  return (
    <div className="reporting-chart-card table-container-card" style={{ padding: '1.25rem' }}>
      {title && <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>{title}</h3>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {items.map((item, idx) => {
          const widthPercent = Math.min(Math.round(((item.count || 0) / highest) * 100), 100);
          return (
            <div key={item.id || item.name || idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                <span style={{ color: 'var(--text-main)' }}>{item.name || item.type || item.mode}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {item.count} ({item.percentage !== undefined ? item.percentage : Math.round((item.count / highest) * 100)}%)
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  width: '100%',
                  backgroundColor: 'var(--bg-hover)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${widthPercent}%`,
                    backgroundColor: item.color || accentColor,
                    borderRadius: '4px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Multi-segment Stacked Distribution Bar Chart
 * Renders a single horizontal bar split into colored segments (e.g., On-site / Hybrid / Remote).
 */
export function StackedBarChart({ segments = [], title = '', totalCount = 0 }) {
  const total = totalCount || segments.reduce((sum, s) => sum + (s.count || 0), 0) || 1;

  return (
    <div className="reporting-chart-card table-container-card" style={{ padding: '1.25rem' }}>
      {title && <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>{title}</h3>}

      {/* Multi-segment Bar */}
      <div
        style={{
          display: 'flex',
          height: '16px',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-hover)',
          marginBottom: '1rem',
        }}
      >
        {segments.map((seg, idx) => {
          const pct = Math.round(((seg.count || 0) / total) * 100);
          if (pct <= 0) return null;
          return (
            <div
              key={seg.label || idx}
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color || 'var(--color-primary)',
                height: '100%',
              }}
              title={`${seg.label}: ${seg.count} (${pct}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'flex-start' }}>
        {segments.map((seg, idx) => {
          const pct = Math.round(((seg.count || 0) / total) * 100);
          return (
            <div key={seg.label || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: seg.color || 'var(--color-primary)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{seg.label}:</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {seg.count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
