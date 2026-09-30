import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import { formatTenure, resolveExitTypeDisplay } from '../../domain/formerDomain.js';

const TYPE_PILL_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

// Each row opens that person's historical record (/former/{id}) — the whole row is clickable, like
// the Personnel list (EmployeeListView), with Enter/Space from the keyboard.
export default function FormerListView({ employees = [] }) {
  const navigate = useNavigate();
  return (
    <div className="directory-table-card">
      <div className="widget-table-wrapper">
        <table className="widget-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>PERSONNEL</th>
              <th style={{ width: '11%' }}>TYPE</th>
              <th style={{ width: '19%' }}>DEPARTMENT</th>
              <th style={{ width: '18%' }}>EMPLOYMENT PERIOD</th>
              <th style={{ width: '11%' }}>TENURE</th>
              <th style={{ width: '13%' }}>EXIT TYPE</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const typePill = TYPE_PILL_STYLES[emp.directoryType] || { bg: '#F1F5F9', color: '#475569' };
              const tenure = formatTenure(emp.startDate, emp.contractEndDate);
              const openRecord = () => navigate(`/former/${emp.id}`);

              return (
                <tr
                  key={emp.id}
                  className="directory-table-row"
                  tabIndex={0}
                  title={`View ${emp.fullName}'s record`}
                  aria-label={`View ${emp.fullName}'s record`}
                  onClick={openRecord}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openRecord();
                    }
                  }}
                >
                  {/* 1. PERSONNEL — avatar, name, Personnel ID (never the internal id) */}
                  <td style={{ overflow: 'hidden' }}>
                    <div className="table-user-cell">
                      <div className="table-avatar" style={{ background: '#64748B' }}>
                        {emp.photo}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="table-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.fullName}
                        </div>
                        <div className="table-user-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.employeeId}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 2. TYPE */}
                  <td>
                    <span className="status-pill" style={{ backgroundColor: typePill.bg, color: typePill.color }}>
                      {emp.directoryType}
                    </span>
                  </td>

                  {/* 3. DEPARTMENT */}
                  <td>
                    <div className="table-text-main">{emp.department ? emp.department.name : '—'}</div>
                  </td>

                  {/* 4. EMPLOYMENT PERIOD */}
                  <td>
                    <div className="dates-cell">
                      <span className="dates-start">{formatDateDisplay(emp.startDate)}</span>
                      <span className="dates-arrow-end">
                        &rarr; {emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : '—'}
                      </span>
                    </div>
                  </td>

                  {/* 5. TENURE */}
                  <td>
                    <div className="table-text-main">{tenure || '—'}</div>
                  </td>

                  {/* 6. EXIT TYPE — never fabricated; "—" when no Exit Information was ever recorded */}
                  <td>
                    <div className="table-text-main">{resolveExitTypeDisplay(emp.exitInfo) || '—'}</div>
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
