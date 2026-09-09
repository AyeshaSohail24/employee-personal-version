import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';

export default function DepartmentSnapshotWidget({ departments = [], totalActiveWorkforce = 1 }) {
  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            <Building2 size={20} />
          </div>
          <div>
            <h3 className="widget-title">Organization Snapshot</h3>
            <p className="widget-subtitle">Current workforce headcount by department</p>
          </div>
        </div>
        <Link to="/employees" className="widget-action-link">
          <span>View All</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="dept-snapshot-list">
        {departments.map((dept) => {
          const headcount = dept.currentHeadcount || 0;
          const percentage = totalActiveWorkforce > 0 ? Math.round((headcount / totalActiveWorkforce) * 100) : 0;
          const color = dept.color || 'var(--color-primary)';

          return (
            <div key={dept.id} className="dept-snapshot-row">
              <div className="dept-info-group">
                <div className="dept-color-indicator" style={{ backgroundColor: color }} />
                <div>
                  <div className="dept-name">{dept.name}</div>
                  <div className="dept-manager">Manager: {dept.managerName || 'Unassigned'}</div>
                </div>
              </div>

              <div className="dept-metric-group">
                <div className="dept-bar-container">
                  <div className="dept-bar-fill" style={{ width: `${percentage}%`, backgroundColor: color }} />
                </div>
                <div className="dept-count-badge">
                  {headcount} {headcount === 1 ? 'employee' : 'employees'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
