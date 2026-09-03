import React from 'react';
import { Shield, Clock, XCircle, History } from 'lucide-react';
import { PRESENCE_STATES, PRESENCE_SOURCES } from '../../domain/presenceDomain';
import { formatCompactLocation } from '../../domain/locationDomain';
import { formatCompactPosition } from '../../domain/positionDomain';

export default function PresenceTable({
  employees = [],
  onOpenOverride,
  onClearOverride,
  onOpenHistory,
}) {
  const getBadgeStyle = (state) => {
    switch (state) {
      case PRESENCE_STATES.PRESENT:
        return { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' };
      case PRESENCE_STATES.REMOTE:
        return { bg: 'var(--color-primary-light)', color: 'var(--color-primary-active)', border: '#99E6EB' };
      case PRESENCE_STATES.ON_LEAVE:
        return { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' };
      case PRESENCE_STATES.ABSENT:
        return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
      case PRESENCE_STATES.NOT_SCHEDULED:
        return { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
      case PRESENCE_STATES.UNKNOWN:
      default:
        return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
    }
  };

  return (
    <div className="table-container-card presence-table-card">
      <table className="presence-data-table">
        <thead>
          <tr>
            <th style={{ width: '16.5%', textAlign: 'left' }}>Employee</th>
            <th style={{ width: '25%', textAlign: 'left' }}>Position & Department</th>
            <th style={{ width: '14%', textAlign: 'left' }}>Work Location</th>
            <th style={{ width: '8.5%', textAlign: 'left' }}>Work Mode</th>
            <th style={{ width: '11%', textAlign: 'left' }}>Presence State</th>
            <th style={{ width: '13%', textAlign: 'left' }}>Data Source</th>
            <th style={{ width: '12%', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const badge = getBadgeStyle(emp.presenceState);
            const isManualOverride = emp.presenceSource === PRESENCE_SOURCES.MANUAL_OVERRIDE;
            const formattedLocation = formatCompactLocation(emp.location);
            const formattedPosition = formatCompactPosition(emp.position ? emp.position.name : 'Unassigned');

            return (
              <tr key={emp.id} className="presence-table-row">
                {/* 1. Compact Employee Identity Block */}
                <td>
                  <div className="emp-identity-block">
                    <div className="emp-avatar-circle">{emp.photo}</div>
                    <div className="emp-identity-text">
                      <div className="emp-name-text">{emp.fullName}</div>
                      <div className="emp-id-subtext">{emp.employeeId}</div>
                    </div>
                  </div>
                </td>

                {/* 2. Position & Department 2-Line Hierarchy */}
                <td>
                  <div className="pos-dept-block">
                    <div className="pos-title-text">{formattedPosition}</div>
                    <div className="dept-sub-text">{emp.department ? emp.department.name : 'Rizurf'}</div>
                  </div>
                </td>

                {/* 3. Concise Work Location Single-Line Display */}
                <td>
                  <div className="location-block">
                    <div className="loc-main-text">{formattedLocation}</div>
                  </div>
                </td>

                {/* 4. Compact Work Mode Badge */}
                <td>
                  <span className={`workmode-badge mode-${emp.workMode ? emp.workMode.toLowerCase().replace(/[^a-z0-9]/g, '') : 'onsite'}`}>
                    {emp.workMode}
                  </span>
                </td>

                {/* 5. Compact Presence State Badge */}
                <td>
                  <span
                    className="presence-badge"
                    style={{ backgroundColor: badge.bg, color: badge.color, borderColor: badge.border }}
                  >
                    {emp.presenceState}
                  </span>
                </td>

                {/* 6. Secondary Data Source */}
                <td>
                  <span className={`source-subtle-badge ${isManualOverride ? 'manual-override' : ''}`}>
                    {isManualOverride && <Shield size={11} />}
                    <span>{emp.presenceSource}</span>
                  </span>
                </td>

                {/* 7. Compact Actions */}
                <td style={{ textAlign: 'right' }}>
                  <div className="presence-actions-compact">
                    {isManualOverride ? (
                      <button
                        type="button"
                        className="btn-compact-clear"
                        onClick={() => onClearOverride(emp.id)}
                        title="Clear manual override and restore derived presence"
                      >
                        <XCircle size={13} />
                        <span>Clear</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-compact-override"
                        onClick={() => onOpenOverride(emp)}
                        title="Manually override current presence state"
                      >
                        <Clock size={13} />
                        <span>Override</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-compact-history"
                      onClick={() => onOpenHistory(emp)}
                      title="View presence override audit history"
                    >
                      <History size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
