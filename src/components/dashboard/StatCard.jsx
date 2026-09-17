import React from 'react';

/**
 * Information-only KPI card — displays a lifecycle count and never navigates anywhere. Dashboard-
 * only (no other consumer), so this stays a plain, non-interactive container: no Link, no
 * click-through, no arrow. Detailed personnel records live in the Personnel module, reached
 * through its own navigation, not through these summary cards.
 */
export default function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  description,
  badgeBg = 'var(--color-primary-light)',
  badgeColor = 'var(--color-primary)',
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-title-group">
        <div className="stat-card-icon" style={{ backgroundColor: badgeBg, color: badgeColor }}>
          {Icon && <Icon size={14} />}
        </div>
        <span className="stat-card-title">{title}</span>
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {description && <p className="stat-card-description">{description}</p>}
      </div>
    </div>
  );
}
