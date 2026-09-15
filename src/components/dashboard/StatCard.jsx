import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  description,
  linkTo,
  badgeBg = 'var(--color-primary-light)',
  badgeColor = 'var(--color-primary)',
}) {
  return (
    <div className="stat-card">
      {/* Icon + label share ONE row (with the arrow on the far right) instead of the icon
          occupying its own row above the label — this is the actual structural change that
          removes a whole vertical block per card, closing the remaining gap to the compact
          reference density without dropping the icon, arrow, label, count, or description. */}
      <div className="stat-card-top-row">
        <div className="stat-card-title-group">
          <div className="stat-card-icon" style={{ backgroundColor: badgeBg, color: badgeColor }}>
            {Icon && <Icon size={14} />}
          </div>
          <span className="stat-card-title">{title}</span>
        </div>
        {linkTo && (
          <Link to={linkTo} className="stat-card-link" title={`View ${title}`}>
            <ArrowUpRight size={14} />
          </Link>
        )}
      </div>

      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {description && <p className="stat-card-description">{description}</p>}
      </div>
    </div>
  );
}
