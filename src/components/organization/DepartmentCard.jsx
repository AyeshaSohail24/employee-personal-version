import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, UserCheck } from 'lucide-react';

export default function DepartmentCard({ department }) {
  const headcount = department.currentHeadcount || 0;
  const color = department.color || 'var(--color-primary)';

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
        {/* Department Manager */}
        <div className="dept-meta-row">
          <UserCheck size={15} className="dept-meta-icon" />
          <span className="dept-meta-label">Manager:</span>
          <span className="dept-meta-val">{department.managerName || 'Unassigned'}</span>
        </div>
      </div>
    </div>
  );
}
