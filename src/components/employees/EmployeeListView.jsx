import React from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { formatDateDisplay, calculateDurationProgress } from '../../utils/dateUtils.js';

const STATUS_PILL_STYLES = {
  Active: { bg: '#ECFDF5', color: '#059669' },
  Onboarding: { bg: '#E6F7F8', color: '#0E848D' },
  Upcoming: { bg: '#EFF6FF', color: '#2563EB' },
  Departing: { bg: '#FFFBEB', color: '#D97706' },
  Former: { bg: '#F1F5F9', color: '#475569' },
};

const MODE_PILL_STYLES = {
  'On-site': { bg: '#F1F5F9', color: '#475569' },
  Remote: { bg: '#EDE9FE', color: '#6D28D9' },
  Hybrid: { bg: '#E0F2FE', color: '#0369A1' },
};

const SALARY_PILL_STYLES = {
  Paid: { bg: '#ECFDF5', color: '#059669' },
  Unpaid: { bg: '#FEF3C7', color: '#D97706' },
};

const TYPE_PILL_STYLES = {
  Employee: { bg: '#F1F5F9', color: '#475569' },
  Intern: { bg: '#E0F2FE', color: '#0369A1' },
};

const DURATION_FILL_CLASS = {
  upcoming: 'duration-bar-fill upcoming',
  active: 'duration-bar-fill',
  completed: 'duration-bar-fill completed',
};

function DurationCell({ startDate, contractEndDate }) {
  const duration = calculateDurationProgress(startDate, contractEndDate);

  if (duration.percent === null) {
    return <span className="duration-ongoing-text">Ongoing</span>;
  }

  return (
    <div className="duration-cell">
      <div className="duration-bar-track">
        <div className={DURATION_FILL_CLASS[duration.state]} style={{ width: `${duration.percent}%` }} />
      </div>
      <div className="duration-meta-row">
        <span className="duration-percent">{duration.percent}%</span>
        <span className="duration-label">{duration.label}</span>
      </div>
    </div>
  );
}

export default function EmployeeListView({ employees = [] }) {
  return (
    <div className="directory-table-card">
      <div className="widget-table-wrapper">
        <table className="widget-table">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>ID</th>
              <th style={{ width: '17%' }}>NAME</th>
              <th style={{ width: '12%' }}>DEPARTMENT</th>
              <th style={{ width: '9%' }}>TYPE</th>
              <th style={{ width: '8%' }}>MODE</th>
              <th style={{ width: '10%' }}>DATES</th>
              <th style={{ width: '7%' }}>SALARY</th>
              <th style={{ width: '10%' }}>STATUS</th>
              <th style={{ width: '10%' }}>DURATION</th>
              <th style={{ width: '11%' }}>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const statusPill = STATUS_PILL_STYLES[emp.status] || { bg: '#F1F5F9', color: '#475569' };
              const modePill = MODE_PILL_STYLES[emp.workMode] || { bg: '#F1F5F9', color: '#475569' };
              const salaryPill = SALARY_PILL_STYLES[emp.allowance] || { bg: '#ECFDF5', color: '#059669' };
              const typePill = TYPE_PILL_STYLES[emp.directoryType] || { bg: '#F1F5F9', color: '#475569' };
              const isFormer = emp.status === 'Former';

              return (
                <tr key={emp.id}>
                  {/* 1. ID */}
                  <td>
                    <span className="table-user-code" style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      {emp.employeeId}
                    </span>
                  </td>

                  {/* 2. NAME (+ email underneath) */}
                  <td style={{ overflow: 'hidden' }}>
                    <div className="table-user-cell">
                      <div
                        className="table-avatar"
                        style={isFormer ? { background: '#64748B' } : undefined}
                      >
                        {emp.photo}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="table-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.fullName}</div>
                        <div className="table-user-email" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.workEmail}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 3. DEPARTMENT */}
                  <td>
                    <div className="table-text-main">{emp.department ? emp.department.name : 'Unassigned'}</div>
                  </td>

                  {/* 4. TYPE */}
                  <td>
                    <span className="status-pill" style={{ backgroundColor: typePill.bg, color: typePill.color }}>
                      {emp.directoryType}
                    </span>
                  </td>

                  {/* 5. MODE */}
                  <td>
                    <span className="status-pill" style={{ backgroundColor: modePill.bg, color: modePill.color }}>
                      {emp.workMode || 'On-site'}
                    </span>
                  </td>

                  {/* 6. DATES */}
                  <td>
                    <div className="dates-cell">
                      <span className="dates-start">{formatDateDisplay(emp.startDate)}</span>
                      <span className="dates-arrow-end">
                        &ndash; {emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : '—'}
                      </span>
                    </div>
                  </td>

                  {/* 7. SALARY (label only; underlying data is the existing Paid/Unpaid allowance field) */}
                  <td>
                    <span className="status-pill" style={{ backgroundColor: salaryPill.bg, color: salaryPill.color }}>
                      {emp.allowance || 'Paid'}
                    </span>
                  </td>

                  {/* 8. STATUS */}
                  <td>
                    <span className="status-pill" style={{ backgroundColor: statusPill.bg, color: statusPill.color }}>
                      {emp.status}
                    </span>
                  </td>

                  {/* 9. DURATION */}
                  <td>
                    <DurationCell startDate={emp.startDate} contractEndDate={emp.contractEndDate} />
                  </td>

                  {/* 10. DETAILS — navigates to the dedicated Personnel Details page instead of
                      opening PersonnelProfileModal (per direct user request: a person's record
                      can grow to include CV/resume PDFs, which don't fit comfortably in a modal). */}
                  <td>
                    <Link to={`/employees/${emp.id}`} className="btn-compact-override" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>
                      <Eye size={12} />
                      <span>View Details</span>
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
