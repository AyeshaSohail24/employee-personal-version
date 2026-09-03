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
      <div className="stat-card-header">
        <div className="stat-card-icon" style={{ backgroundColor: badgeBg, color: badgeColor }}>
          {Icon && <Icon size={22} />}
        </div>
        {linkTo && (
          <Link to={linkTo} className="stat-card-link" title={`View ${title}`}>
            <ArrowUpRight size={18} />
          </Link>
        )}
      </div>

      <div className="stat-card-body">
        <span className="stat-card-title">{title}</span>
        <div className="stat-card-value">{value}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
        {description && <p className="stat-card-description">{description}</p>}
      </div>
    </div>
  );
}
