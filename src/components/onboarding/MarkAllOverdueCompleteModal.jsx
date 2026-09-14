import React, { useState, useEffect } from 'react';
import { X, CheckCheck, AlertTriangle } from 'lucide-react';

/**
 * Confirmation modal for bulk-completing every task currently listed in the Overdue Onboarding
 * Tasks popup. Presentation-only, matching OverdueTasksModal's own convention: the parent page
 * owns the actual overdue-task list and the bulk-completion call (via
 * activityService.markCompleteMany()) — this component only confirms the count and defers to
 * the `onConfirm` callback, so exactly the same set of task IDs the popup is showing is what
 * gets completed, never a separately re-derived list.
 */
export default function MarkAllOverdueCompleteModal({ isOpen, onClose, onConfirm, count }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ backgroundColor: '#ECFDF5', color: '#059669', width: '48px', height: '48px' }}>
              <CheckCheck size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem' }}>Mark All Overdue Tasks Complete?</h3>
              <p className="modal-subtitle">This affects only the onboarding tasks currently listed as overdue.</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="modal-error-alert" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            This will mark {count === 1 ? '1 overdue onboarding task' : `${count} overdue onboarding tasks`} as completed.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Completing...' : 'Mark All as Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
