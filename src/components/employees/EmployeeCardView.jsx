import React from 'react';
import { MapPin, Building2, User } from 'lucide-react';
import { formatCompactLocation } from '../../domain/locationDomain';
import { formatCompactPosition } from '../../domain/positionDomain';

const STATUS_PILL_STYLES = {
  Active: { bg: '#ECFDF5', color: '#059669' },
  Onboarding: { bg: '#E6F7F8', color: '#0E848D' },
  Upcoming: { bg: '#EFF6FF', color: '#2563EB' },
  Departing: { bg: '#FFFBEB', color: '#D97706' },
  Former: { bg: '#F1F5F9', color: '#475569' },
};

export default function EmployeeCardView({ employees = [] }) {
  return (
    <div className="employee-card-grid">
      {employees.map((emp) => {
        const pillStyle = STATUS_PILL_STYLES[emp.status] || { bg: '#F1F5F9', color: '#475569' };
        const isFormer = emp.status === 'Former';
        const isUpcoming = emp.status === 'Upcoming';

        return (
          <div key={emp.id} className="employee-card">
            {/* Top Card Header */}
            <div className="emp-card-header">
              <div
                className="emp-card-avatar"
                style={isFormer ? { background: '#64748B' } : undefined}
              >
                {emp.photo}
              </div>

              <span className="status-pill" style={{ backgroundColor: pillStyle.bg, color: pillStyle.color }}>
                {emp.status}
              </span>
            </div>

            {/* Employee Basic Identity */}
            <div className="emp-card-identity">
              <h3 className="emp-card-name">{emp.fullName}</h3>
              <span className="emp-card-code">{emp.employeeId}</span>
              <p className="emp-card-position pos-title-text">
                {emp.position ? formatCompactPosition(emp.position.name) : 'Unassigned'}
              </p>
              {isUpcoming && <span className="emp-card-tag-sub">Scheduled Position</span>}
              {isFormer && <span className="emp-card-tag-sub">Last Held Position</span>}
            </div>

            {/* Department & Location Details */}
            <div className="emp-card-details">
              <div className="detail-row">
                <Building2 size={15} className="detail-icon" />
                <span className="detail-text">{emp.department ? emp.department.name : 'Unassigned'}</span>
              </div>

              <div className="detail-row">
                <MapPin size={15} className="detail-icon" />
                <span className="detail-text">{formatCompactLocation(emp.location)}</span>
              </div>

              <div className="detail-row">
                <User size={15} className="detail-icon" />
                <span className="detail-text">
                  Manager: {emp.manager ? emp.manager.fullName : 'Top Level'}
                </span>
              </div>
            </div>

            {/* Footer tags */}
            <div className="emp-card-footer">
              <span className="emp-type-badge">
                {emp.employeeTypeId === 'type-1'
                  ? 'Full-time'
                  : emp.employeeTypeId === 'type-2'
                  ? 'Contract'
                  : emp.employeeTypeId === 'type-3'
                  ? 'Apprentice'
                  : 'Internship'}
              </span>
              <span className="emp-start-date">Started {emp.startDate}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
