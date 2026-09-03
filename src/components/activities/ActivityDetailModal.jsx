import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, User, Clock, CheckCircle2, RotateCcw, Edit2, Shield, Save } from 'lucide-react';
import { resolveDueState, ACTIVITY_DUE_STATES } from '../../domain/activityDomain';
import { formatDateDisplay } from '../../utils/dateUtils';

export default function ActivityDetailModal({
  isOpen,
  onClose,
  activity,
  referenceDate,
  employees = [],
  onUpdate,
  onMarkComplete,
  onReopen,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    dueDate: '',
    assigneeId: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activity) {
      setEditForm({
        dueDate: activity.dueDate || '',
        assigneeId: activity.assigneeId || '',
        description: activity.description || '',
      });
      setIsEditing(false);
      setIsSubmitting(false);
    }
  }, [activity]);

  if (!isOpen || !activity) return null;

  const dueState = resolveDueState(activity, referenceDate);
  const relEmp = activity.relatedEmployee || {};
  const isFormerRel = relEmp.status === 'Former';

  const handleSaveUpdate = async () => {
    setIsSubmitting(true);
    try {
      await onUpdate(activity.id, editForm);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update activity:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <CheckSquare size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 className="modal-title">{activity.title}</h3>
                <span className="act-type-pill" style={{ fontSize: '0.725rem' }}>
                  {activity.type ? activity.type.name : 'Task'}
                </span>
              </div>
              <p className="modal-subtitle">Activity ID: {activity.id} • Source: {activity.source}</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Status Alert Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              backgroundColor:
                dueState === ACTIVITY_DUE_STATES.COMPLETED
                  ? '#ECFDF5'
                  : dueState === ACTIVITY_DUE_STATES.OVERDUE
                  ? '#FEF2F2'
                  : dueState === ACTIVITY_DUE_STATES.DUE_TODAY
                  ? '#FFFBEB'
                  : 'var(--color-primary-light)',
              color:
                dueState === ACTIVITY_DUE_STATES.COMPLETED
                  ? '#059669'
                  : dueState === ACTIVITY_DUE_STATES.OVERDUE
                  ? '#DC2626'
                  : dueState === ACTIVITY_DUE_STATES.DUE_TODAY
                  ? '#D97706'
                  : 'var(--color-primary-active)',
              border: `1px solid ${
                dueState === ACTIVITY_DUE_STATES.COMPLETED
                  ? '#A7F3D0'
                  : dueState === ACTIVITY_DUE_STATES.OVERDUE
                  ? '#FECACA'
                  : dueState === ACTIVITY_DUE_STATES.DUE_TODAY
                  ? '#FDE68A'
                  : '#99E6EB'
              }`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
              <Clock size={16} />
              <span>State: {dueState}</span>
            </div>

            <div>
              {activity.completed ? (
                <button
                  type="button"
                  className="btn-compact-clear"
                  onClick={() => onReopen(activity.id)}
                >
                  <RotateCcw size={13} />
                  <span>Reopen Activity</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-compact-override"
                  style={{ backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' }}
                  onClick={() => onMarkComplete(activity.id)}
                >
                  <CheckCircle2 size={13} />
                  <span>Mark Complete</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Metadata Rows */}
          <div className="dept-card-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="dept-card-body" style={{ borderTop: 'none', paddingTop: 0 }}>
              <div className="dept-meta-row">
                <User size={15} className="dept-meta-icon" />
                <span className="dept-meta-label">Related Employee:</span>
                <span className="dept-meta-val">
                  {relEmp.fullName || 'Unknown'} ({relEmp.employeeId || 'N/A'})
                  {isFormerRel && <span className="emp-status-sub-pill former" style={{ marginLeft: '4px' }}>Former</span>}
                </span>
              </div>

              <div className="dept-meta-row">
                <Shield size={15} className="dept-meta-icon" />
                <span className="dept-meta-label">Assignee:</span>
                {isEditing ? (
                  <select
                    className="filter-select"
                    style={{ fontSize: '0.8rem' }}
                    value={editForm.assigneeId}
                    onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="dept-meta-val">
                    {activity.assigneeEmployee ? activity.assigneeEmployee.fullName : 'Unassigned'}
                  </span>
                )}
              </div>
            </div>

            <div className="dept-card-body" style={{ borderTop: 'none', paddingTop: 0 }}>
              <div className="dept-meta-row">
                <Calendar size={15} className="dept-meta-icon" />
                <span className="dept-meta-label">Due Date:</span>
                {isEditing ? (
                  <input
                    type="date"
                    className="filter-select"
                    style={{ fontSize: '0.8rem' }}
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  />
                ) : (
                  <span className="dept-meta-val">{formatDateDisplay(activity.dueDate)}</span>
                )}
              </div>

              <div className="dept-meta-row">
                <Clock size={15} className="dept-meta-icon" />
                <span className="dept-meta-label">Created At:</span>
                <span className="dept-meta-val" style={{ fontSize: '0.775rem' }}>
                  {formatDateDisplay(activity.createdAt ? activity.createdAt.split('T')[0] : '')}
                </span>
              </div>
            </div>
          </div>

          {/* Description & Notes */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Description & Notes</label>
              {!isEditing && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 size={13} />
                  <span>Edit Details</span>
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                className="form-textarea"
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            ) : (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  color: 'var(--text-main)',
                  minHeight: '80px',
                }}
              >
                {activity.description || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No additional notes provided.</span>}
              </div>
            )}
          </div>

          {/* Completion History Metadata */}
          {activity.completed && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#ECFDF5', borderRadius: 'var(--radius-md)', fontSize: '0.775rem', color: '#047857' }}>
              Completed on {formatDateDisplay(activity.completedAt ? activity.completedAt.split('T')[0] : '')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-subtle)' }}>
          {isEditing ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveUpdate} disabled={isSubmitting}>
                <Save size={14} style={{ marginRight: '4px' }} />
                <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </>
          ) : (
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
