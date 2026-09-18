import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calendar, Mail, Eye } from 'lucide-react';
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

export default function EmployeeCardView({ employees = [] }) {
  return (
    <div className="employee-card-grid">
      {employees.map((emp) => {
        const statusPill = STATUS_PILL_STYLES[emp.status] || { bg: '#F1F5F9', color: '#475569' };
        const modePill = MODE_PILL_STYLES[emp.workMode] || { bg: '#F1F5F9', color: '#475569' };
        const salaryPill = SALARY_PILL_STYLES[emp.allowance] || { bg: '#ECFDF5', color: '#059669' };
        const typePill = TYPE_PILL_STYLES[emp.directoryType] || { bg: '#F1F5F9', color: '#475569' };
        const isFormer = emp.status === 'Former';
        const duration = calculateDurationProgress(emp.startDate, emp.contractEndDate);

        return (
          <div key={emp.id} className="employee-card">
            {/* TOP: Avatar, Name, ID, Status */}
            <div className="emp-card-header">
              <div
                className="emp-card-avatar"
                style={isFormer ? { background: '#64748B' } : undefined}
              >
                {emp.photo}
              </div>

              <span className="status-pill" style={{ backgroundColor: statusPill.bg, color: statusPill.color }}>
                {emp.status}
              </span>
            </div>

            <div className="emp-card-identity">
              <h3 className="emp-card-name">{emp.fullName}</h3>
              <span className="emp-card-code" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{emp.employeeId}</span>
              <div className="detail-row" style={{ marginTop: '0.25rem' }}>
                <Mail size={14} className="detail-icon" />
                <span className="detail-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.workEmail}</span>
              </div>
              {/* Navigates to the dedicated Personnel Details page instead of opening
                  PersonnelProfileModal (per direct user request: a person's record can grow to
                  include CV/resume PDFs, which don't fit comfortably in a modal). */}
              <Link to={`/employees/${emp.id}`} className="btn-compact-override" style={{ marginTop: '0.5rem', textDecoration: 'none' }}>
                <Eye size={12} />
                <span>View Details</span>
              </Link>
            </div>

            {/* BODY: Department, Type, Mode */}
            <div className="emp-card-body-group">
              <div className="detail-row">
                <Building2 size={15} className="detail-icon" />
                <span className="detail-text" style={{ fontWeight: 600 }}>{emp.department ? emp.department.name : 'Unassigned'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <span className="status-pill" style={{ backgroundColor: typePill.bg, color: typePill.color }}>
                  {emp.directoryType}
                </span>
                <span className="status-pill" style={{ backgroundColor: modePill.bg, color: modePill.color }}>
                  {emp.workMode || 'On-site'}
                </span>
              </div>
            </div>

            {/* DETAILS: Dates, Salary */}
            <div className="emp-card-details">
              <div className="detail-row">
                <Calendar size={15} className="detail-icon" />
                <div className="dates-cell">
                  <span className="dates-start">{formatDateDisplay(emp.startDate)}</span>
                  <span className="dates-arrow-end">
                    &ndash; {emp.contractEndDate ? formatDateDisplay(emp.contractEndDate) : '—'}
                  </span>
                </div>
              </div>

              <span className="status-pill" style={{ backgroundColor: salaryPill.bg, color: salaryPill.color, alignSelf: 'flex-start' }}>
                {emp.allowance || 'Paid'}
              </span>
            </div>

            {/* BOTTOM: Duration progress */}
            <div className="emp-card-duration">
              {duration.percent === null ? (
                <span className="duration-ongoing-text">Ongoing</span>
              ) : (
                <div className="duration-cell">
                  <div className="duration-bar-track">
                    <div className={DURATION_FILL_CLASS[duration.state]} style={{ width: `${duration.percent}%` }} />
                  </div>
                  <div className="duration-meta-row">
                    <span className="duration-percent">{duration.percent}%</span>
                    <span className="duration-label">{duration.label}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer tags */}
            {Array.isArray(emp.resolvedTags) && emp.resolvedTags.length > 0 && (
              <div className="emp-card-footer">
                <div className="emp-tag-dots-group">
                  {emp.resolvedTags.map((tag) => (
                    <span key={tag.id} className="tag-dot-pill" title={`${tag.name} (${tag.category || 'Tag'})`}>
                      <span className="tag-dot" style={{ backgroundColor: tag.color || '#129FA9' }} />
                      <span className="tag-name-text">{tag.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
