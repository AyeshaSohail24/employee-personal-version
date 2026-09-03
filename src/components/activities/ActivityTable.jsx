import React from 'react';
import {
  CheckSquare,
  PhoneCall,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  RotateCcw,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { resolveDueState, ACTIVITY_DUE_STATES } from '../../domain/activityDomain.js';
import { formatDateDisplay, getDaysDifference } from '../../utils/dateUtils.js';

const ICON_MAP = {
  CheckSquare,
  PhoneCall,
  Calendar,
  FileText,
  ClipboardCheck,
  Clock,
};

export default function ActivityTable({
  activities = [],
  referenceDate,
  onViewDetail,
  onMarkComplete,
  onReopen,
  loading = false,
}) {
  const getDueBadgeStyle = (state) => {
    switch (state) {
      case ACTIVITY_DUE_STATES.COMPLETED:
        return { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' };
      case ACTIVITY_DUE_STATES.DUE_TODAY:
        return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
      case ACTIVITY_DUE_STATES.OVERDUE:
        return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
      case ACTIVITY_DUE_STATES.UPCOMING:
      default:
        return { bg: 'var(--color-primary-light)', color: 'var(--color-primary-active)', border: '#99E6EB' };
    }
  };

  const renderTypeIcon = (iconName) => {
    const Component = ICON_MAP[iconName] || CheckSquare;
    return <Component size={13} className="act-type-icon" />;
  };

  if (loading) {
    return (
      <div className="table-container-card presence-table-card activity-table-card">
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading activities...
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="directory-empty-card">
        <div className="empty-icon-badge">
          <CheckCircle2 size={28} />
        </div>
        <h3 className="empty-title">No Activities Found</h3>
        <p className="empty-description">
          There are no tasks matching your search or active filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="table-container-card presence-table-card activity-table-card">
      <table className="presence-data-table activity-data-table">
        <thead>
          <tr>
            <th style={{ width: '19.5%', textAlign: 'left' }}>Activity Task</th>
            <th style={{ width: '13%', textAlign: 'left' }}>Type</th>
            <th style={{ width: '19%', textAlign: 'left' }}>Related Employee</th>
            <th style={{ width: '10.5%', textAlign: 'left' }}>Assignee</th>
            <th style={{ width: '22.5%', textAlign: 'center' }}>Due Date & State</th>
            <th style={{ width: '15.5%', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act) => {
            const dueState = resolveDueState(act, referenceDate);
            const badgeStyle = getDueBadgeStyle(dueState);

            const relEmp = act.relatedEmployee || {};
            const isFormerRel = relEmp.status === 'Former';
            const isDepartingRel = relEmp.status === 'Departing';
            const isOnboardingRel = relEmp.status === 'Onboarding';

            const daysDiff = getDaysDifference(act.dueDate, referenceDate);

            return (
              <tr key={act.id} className="presence-table-row">
                {/* 1. Activity Task Title Only (Natural 2-line wrapping allowed) */}
                <td style={{ minWidth: 0 }}>
                  <div className="act-title-text" style={{ whiteSpace: 'normal', lineHeight: '1.25' }}>
                    {act.title}
                  </div>
                </td>

                {/* 2. Type Badge (Sufficient width to prevent overlap with Related Employee) */}
                <td style={{ minWidth: 0 }}>
                  <span className="act-type-pill">
                    {renderTypeIcon(act.type ? act.type.icon : 'CheckSquare')}
                    <span>{act.type ? act.type.name : 'General'}</span>
                  </span>
                </td>

                {/* 3. Related Employee Block (3-Line Stack: Name -> ID -> Status Badge) */}
                <td style={{ minWidth: 0 }}>
                  <div className="emp-identity-block">
                    <div className="emp-avatar-circle" style={isFormerRel ? { background: '#64748B' } : undefined}>
                      {relEmp.photo || 'EM'}
                    </div>
                    <div className="emp-identity-text">
                      <div className="emp-name-text" style={{ whiteSpace: 'nowrap' }}>
                        {relEmp.fullName || 'Unknown Employee'}
                      </div>
                      <div className="emp-id-subtext">{relEmp.employeeId || 'N/A'}</div>
                      {(isFormerRel || isDepartingRel || isOnboardingRel) && (
                        <div style={{ marginTop: '0.1rem' }}>
                          {isFormerRel && <span className="emp-status-sub-pill former" style={{ marginLeft: 0 }}>FORMER</span>}
                          {isDepartingRel && <span className="emp-status-sub-pill departing" style={{ marginLeft: 0 }}>DEPARTING</span>}
                          {isOnboardingRel && <span className="emp-status-sub-pill onboarding" style={{ marginLeft: 0 }}>ONBOARDING</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* 4. Assignee Block */}
                <td style={{ minWidth: 0 }}>
                  <div className="table-text-main" style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                    {act.assigneeEmployee ? act.assigneeEmployee.fullName : 'Unassigned'}
                  </div>
                </td>

                {/* 5. Horizontally Centered Due Date & State (Matched Pill Width to Date Line) */}
                <td style={{ minWidth: 0, textAlign: 'center' }}>
                  <div className="act-due-block" style={{ alignItems: 'center', textAlign: 'center' }}>
                    <span
                      className="presence-badge act-due-badge-matched"
                      style={{
                        backgroundColor: badgeStyle.bg,
                        color: badgeStyle.color,
                        borderColor: badgeStyle.border,
                      }}
                    >
                      {dueState === ACTIVITY_DUE_STATES.OVERDUE && <AlertCircle size={11} style={{ marginRight: '3px' }} />}
                      {dueState}
                    </span>

                    <div className="act-due-date-sub" style={{ whiteSpace: 'nowrap', fontSize: '0.725rem', textAlign: 'center' }}>
                      {formatDateDisplay(act.dueDate)}
                      {dueState === ACTIVITY_DUE_STATES.OVERDUE && daysDiff < 0 && (
                        <span className="overdue-days-tag"> · {Math.abs(daysDiff)}d ago</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* 6. Compact Actions (Fully Visible & Centered) */}
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <div className="presence-actions-compact" style={{ justifyContent: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn-compact-override"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem' }}
                      onClick={() => onViewDetail(act)}
                      title="View activity details"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>

                    {act.completed ? (
                      <button
                        type="button"
                        className="btn-compact-clear"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.725rem' }}
                        onClick={() => onReopen(act.id)}
                        title="Reopen completed task"
                      >
                        <RotateCcw size={12} />
                        <span>Reopen</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-compact-override"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.725rem',
                          backgroundColor: '#ECFDF5',
                          color: '#059669',
                          borderColor: '#A7F3D0',
                        }}
                        onClick={() => onMarkComplete(act.id)}
                        title="Mark task as complete"
                      >
                        <CheckCircle2 size={12} />
                        <span>Done</span>
                      </button>
                    )}
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
