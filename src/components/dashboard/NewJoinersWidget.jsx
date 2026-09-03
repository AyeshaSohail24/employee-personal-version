import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowRight } from 'lucide-react';

export default function NewJoinersWidget({ employees = [] }) {
  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
            <UserPlus size={20} />
          </div>
          <div>
            <h3 className="widget-title">New Joiners & Upcoming Hires</h3>
            <p className="widget-subtitle">Employees currently onboarding or scheduled to start</p>
          </div>
        </div>
        <Link to="/employees/new-joiners" className="widget-action-link">
          <span>View All</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {employees.length === 0 ? (
        <p className="empty-widget-text">No onboarding or upcoming employees scheduled.</p>
      ) : (
        <div className="widget-table-wrapper">
          <table className="widget-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Department</th>
                <th>Start Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const isUpcoming = emp.status === 'Upcoming';
                const statusBadgeStyle = isUpcoming
                  ? { bg: '#EFF6FF', text: '#2563EB' }
                  : { bg: '#E6F7F8', text: '#0E848D' };

                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="table-user-cell">
                        <div className="table-avatar">{emp.photo}</div>
                        <div>
                          <div className="table-user-name">{emp.fullName}</div>
                          <div className="table-user-code">{emp.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td>{emp.position ? emp.position.name : 'Unassigned'}</td>
                    <td>{emp.department ? emp.department.name : 'Unassigned'}</td>
                    <td>{emp.startDate}</td>
                    <td>
                      <span
                        className="status-pill"
                        style={{ backgroundColor: statusBadgeStyle.bg, color: statusBadgeStyle.text }}
                      >
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
