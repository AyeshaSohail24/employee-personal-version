import React from 'react';
import { Link } from 'react-router-dom';
import { UserMinus, ArrowRight } from 'lucide-react';

export default function DepartingWidget({ employees = [] }) {
  return (
    <div className="dashboard-widget">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="widget-icon-badge" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
            <UserMinus size={20} />
          </div>
          <div>
            <h3 className="widget-title">Departing Employees</h3>
            <p className="widget-subtitle">Team members currently undergoing offboarding transition</p>
          </div>
        </div>
        <Link to="/employees/departing" className="widget-action-link">
          <span>View All</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      {employees.length === 0 ? (
        <p className="empty-widget-text">No departing employees currently registered.</p>
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
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <div className="table-user-cell">
                      <div className="table-avatar" style={{ background: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)' }}>
                        {emp.photo}
                      </div>
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
                    <span className="status-pill" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
