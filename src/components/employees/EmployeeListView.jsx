import React from 'react';
import { formatCompactLocation } from '../../domain/locationDomain';
import { formatCompactPosition } from '../../domain/positionDomain';

const STATUS_PILL_STYLES = {
  Active: { bg: '#ECFDF5', color: '#059669' },
  Onboarding: { bg: '#E6F7F8', color: '#0E848D' },
  Upcoming: { bg: '#EFF6FF', color: '#2563EB' },
  Departing: { bg: '#FFFBEB', color: '#D97706' },
  Former: { bg: '#F1F5F9', color: '#475569' },
};

export default function EmployeeListView({ employees = [] }) {
  return (
    <div className="directory-table-card">
      <div className="widget-table-wrapper">
        <table className="widget-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Position</th>
              <th>Department</th>
              <th>Location</th>
              <th>Status</th>
              <th>Manager</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const pillStyle = STATUS_PILL_STYLES[emp.status] || { bg: '#F1F5F9', color: '#475569' };
              const isFormer = emp.status === 'Former';
              const isUpcoming = emp.status === 'Upcoming';

              return (
                <tr key={emp.id}>
                  <td>
                    <div className="table-user-cell">
                      <div
                        className="table-avatar"
                        style={isFormer ? { background: '#64748B' } : undefined}
                      >
                        {emp.photo}
                      </div>
                      <div>
                        <div className="table-user-name">{emp.fullName}</div>
                        <div className="table-user-code">{emp.employeeId}</div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <div className="table-text-main pos-title-text">
                      {emp.position ? formatCompactPosition(emp.position.name) : 'Unassigned'}
                    </div>
                    {isUpcoming && <div className="table-sub-badge">Scheduled Position</div>}
                    {isFormer && <div className="table-sub-badge">Last Held Position</div>}
                  </td>

                  <td>
                    <div className="table-text-main">{emp.department ? emp.department.name : 'Unassigned'}</div>
                  </td>

                  <td>
                    <div className="table-text-secondary">{formatCompactLocation(emp.location)}</div>
                  </td>

                  <td>
                    <span className="status-pill" style={{ backgroundColor: pillStyle.bg, color: pillStyle.color }}>
                      {emp.status}
                    </span>
                  </td>

                  <td>
                    <div className="table-text-secondary">
                      {emp.manager ? emp.manager.fullName : 'None (Top Level)'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
