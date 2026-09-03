import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, UserCheck, GitBranch, ChevronDown, ChevronUp } from 'lucide-react';

export default function DepartmentCard({ department, parentDepartmentName = null, subDepartments = [] }) {
  const [expanded, setExpanded] = useState(false);
  const headcount = department.currentHeadcount || 0;
  const color = department.color || 'var(--color-primary)';
  const hasSubDepts = subDepartments.length > 0;

  return (
    <div className="department-card">
      <div className="dept-card-header">
        <div className="dept-card-title-group">
          <div className="dept-card-color-dot" style={{ backgroundColor: color }} />
          <div>
            <h3 className="dept-card-name">{department.name}</h3>
            <span className="dept-card-code">{department.code}</span>
          </div>
        </div>

        <Link
          to={`/employees?departmentId=${department.id}`}
          className="dept-headcount-badge"
          title={`View employees in ${department.name}`}
        >
          <Users size={14} />
          <span>{headcount} {headcount === 1 ? 'employee' : 'employees'}</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className="dept-card-body">
        {/* Parent Department */}
        {parentDepartmentName && (
          <div className="dept-meta-row">
            <GitBranch size={15} className="dept-meta-icon" />
            <span className="dept-meta-label">Parent Dept:</span>
            <span className="dept-meta-val">{parentDepartmentName}</span>
          </div>
        )}

        {/* Department Manager */}
        <div className="dept-meta-row">
          <UserCheck size={15} className="dept-meta-icon" />
          <span className="dept-meta-label">Manager:</span>
          <span className="dept-meta-val">{department.managerName || 'Unassigned'}</span>
        </div>

        {/* Scalable Sub-departments Compact Toggle Row */}
        {hasSubDepts && (
          <div className="subdept-section">
            <button
              type="button"
              className={`subdept-toggle-row ${expanded ? 'expanded' : ''}`}
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Hide sub-departments' : 'Show sub-departments'}
            >
              <div className="subdept-toggle-label">
                <GitBranch size={14} className="subdept-icon" />
                <span>Sub-departments ({subDepartments.length})</span>
              </div>
              <div className="subdept-toggle-action">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Inline Expanded Sub-departments List */}
            {expanded && (
              <div className="subdept-expanded-list">
                {subDepartments.map((sub) => (
                  <div key={sub.id} className="subdept-item-row">
                    <div className="subdept-item-info">
                      <div className="subdept-dot" style={{ backgroundColor: sub.color || color }} />
                      <span className="subdept-item-name">{sub.name}</span>
                    </div>
                    <Link
                      to={`/employees?departmentId=${sub.id}`}
                      className="subdept-item-link"
                      title={`View ${sub.name} employees`}
                    >
                      <span>{sub.currentHeadcount || 0}</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
