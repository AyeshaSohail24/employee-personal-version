import React, { useState } from 'react';
import { X, Shield, AlertCircle } from 'lucide-react';
import { PRESENCE_STATES } from '../../domain/presenceDomain';

export default function OverrideModal({ employee, onClose, onSubmit }) {
  const [overrideState, setOverrideState] = useState(PRESENCE_STATES.PRESENT);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!employee) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A valid operational reason is required for manual overrides.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({
        employeeId: employee.id,
        overrideState,
        reason: reason.trim(),
        createdBy: 'Ayesha Z. (HR Admin)',
      });
      onClose();
    } catch (err) {
      console.error('Failed to apply override:', err);
      setError('Failed to apply presence override. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="modal-title">Override Presence State</h2>
              <p className="modal-subtitle">
                Apply manual operational override for {employee.fullName} ({employee.employeeId})
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="modal-error-alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="override-state-select" className="form-label">
              New Presence State <span className="required-star">*</span>
            </label>
            <select
              id="override-state-select"
              className="form-select"
              value={overrideState}
              onChange={(e) => setOverrideState(e.target.value)}
            >
              <option value={PRESENCE_STATES.PRESENT}>Present</option>
              <option value={PRESENCE_STATES.REMOTE}>Remote</option>
              <option value={PRESENCE_STATES.ON_LEAVE}>On Leave</option>
              <option value={PRESENCE_STATES.ABSENT}>Absent</option>
              <option value={PRESENCE_STATES.NOT_SCHEDULED}>Not Scheduled</option>
              <option value={PRESENCE_STATES.UNKNOWN}>Unknown</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="override-reason-input" className="form-label">
              Operational Reason <span className="required-star">*</span>
            </label>
            <textarea
              id="override-reason-input"
              className="form-textarea"
              rows={3}
              placeholder="e.g. Offsite client meeting, badge reader malfunction, approved emergency remote work..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <span className="form-hint">
              Reason will be logged into the permanent append-only audit trail.
            </span>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Applying...' : 'Apply Manual Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
