import React from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { formatDateDisplay } from '../../utils/dateUtils.js';
import { formatTenure, resolveExitTypeDisplay } from '../../domain/formerDomain.js';

const TYPE_PILL_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

export default function FormerListView({ employees = [] }) {
  return (
    <div className="directory-table-card">
      <div className="widget-table-wrapper">
        <table className="widget-table">
          <thead>
            <tr>
              <th style={{ width: '20%' }}>PERSONNEL</th>
              <th style={{ width: '8%' }}>TYPE</th>
              <th style={{ width: '13%' }}>FORMER ROLE</th>
              <th style={{ width: '12%' }}>DEPARTMENT</th>
              <th style={{ width: '13%' }}>EMPLOYMENT PERIOD</th>
              <th style={{ width: '10%' }}>TENURE</th>
              <th style={{ width: '11%' }}>EXIT TYPE</th>
              <th style={{ width: '8%' }}>OFFBOARDING</th>
              <th style={{ width: '11%' }}>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const typePill = TYPE_PILL_STYLES[emp.directoryType] || { bg: '#F1F5F9', color: '#475569' };
              const tenure = formatTenure(emp.startDate, emp.contractEndDate);
              const isOffboardingCompleted = emp.offboardingInstance?.derivedStatus === 'Completed';

              return (
                <tr key={emp.id}>
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

                  {/* 3. FORMER ROLE */}
                  <td>
                    <div className="table-text-main">{emp.position ? emp.position.name : '—'}</div>
                  </td>

                  {/* 4. DEPARTMENT */}
                  <td>
                    <div className="table-text-main">{emp.department ? emp.department.name : '—'}</div>
                  </td>

                  {/* 5. EMPLOYMENT PERIOD */}
                  <td>
                    <div className="dates-cell">
                      <span className="dates-start">{formatDateDisplay(emp.startDate)}</span>
                      <span className="dates-arrow-end">
                        &rarr; {emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : '—'}
                      </span>
                    </div>
                  </td>

                  {/* 6. TENURE */}
                  <td>
                    <div className="table-text-main">{tenure || '—'}</div>
                  </td>

                  {/* 7. EXIT TYPE — never fabricated; "—" when no Exit Information was ever recorded */}
                  <td>
                    <div className="table-text-main">{resolveExitTypeDisplay(emp.exitInfo) || '—'}</div>
                  </td>

                  {/* 8. OFFBOARDING — reuses the existing offboarding system's own derived status;
                      never fabricated when no plan instance exists for this person. */}
                  <td>
                    <div className="table-text-main">{isOffboardingCompleted ? 'Completed' : '—'}</div>
                  </td>

                  {/* 9. DETAILS */}
                  <td>
                    <Link to={`/former/${emp.id}`} className="btn-compact-override" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>
                      <History size={12} />
                      <span>View Record</span>
                    </Link>
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
